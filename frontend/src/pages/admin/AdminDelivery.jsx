import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiPackage, FiSearch, FiRefreshCw, FiTruck, FiCalendar,
  FiCheck, FiShield, FiTag, FiRadio,
  FiMapPin, FiPhone, FiUser, FiClock, FiUserPlus, FiUserX, FiUsers,
  FiChevronDown, FiDownload, FiX, FiInbox,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { orderService, customOrderService, adminService } from '../../services/services';
import { downloadInvoice, downloadCustomOrderInvoice } from '../../utils/invoice';
import toast from 'react-hot-toast';
import { formatDate, formatDateTime, formatCalendarDate, formatPrice, resolveImageUrl } from '../../utils/helpers';
import { CopyBtn, Timeline } from '../../components/admin/OrderDetailUI';

/* ── Pipeline stage mapping ─────────────────────────────────────────────────── */

// Real statuses only (backend 'confirmed' filter for custom orders = advance_paid + confirmed)
const IN_PROGRESS_REGULAR = ['confirmed', 'ready_to_ship'];
const IN_PROGRESS_CUSTOM  = ['confirmed', 'ready_to_ship'];

function getStage(displayStatus) {
  if (['confirmed', 'in_production', 'ready_to_ship'].includes(displayStatus)) return 'progress';
  if (displayStatus === 'shipped') return 'shipped';
  if (displayStatus === 'delivered') return 'delivered';
  return 'progress';
}

const STAGE_META = {
  progress:  { label: 'In Progress', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400', border: 'border-l-amber-500/60' },
  shipped:   { label: 'Shipped',     color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20',   dot: 'bg-blue-400',  border: 'border-l-blue-500' },
  delivered: { label: 'Delivered',   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', border: 'border-l-emerald-500' },
};

/* ── Normalise order into unified shape ─────────────────────────────────────── */

const PAY_TONE = {
  green: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  amber: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
  sky:   'text-sky-300 bg-sky-500/10 border-sky-500/20',
  red:   'text-red-300 bg-red-500/10 border-red-500/20',
};

function normaliseOrder(raw, sourceType) {
  if (sourceType === 'order') {
    const st = raw.payment?.status;
    const pay = st === 'paid' ? ['Paid', PAY_TONE.green] : st === 'failed' ? ['Payment failed', PAY_TONE.red] : st === 'refunded' ? ['Refunded', PAY_TONE.sky] : ['Payment pending', PAY_TONE.amber];
    return { ...raw, _sourceType: 'order', _displayStatus: raw.orderStatus, _payLabel: pay[0], _payTone: pay[1] };
  }
  let displayStatus = raw.status;
  if (['advance_paid', 'in_production', 'final_payment_pending', 'final_payment_paid'].includes(raw.status)) {
    displayStatus = 'in_production';
  }
  const advPaid = raw.advancePayment?.status === 'paid';
  const finPaid = raw.finalPayment?.status === 'paid';
  const paid = (advPaid ? raw.advanceAmount || 0 : 0) + (finPaid ? raw.finalAmount || 0 : 0);
  const pay = finPaid ? ['Fully paid', PAY_TONE.green] : advPaid ? [`Advance paid · due ${formatPrice(Math.max(0, (raw.totalAmount || 0) - paid))}`, PAY_TONE.amber] : ['Awaiting advance', PAY_TONE.amber];
  const syntheticItem = {
    _id: raw._id, product: raw._id,
    name: `Custom ${raw.type} — ${raw.material}${raw.purity && raw.purity !== 'None' ? ` (${raw.purity})` : ''}`,
    image: raw.referenceImages?.[0]?.url || '', price: raw.quoteAmount || raw.totalAmount || 0, quantity: 1,
  };
  return {
    _id: raw._id, _sourceType: 'custom_order', _displayStatus: displayStatus,
    _payLabel: pay[0], _payTone: pay[1], _raw: raw,
    user: raw.user, shippingAddress: raw.shippingAddress, totalAmount: raw.totalAmount || 0,
    itemsPrice: raw.quoteAmount || 0, shippingPrice: raw.shippingAmount || 0, taxPrice: raw.taxAmount || 0,
    payment: {
      status: finPaid ? 'paid' : 'pending', method: 'razorpay',
      paidAt: raw.finalPayment?.paidAt || raw.advancePayment?.paidAt,
      razorpayPaymentId: raw.finalPayment?.razorpayPaymentId || raw.advancePayment?.razorpayPaymentId || '',
    },
    items: [syntheticItem], deliveryId: raw.deliveryId, dispatchedAt: raw.dispatchedAt,
    estimatedDelivery: raw.estimatedDelivery, deliveredAt: raw.deliveredAt,
    trackingHistory: raw.trackingHistory || [], createdAt: raw.createdAt,
    customOrderId: raw.customOrderId, orderId: raw.orderId,
    dpConfirmedAt: raw.dpConfirmedAt, dpNote: raw.dpNote || '',
    deliveredByPartnerId:   raw.deliveredByPartnerId   || '',
    deliveredByPartnerName: raw.deliveredByPartnerName || '',
  };
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function maskDeliveryId(uuid) {
  if (!uuid) return null;
  return `MB-${uuid.replace(/-/g, '').slice(-8).toUpperCase()}`;
}
function resolveOrderId(item) {
  if (!item) return '—';
  if (item._sourceType === 'order') return item.orderId || `ORD-${String(item._id).slice(-8).toUpperCase()}`;
  return item.customOrderId || `CUS-${String(item._id).slice(-8).toUpperCase()}`;
}

/* ── Stat Pill ──────────────────────────────────────────────────────────────── */

function StatPill({ label, value, color, icon: Icon, active, onClick, hint }) {
  const colors = {
    amber:   { box: 'from-amber-500/[0.12] to-amber-500/[0.03] border-amber-500/25', text: 'text-amber-300', icon: 'bg-amber-500/15 text-amber-300' },
    blue:    { box: 'from-sky-500/[0.12] to-sky-500/[0.03] border-sky-500/25',       text: 'text-sky-300',   icon: 'bg-sky-500/15 text-sky-300' },
    emerald: { box: 'from-emerald-500/[0.12] to-emerald-500/[0.03] border-emerald-500/25', text: 'text-emerald-300', icon: 'bg-emerald-500/15 text-emerald-300' },
  };
  const c = colors[color];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br px-3 sm:px-4 py-3 sm:py-3.5 text-left transition-all duration-300 ${c.box} ${
        active ? 'ring-2 ring-gold-500/60 ring-offset-2 ring-offset-dark-950 shadow-lg' : 'opacity-80 hover:opacity-100 hover:-translate-y-0.5'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`text-2xl sm:text-[1.7rem] font-bold leading-none tabular-nums ${c.text}`}>{value}</p>
        {Icon && <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.icon}`}><Icon size={15} /></span>}
      </div>
      <p className="text-[11px] sm:text-xs font-semibold text-dark-200 mt-1.5">{label}</p>
      {hint && <p className="hidden sm:block text-[10px] text-dark-500 mt-0.5">{hint}</p>}
      {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gold-500" aria-hidden="true" />}
    </button>
  );
}

/* ── PDF Invoice Generator ──────────────────────────────────────────────────── */

// Tax invoice straight from the source order — only once it is paid (custom orders: balance paid)
const invoiceReady = (item) => (item._sourceType === 'order' ? item.payment?.status === 'paid' : item._raw?.finalPayment?.status === 'paid');
function printInvoice(item) {
  if (item._sourceType === 'order') downloadInvoice(item);
  else downloadCustomOrderInvoice(item._raw);
}

/* ── Delivery Card (read-only, collapsible) ─────────────────────────────────── */

const PIPELINE = ['Processing', 'Packed', 'Shipped', 'Delivered'];
function pipelineIndex(displayStatus) {
  if (displayStatus === 'ready_to_ship') return 1;
  if (displayStatus === 'shipped') return 2;
  if (displayStatus === 'delivered') return 3;
  return 0;
}

const DAY = 24 * 60 * 60 * 1000;
function daysSince(d) { return d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / DAY)) : null; }
function ago(d) {
  const n = daysSince(d);
  if (n == null) return '';
  if (n === 0) return 'today';
  return n === 1 ? '1 day ago' : `${n} days ago`;
}

/** One-line "what needs attention" summary for the card footer */
function timingBadge(item, stage) {
  if (stage === 'delivered') {
    return { text: `Delivered ${item.deliveredAt ? formatDate(item.deliveredAt) : ''}`.trim(), cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' };
  }
  if (stage === 'shipped') {
    if (item.estimatedDelivery && new Date(item.estimatedDelivery).getTime() + DAY < Date.now()) {
      return { text: `Overdue · ETA was ${formatCalendarDate(item.estimatedDelivery, 'short')}`, cls: 'text-red-300 bg-red-500/10 border-red-500/25' };
    }
    return {
      text: item.estimatedDelivery ? `ETA ${formatCalendarDate(item.estimatedDelivery, 'short')}` : `Dispatched ${ago(item.dispatchedAt || item.createdAt)}`,
      cls: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
    };
  }
  const n = daysSince(item.createdAt);
  return {
    text: `Placed ${ago(item.createdAt)}`,
    cls: n >= 3 ? 'text-amber-300 bg-amber-500/10 border-amber-500/25' : 'text-dark-300 bg-white/[0.03] border-white/10',
  };
}

const HISTORY_LABELS = {
  pending: 'Order placed', quoted: 'Quoted', advance_paid: 'Advance paid · in production', in_production: 'In production',
  confirmed: 'Confirmed', ready_to_ship: 'Ready to ship', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
};

function InfoBlock({ icon, title, children, wide }) {
  const Icon = icon;
  return (
    <div className={`min-w-0 rounded-xl bg-dark-900/50 border border-white/[0.05] px-2.5 py-2 sm:px-3 sm:py-2.5 ${wide ? 'col-span-2 sm:col-span-1' : ''}`}>
      <p className="text-[10px] uppercase tracking-[0.14em] text-dark-500 font-semibold flex items-center gap-1.5 mb-1.5"><Icon size={10} className="text-gold-500" /> {title}</p>
      <div className="text-[11px] leading-relaxed space-y-0.5">{children}</div>
    </div>
  );
}

function DateLine({ label, value, tone = 'text-dark-200' }) {
  if (!value) return null;
  return (
    <p className="flex justify-between gap-2"><span className="text-dark-500">{label}</span><span className={`tabular-nums text-right ${tone}`}>{value}</span></p>
  );
}

function DeliveryCard({ item }) {
  const [showTimeline, setShowTimeline] = useState(false);
  const stage    = getStage(item._displayStatus);
  const meta     = STAGE_META[stage];
  const isCustom = item._sourceType === 'custom_order';
  const delivID  = maskDeliveryId(item.deliveryId);
  const items    = item.items || [];
  const thumb    = items.find((it) => it.image)?.image;
  const addr     = item.shippingAddress || {};
  const step     = pipelineIndex(item._displayStatus);
  const timing   = timingBadge(item, stage);
  const itemCount = items.reduce((n, it) => n + (it.quantity || 1), 0);
  const name     = item.user?.name || addr.fullName || '—';
  const phone    = addr.phone || item.user?.phone;
  const awaitingAdmin = item.dpConfirmedAt && stage === 'shipped';
  const partner  = [item.deliveredByPartnerName, item.deliveredByPartnerId && `(${item.deliveredByPartnerId})`].filter(Boolean).join(' ');

  return (
    <motion.article layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`card !rounded-2xl !p-0 border-l-[3px] ${meta.border} overflow-hidden`}>

      {/* ── Header: product, id, status, amount ── */}
      <div className="flex items-start gap-3 p-3 sm:p-3.5">
        <div className="relative w-12 h-12 rounded-xl bg-dark-800 shrink-0 overflow-hidden border border-white/10 flex items-center justify-center">
          {thumb
            ? <img src={resolveImageUrl(thumb)} alt="" className="w-full h-full object-cover" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />
            : <FiPackage size={18} className="text-dark-600" />}
          {itemCount > 1 && <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/70 text-[9px] text-dark-200">×{itemCount}</span>}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-gold-400 font-semibold text-xs">{resolveOrderId(item)}</span>
            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${isCustom ? 'bg-purple-500/10 border-purple-500/20 text-purple-300' : 'bg-gold-500/10 border-gold-500/20 text-gold-300'}`}>
              <FiTag size={8} /> {isCustom ? 'Custom' : 'Regular'}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${meta.bg} ${meta.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${stage === 'shipped' ? 'animate-pulse' : ''}`} /> {meta.label}
            </span>
            {awaitingAdmin && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border text-amber-300 bg-amber-500/10 border-amber-500/25" title="Delivery partner confirmed — awaiting admin">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> DP confirmed
              </span>
            )}
          </div>
          <p className="text-white text-sm font-medium mt-0.5 truncate" title={items.map((it) => `${it.name} ×${it.quantity ?? 1}`).join(', ')}>
            {items[0]?.name || '—'}
            {items[0]?.quantity > 1 && <span className="text-dark-400 font-normal"> ×{items[0].quantity}</span>}
            {items.length > 1 && <span className="text-dark-400 font-normal"> · +{items.length - 1} more</span>}
          </p>
          {delivID && (
            <p className="text-[11px] text-dark-400 flex items-center gap-1 mt-0.5">
              <FiShield size={10} className="text-gold-500 shrink-0" /><span className="font-mono text-dark-200">{delivID}</span><CopyBtn value={delivID} label="Tracking number" />
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0 text-right">
          <p className="text-gold-400 font-semibold text-sm tabular-nums">{formatPrice(item.totalAmount)}</p>
          {item._payLabel && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border max-w-[11rem] truncate ${item._payTone}`}>{item._payLabel}</span>}
        </div>
      </div>

      {/* ── All details at a glance ── */}
      <div className="grid grid-cols-2 gap-2 px-3 sm:px-3.5 pb-3 xl:grid-cols-4">
        <InfoBlock icon={FiUser} title="Customer">
          <p className="text-white font-medium truncate">{name}</p>
          {phone && <a href={`tel:${phone}`} className="flex items-center gap-1 text-dark-300 hover:text-gold-400 w-fit"><FiPhone size={10} />{phone}</a>}
          {item.user?.email && <a href={`mailto:${item.user.email}`} className="block text-dark-400 hover:text-gold-400 truncate">{item.user.email}</a>}
        </InfoBlock>

        <InfoBlock icon={FiMapPin} title="Ship to">
          {addr.fullName && addr.fullName !== name && <p className="text-dark-200">{addr.fullName}</p>}
          <p className="text-dark-300">{[addr.addressLine1, addr.addressLine2].filter(Boolean).join(', ') || '—'}</p>
          <p className="text-dark-400">{[addr.city, addr.state].filter(Boolean).join(', ')} {addr.pincode && <span className="font-mono text-dark-200">{addr.pincode}</span>}</p>
        </InfoBlock>

        <InfoBlock icon={FiCalendar} title="Dates" wide>
          <DateLine label="Placed" value={item.createdAt && formatDateTime(item.createdAt)} />
          <DateLine label="Dispatched" value={item.dispatchedAt && formatDateTime(item.dispatchedAt)} />
          <DateLine label="ETA" value={item.estimatedDelivery && formatCalendarDate(item.estimatedDelivery, 'short')} />
          <DateLine label="Delivered" value={item.deliveredAt && formatDateTime(item.deliveredAt)} tone="text-emerald-400" />
        </InfoBlock>

        <InfoBlock icon={FiTruck} title={partner || item.dpConfirmedAt ? 'Partner & bill' : 'Bill'} wide>
          <DateLine label="Delivered by" value={partner} />
          <DateLine label="Partner confirmed" value={item.dpConfirmedAt && formatDateTime(item.dpConfirmedAt)} />
          {item.dpNote && <p className="text-dark-400 truncate" title={item.dpNote}>&ldquo;{item.dpNote}&rdquo;</p>}
          <DateLine label={isCustom ? 'Quote' : 'Items'} value={formatPrice(item.itemsPrice ?? item.totalAmount ?? 0)} />
          <DateLine label="Shipping" value={item.shippingPrice > 0 ? formatPrice(item.shippingPrice) : 'Free'} />
          <DateLine label="GST" value={formatPrice(item.taxPrice || 0)} />
        </InfoBlock>
      </div>

      {/* ── Footer: pipeline, timing, actions ── */}
      <div className="px-3 sm:px-3.5 py-2.5 border-t border-white/[0.06] flex flex-wrap items-center gap-x-4 gap-y-2">
        <ol className="flex items-center gap-1 min-w-0" aria-label={`Stage: ${PIPELINE[step]}`}>
          {PIPELINE.map((label, i) => (
            <li key={label} className="flex items-center gap-1">
              <span className={`flex items-center gap-1 text-[10px] font-medium whitespace-nowrap ${i < step ? 'text-dark-300' : i === step ? meta.color : 'text-dark-600'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${i < step ? 'bg-gold-500/70' : i === step ? meta.dot : 'bg-dark-600'}`} />
                <span className={i === step ? '' : 'hidden sm:inline'}>{label}</span>
              </span>
              {i < PIPELINE.length - 1 && <span className={`w-3 sm:w-5 h-px ${i < step ? 'bg-gold-500/50' : 'bg-white/10'}`} />}
            </li>
          ))}
        </ol>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${timing.cls}`}>{timing.text}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {invoiceReady(item) && (
            <button type="button" onClick={() => printInvoice(item)} className="inline-flex items-center gap-1 text-[11px] text-dark-300 hover:text-gold-400 border border-white/10 hover:border-gold-500/40 rounded-lg px-2 py-1 transition-colors" title={item.invoiceNumber || item._raw?.invoiceNumber || 'Tax invoice'}>
              <FiDownload size={11} /> Invoice
            </button>
          )}
          {item.trackingHistory?.length > 0 && (
            <button type="button" onClick={() => setShowTimeline(v => !v)} aria-expanded={showTimeline} className="inline-flex items-center gap-1 text-[11px] text-dark-300 hover:text-white border border-white/10 hover:border-white/25 rounded-lg px-2 py-1 transition-colors">
              <FiClock size={11} /> History
              <FiChevronDown size={11} className={`transition-transform ${showTimeline ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showTimeline && (
          <motion.div
            key="timeline"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] bg-dark-900/40 px-3 sm:px-3.5 pt-3 max-w-xl">
              <Timeline entries={item.trackingHistory} labels={HISTORY_LABELS} bare />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────────── */

/* ── Delivery Partner Manager ────────────────────────────────────────────────── */

const ASSIGN_PHRASE  = 'Make this email id delivery partner';
const REMOVE_PHRASE  = 'Remove Partner';
const DELETE_PHRASE  = 'DELETE';

function DeliveryPartnerManager({ onRefreshOrders }) {
  const [open, setOpen]               = useState(false);
  const [partners, setPartners]       = useState([]);
  const [allUsers, setAllUsers]       = useState([]);
  const [busy, setBusy]               = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [removingId, setRemovingId]   = useState(null);
  const [removeText, setRemoveText]   = useState('');
  const [deletingId, setDeletingId]   = useState(null);
  const [deleteText, setDeleteText]   = useState('');

  const load = async () => {
    try {
      const [pRes, uRes] = await Promise.all([
        adminService.getDeliveryPartners(),
        adminService.getUsersForDeliveryAssign(),
      ]);
      setPartners(pRes.data.partners || []);
      // allUsers = all DP accounts not yet approved (pending)
      setAllUsers((uRes.data.users || []).filter(u => u.role !== 'delivery'));
    } catch { /* silent */ }
  };

  useEffect(() => { load(); }, []);          // load count on mount
  useEffect(() => { if (open) load(); }, [open]); // refresh on expand

  const startAssign = (userId) => {
    setConfirmingId(userId);
    setConfirmText('');
  };

  const cancelAssign = () => {
    setConfirmingId(null);
    setConfirmText('');
  };

  const assign = async (userId) => {
    if (confirmText.trim() !== ASSIGN_PHRASE) {
      toast.error(`Type exactly: "${ASSIGN_PHRASE}"`);
      return;
    }
    setBusy(true);
    try {
      await adminService.assignDeliveryRole(userId);
      toast.success('Delivery role assigned');
      cancelAssign();
      await load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    setBusy(false);
  };

  const startRemove = (userId) => { setRemovingId(userId); setRemoveText(''); };
  const cancelRemove = () => { setRemovingId(null); setRemoveText(''); };

  const startDelete = (userId) => { setDeletingId(userId); setDeleteText(''); cancelAssign(); };
  const cancelDelete = () => { setDeletingId(null); setDeleteText(''); };

  const deletePartner = async (userId) => {
    if (deleteText.trim() !== DELETE_PHRASE) {
      toast.error('Type exactly: DELETE');
      return;
    }
    setBusy(true);
    try {
      await adminService.deleteDeliveryPartner(userId);
      toast.success('Partner deleted permanently');
      cancelDelete();
      await load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    setBusy(false);
  };

  const remove = async (userId) => {
    if (removeText.trim() !== REMOVE_PHRASE) {
      toast.error(`Type exactly: "${REMOVE_PHRASE}"`);
      return;
    }
    setBusy(true);
    try {
      await adminService.removeDeliveryRole(userId);
      toast.success('Delivery role removed');
      setRemovingId(null);
      setRemoveText('');
      await load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    setBusy(false);
  };

  return (
    <div className="card p-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <FiUsers size={16} className="text-violet-400" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">Delivery Partner Management</p>
            <p className="text-dark-500 text-xs">{partners.filter(p => p.isApproved).length} active partner{partners.filter(p => p.isApproved).length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <span className="text-dark-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-white/5 pt-4">
          {/* Current partners — only approved */}
          {partners.filter(p => p.isApproved).length > 0 && (
            <div>
              <p className="text-xs text-dark-500 uppercase tracking-wider mb-2">Active Partners</p>
              <div className="space-y-2">
                {partners.filter(p => p.isApproved).map(p => (
                  <div key={p._id} className="bg-dark-900 rounded-lg border border-white/5 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <div>
                        <p className="text-white text-sm">{p.name}</p>
                        <p className="text-dark-500 text-xs">{p.email}</p>
                      </div>
                      {removingId === p._id ? (
                        <button onClick={cancelRemove} className="text-xs text-dark-500 hover:text-white px-2 py-1">Cancel</button>
                      ) : (
                        <button
                          onClick={() => startRemove(p._id)}
                          disabled={busy}
                          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg px-2.5 py-1.5 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          <FiUserX size={12} /> Remove
                        </button>
                      )}
                    </div>

                    {removingId === p._id && (
                      <div className="px-3 pb-3 border-t border-white/5 pt-3 space-y-2">
                        <p className="text-xs text-dark-400">Type to confirm removal:</p>
                        <p className="text-xs font-mono text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1 select-none">
                          {REMOVE_PHRASE}
                        </p>
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            value={removeText}
                            onChange={e => setRemoveText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && remove(p._id)}
                            placeholder="Type the phrase above…"
                            className="flex-1 bg-dark-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-red-500/50"
                          />
                          <button
                            onClick={() => remove(p._id)}
                            disabled={busy || removeText.trim() !== REMOVE_PHRASE}
                            className="text-xs bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-3 py-1.5 font-medium transition-colors flex items-center gap-1.5"
                          >
                            <FiUserX size={12} /> Confirm
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assign from users */}
          {allUsers.length > 0 && (
            <div>
              <p className="text-xs text-dark-500 uppercase tracking-wider mb-2">Assign Delivery Role</p>
              <div className="space-y-2 max-h-64 overflow-y-auto overscroll-contain pr-1" data-lenis-prevent="true">
                {allUsers.map(u => (
                  <div key={u._id} className="bg-dark-900 rounded-lg border border-white/5 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <div>
                        <p className="text-white text-sm">{u.name}</p>
                        <p className="text-dark-500 text-xs">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {confirmingId === u._id || deletingId === u._id ? (
                          <button
                            onClick={() => { cancelAssign(); cancelDelete(); }}
                            className="text-xs text-dark-500 hover:text-white px-2 py-1"
                          >Cancel</button>
                        ) : (
                          <>
                            <button
                              onClick={() => startAssign(u._id)}
                              disabled={busy}
                              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                            >
                              <FiUserPlus size={12} /> Assign
                            </button>
                            <button
                              onClick={() => startDelete(u._id)}
                              disabled={busy}
                              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg px-2.5 py-1.5 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            >
                              <FiUserX size={12} /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {confirmingId === u._id && (
                      <div className="px-3 pb-3 border-t border-white/5 pt-3 space-y-2">
                        <p className="text-xs text-dark-400">Type to confirm:</p>
                        <p className="text-xs font-mono text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded px-2 py-1 select-none">
                          {ASSIGN_PHRASE}
                        </p>
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            value={confirmText}
                            onChange={e => setConfirmText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && assign(u._id)}
                            placeholder="Type the phrase above…"
                            className="flex-1 bg-dark-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-violet-500/50"
                          />
                          <button
                            onClick={() => assign(u._id)}
                            disabled={busy || confirmText.trim() !== ASSIGN_PHRASE}
                            className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-3 py-1.5 font-medium transition-colors flex items-center gap-1.5"
                          >
                            <FiUserPlus size={12} /> Assign
                          </button>
                        </div>
                      </div>
                    )}

                    {deletingId === u._id && (
                      <div className="px-3 pb-3 border-t border-red-500/10 pt-3 space-y-2 bg-red-500/5">
                        <p className="text-xs text-red-400 font-medium">⚠ This will permanently delete this account from the database.</p>
                        <p className="text-xs text-dark-400">Type <span className="font-mono text-red-300">DELETE</span> to confirm:</p>
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            value={deleteText}
                            onChange={e => setDeleteText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && deletePartner(u._id)}
                            placeholder="DELETE"
                            className="flex-1 bg-dark-800 border border-red-500/30 rounded-lg px-3 py-1.5 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-red-500/60"
                          />
                          <button
                            onClick={() => deletePartner(u._id)}
                            disabled={busy || deleteText.trim() !== DELETE_PHRASE}
                            className="text-xs bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-3 py-1.5 font-medium transition-colors flex items-center gap-1.5"
                          >
                            <FiUserX size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {partners.length === 0 && allUsers.length === 0 && (
            <p className="text-dark-500 text-sm text-center py-4">No verified users found</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminDelivery() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [tab, setTab]         = useState('progress');

  const pollingRef  = useRef(null);
  const lastRefresh = useRef(null);

  useEffect(() => { document.title = 'Delivery Management — Admin'; }, []);

  /* ── Load all pipeline items ──────────────────────────────────────────────── */
  const loadItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const orderFetches = [
        ...IN_PROGRESS_REGULAR.map(s => orderService.getAllOrders({ status: s, paymentStatus: 'all', limit: 100 })),
        orderService.getAllOrders({ status: 'shipped', paymentStatus: 'all', limit: 100 }),
        orderService.getAllOrders({ status: 'delivered', paymentStatus: 'all', limit: 100 }),
      ];
      const customFetches = [
        ...IN_PROGRESS_CUSTOM.map(s => customOrderService.getAllOrders({ status: s, limit: 100 })),
        customOrderService.getAllOrders({ status: 'shipped', limit: 100 }),
        customOrderService.getAllOrders({ status: 'delivered', limit: 100 }),
      ];

      const [orderResults, customResults] = await Promise.all([
        Promise.all(orderFetches), Promise.all(customFetches),
      ]);

      const normOrders  = orderResults.flatMap(r => r.data.orders || []).map(o => normaliseOrder(o, 'order'));
      const normCustoms = customResults.flatMap(r => r.data.orders || []).map(o => normaliseOrder(o, 'custom_order'));

      const combined = [...normOrders, ...normCustoms];
      const unique = Array.from(new Map(combined.map(i => [String(i._id), i])).values());
      unique.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setItems(unique);
      lastRefresh.current = new Date();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load delivery data');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  /* ── 30s auto-polling ─────────────────────────────────────────────────────── */
  useEffect(() => {
    pollingRef.current = setInterval(() => loadItems(true), 30_000);
    return () => clearInterval(pollingRef.current);
  }, [loadItems]);

  /* ── Counts ───────────────────────────────────────────────────────────────── */
  const counts = {
    progress:  items.filter(o => getStage(o._displayStatus) === 'progress').length,
    shipped:   items.filter(o => getStage(o._displayStatus) === 'shipped').length,
    delivered: items.filter(o => getStage(o._displayStatus) === 'delivered').length,
  };

  /* ── Filter ───────────────────────────────────────────────────────────────── */
  const filtered = items.filter(o => {
    if (getStage(o._displayStatus) !== tab) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      o._id.toLowerCase().includes(q) ||
      (o.user?.name || '').toLowerCase().includes(q) ||
      (o.user?.email || '').toLowerCase().includes(q) ||
      (o.shippingAddress?.city || '').toLowerCase().includes(q) ||
      (o.shippingAddress?.pincode || '').toLowerCase().includes(q) ||
      (o.shippingAddress?.phone || '').toLowerCase().includes(q) ||
      (o.items || []).some(it => (it.name || '').toLowerCase().includes(q)) ||
      (o.deliveryId ? maskDeliveryId(o.deliveryId).toLowerCase().includes(q) : false) ||
      resolveOrderId(o).toLowerCase().includes(q)
    );
  });

  const renderDeliveryList = () => {
    if (loading) {
      return (
        <div className="space-y-3">
          {[0, 1, 2].map((n) => <div key={n} className="card !rounded-2xl p-4"><div className="skeleton h-14 rounded-xl" /><div className="skeleton h-4 rounded mt-3 w-2/3" /></div>)}
        </div>
      );
    }
    if (filtered.length === 0) {
      return (
        <div className="card !rounded-2xl py-14 text-center">
          <span className="mx-auto mb-3 w-12 h-12 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-dark-400"><FiInbox size={20} /></span>
          <p className="text-dark-300 text-sm font-medium">{search ? 'No deliveries match your search' : `Nothing ${STAGE_META[tab].label.toLowerCase()} right now`}</p>
          {search && <button type="button" onClick={() => setSearch('')} className="text-gold-400 text-xs mt-2 hover:text-gold-300">Clear search</button>}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {filtered.map(item => (
            <DeliveryCard key={item._id} item={item} />
          ))}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl text-white">Delivery Management</h1>
          <p className="text-dark-400 text-sm mt-0.5 flex items-center gap-2">
            {loading ? 'Loading…' : `${counts.progress + counts.shipped} active · ${counts.delivered} delivered`}
            {lastRefresh.current && !loading && (
              <span className="text-dark-600 text-xs flex items-center gap-1"><FiRadio size={10} className="text-green-500" /> Auto-sync 30s</span>
            )}
          </p>
        </div>
        <button onClick={() => loadItems()} disabled={loading} className="btn-dark text-sm flex items-center gap-2 disabled:opacity-50">
          <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Delivery Partner Manager */}
      <DeliveryPartnerManager onRefreshOrders={() => loadItems(true)} />

      {/* Stat Pills */}
      <div className="grid grid-cols-3 gap-3">
        <StatPill label="In Progress" hint="Processing & packed" value={counts.progress} color="amber"  icon={FiClock}   active={tab==='progress'}  onClick={() => setTab('progress')} />
        <StatPill label="Shipped"     hint="Out with partners"   value={counts.shipped}  color="blue"   icon={FiTruck}   active={tab==='shipped'}   onClick={() => setTab('shipped')} />
        <StatPill label="Delivered"   hint="Latest 100 per type"  value={counts.delivered} color="emerald" icon={FiCheck} active={tab==='delivered'} onClick={() => setTab('delivered')} />
      </div>

      {/* Search */}
      <div className="relative group">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search order ID, tracking no., customer, phone, city, PIN, item…"
          className="w-full bg-dark-800 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/20 transition-colors"
        />
        <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500 group-focus-within:text-gold-400 transition-colors" />
        {search && (
          <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-dark-400 hover:text-white hover:bg-white/5">
            <FiX size={13} />
          </button>
        )}
      </div>

      {/* Error */}
      {error && <div className="card p-4 border-red-500/20 text-red-400 text-sm">{error}</div>}

      {/* List */}
      {renderDeliveryList()}
    </div>
  );
}
