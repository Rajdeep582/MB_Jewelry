import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiPackage, FiSearch, FiRefreshCw, FiAlertCircle, FiTruck,
  FiCheck, FiCheckCircle, FiShield, FiTag, FiRadio,
  FiMapPin, FiPhone, FiUser, FiClock, FiUserPlus, FiUserX, FiUsers,
  FiChevronDown, FiChevronUp, FiDownload, FiX, FiInbox,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { orderService, customOrderService, adminService } from '../../services/services';
import { downloadInvoice } from '../../utils/invoice';
import toast from 'react-hot-toast';
import { formatDate, formatPrice, resolveImageUrl } from '../../utils/helpers';

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

function normaliseOrder(raw, sourceType) {
  if (sourceType === 'order') {
    return { ...raw, _sourceType: 'order', _displayStatus: raw.orderStatus };
  }
  let displayStatus = raw.status;
  if (['advance_paid', 'in_production', 'final_payment_pending', 'final_payment_paid'].includes(raw.status)) {
    displayStatus = 'in_production';
  }
  const syntheticItem = {
    _id: raw._id, product: raw._id,
    name: `Custom ${raw.type} — ${raw.material}${raw.purity && raw.purity !== 'None' ? ` (${raw.purity})` : ''}`,
    image: raw.referenceImages?.[0]?.url || '', price: raw.totalAmount || 0, quantity: 1,
  };
  return {
    _id: raw._id, _sourceType: 'custom_order', _displayStatus: displayStatus,
    user: raw.user, shippingAddress: raw.shippingAddress, totalAmount: raw.totalAmount || 0,
    items: [syntheticItem], deliveryId: raw.deliveryId, dispatchedAt: raw.dispatchedAt,
    estimatedDelivery: raw.estimatedDelivery, deliveredAt: raw.deliveredAt,
    trackingHistory: raw.trackingHistory || [], createdAt: raw.createdAt,
    customOrderId: raw.customOrderId, orderId: raw.orderId,
    deliveredByPartnerId:   raw.deliveredByPartnerId   || '',
    deliveredByPartnerName: raw.deliveredByPartnerName || '',
  };
}

/* ── Normalise Delivery record (from /admin/deliveries collection) ──────────── */
function normaliseDeliveryRecord(rec) {
  return {
    _id:           rec._id,
    _sourceType:   rec.sourceType,      // 'order' | 'custom_order'
    _displayStatus: rec.status,         // 'shipped' | 'delivered'
    _fromDeliveryCollection: true,
    orderId:       rec.sourceType === 'order'        ? rec.orderId : undefined,
    customOrderId: rec.sourceType === 'custom_order' ? rec.orderId : undefined,
    deliveryId:    rec.deliveryId,
    deliveredByPartnerId:   rec.deliveredByPartnerId   || '',
    deliveredByPartnerName: rec.deliveredByPartnerName || '',
    user:          { name: rec.customerName, email: rec.customerEmail },
    shippingAddress: rec.shippingAddress || {},
    totalAmount:   rec.totalAmount || 0,
    dispatchedAt:  rec.dispatchedAt,
    estimatedDelivery: rec.estimatedDelivery,
    deliveredAt:   rec.deliveredAt,
    trackingHistory: rec.trackingHistory || [],
    createdAt:     rec.createdAt,
    items: [{
      _id: rec._id, product: rec._id,
      name: rec.itemsSummary || '—', image: '', price: rec.totalAmount || 0, quantity: 1,
    }],
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

// Adapts AdminDelivery item shape → shared downloadInvoice shape
function printInvoice(item) {
  const addr = item.shippingAddress || {};
  downloadInvoice({
    orderId:        resolveOrderId(item),
    _id:            item._id,
    createdAt:      item.createdAt,
    items:          item.items || [],
    itemsPrice:     item.itemsPrice ?? item.totalAmount ?? 0,
    shippingPrice:  item.shippingPrice ?? 0,
    taxPrice:       item.taxPrice ?? 0,
    totalAmount:    item.totalAmount ?? 0,
    payment: {
      status:             item.payment?.status || 'paid',
      method:             item.payment?.method || 'razorpay',
      paidAt:             item.payment?.paidAt || item.createdAt,
      razorpayPaymentId:  item.payment?.razorpayPaymentId || '',
    },
    shippingAddress: {
      fullName:     addr.fullName    || item.user?.name || '—',
      addressLine1: addr.addressLine1 || '',
      addressLine2: addr.addressLine2 || '',
      city:         addr.city        || '',
      state:        addr.state       || '',
      pincode:      addr.pincode     || '',
      country:      addr.country     || 'India',
      phone:        addr.phone       || '',
    },
    user: item.user || {},
  });
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
    if (item.estimatedDelivery && new Date(item.estimatedDelivery).getTime() < Date.now()) {
      return { text: `Overdue · ETA was ${formatDate(item.estimatedDelivery)}`, cls: 'text-red-300 bg-red-500/10 border-red-500/25' };
    }
    return {
      text: item.estimatedDelivery ? `ETA ${formatDate(item.estimatedDelivery)}` : `Dispatched ${ago(item.dispatchedAt || item.createdAt)}`,
      cls: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
    };
  }
  const n = daysSince(item.createdAt);
  return {
    text: `Placed ${ago(item.createdAt)}`,
    cls: n >= 3 ? 'text-amber-300 bg-amber-500/10 border-amber-500/25' : 'text-dark-300 bg-white/[0.03] border-white/10',
  };
}

function DeliveryCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const stage    = getStage(item._displayStatus);
  const meta     = STAGE_META[stage];
  const isCustom = item._sourceType === 'custom_order';
  const delivID  = maskDeliveryId(item.deliveryId);
  const mainItem = item.items?.[0];
  const addr     = item.shippingAddress || {};
  const step     = pipelineIndex(item._displayStatus);
  const timing   = timingBadge(item, stage);
  const itemCount = (item.items || []).reduce((n, it) => n + (it.quantity || 1), 0);
  const toggle = () => setExpanded(v => !v);

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`card !rounded-2xl border-l-[3px] ${meta.border} transition-all duration-300 hover:border-white/10 hover:shadow-lg hover:shadow-black/30 overflow-hidden ${expanded ? 'ring-1 ring-gold-500/20' : ''}`}>

      {/* ── Summary (click to expand) ── */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
        className="w-full text-left p-3.5 sm:p-4 cursor-pointer select-none focus:outline-none focus-visible:bg-white/[0.02]"
      >
        <div className="flex items-start gap-3">
          {/* Thumbnail */}
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-dark-800 flex-shrink-0 overflow-hidden border border-white/10">
            {mainItem?.image
              ? <img src={resolveImageUrl(mainItem.image)} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
              : <span className="absolute inset-0 flex items-center justify-center text-dark-600"><FiPackage size={18} /></span>}
            {itemCount > 1 && (
              <span className="absolute bottom-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-dark-950/90 border border-white/15 text-[9px] font-bold text-white flex items-center justify-center">×{itemCount}</span>
            )}
          </div>

          {/* Core info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-gold-400 font-semibold text-sm">{resolveOrderId(item)}</span>
              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${isCustom ? 'bg-purple-500/10 border-purple-500/20 text-purple-300' : 'bg-gold-500/10 border-gold-500/20 text-gold-300'}`}>
                <FiTag size={8} /> {isCustom ? 'Custom' : 'Regular'}
              </span>
              {delivID && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono bg-white/[0.04] border border-white/10 text-dark-200 px-1.5 py-0.5 rounded-full">
                  <FiShield size={8} className="text-gold-400" /> {delivID}
                </span>
              )}
            </div>
            <p className="text-white text-sm font-medium truncate mt-1">
              {item.user?.name || addr.fullName || '—'}
              {addr.phone && <span className="text-dark-500 font-normal"> · {addr.phone}</span>}
            </p>
            <p className="text-dark-400 text-xs truncate mt-0.5 flex items-center gap-1">
              <FiMapPin size={10} className="text-dark-500 flex-shrink-0" />
              {[addr.city, addr.state].filter(Boolean).join(', ') || '—'}
              {addr.pincode && <span className="font-mono text-dark-300 ml-1">{addr.pincode}</span>}
            </p>
          </div>

          {/* Amount + chevron */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <p className="text-gold-400 font-semibold text-sm tabular-nums">{formatPrice(item.totalAmount)}</p>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${stage === 'shipped' ? 'animate-pulse' : ''}`} /> {meta.label}
            </span>
          </div>
        </div>

        {/* Pipeline + timing + quick actions */}
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap items-center gap-x-4 gap-y-2.5">
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
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${timing.cls}`}>{timing.text}</span>
          <div className="ml-auto flex items-center gap-1.5" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} role="group" aria-label="Delivery actions">
            {addr.phone && (
              <a href={`tel:${addr.phone}`} className="inline-flex items-center gap-1 text-[11px] text-dark-300 hover:text-gold-400 border border-white/10 hover:border-gold-500/40 rounded-lg px-2 py-1 transition-colors">
                <FiPhone size={11} /> Call
              </a>
            )}
            <button type="button" onClick={() => printInvoice(item)} className="inline-flex items-center gap-1 text-[11px] text-dark-300 hover:text-gold-400 border border-white/10 hover:border-gold-500/40 rounded-lg px-2 py-1 transition-colors">
              <FiDownload size={11} /> Invoice
            </button>
            <button type="button" onClick={toggle} aria-label={expanded ? 'Hide details' : 'Show details'} className="p-1.5 rounded-lg border border-white/10 text-dark-400 hover:text-white hover:border-white/25 transition-colors">
              {expanded ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Expanded Detail Panel ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/5 px-4 pt-3 pb-3 space-y-3">

              {/* Compact info row: items | customer | address */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">

                {/* Items */}
                <div className="space-y-1.5">
                  <p className="text-dark-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <FiPackage size={9} /> {isCustom ? 'Custom Design' : `Items (${item.items?.length})`}
                  </p>
                  {item.items?.slice(0, 3).map((it) => (
                    <div key={it._id || it.product} className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-dark-800 flex-shrink-0 overflow-hidden border border-white/5">
                        {it.image && <img src={resolveImageUrl(it.image)} alt={it.name} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white truncate leading-tight">{it.name}</p>
                        <p className="text-dark-500">Qty {it.quantity ?? 1} · {formatPrice(it.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Customer */}
                <div className="space-y-0.5 md:border-l md:border-white/5 md:pl-3">
                  <p className="text-dark-500 uppercase tracking-wider text-[10px] flex items-center gap-1 mb-1"><FiUser size={9} /> Customer</p>
                  <p className="text-white font-medium">{item.user?.name || item.shippingAddress?.fullName || '—'}</p>
                  {item.user?.email && <p className="text-dark-500 truncate">{item.user.email}</p>}
                  {item.shippingAddress?.phone && <p className="text-dark-400 flex items-center gap-1"><FiPhone size={9} /> {item.shippingAddress.phone}</p>}
                </div>

                {/* Address + delivery ref */}
                <div className="space-y-0.5 md:border-l md:border-white/5 md:pl-3">
                  <p className="text-dark-500 uppercase tracking-wider text-[10px] flex items-center gap-1 mb-1"><FiMapPin size={9} /> Ship To</p>
                  <p className="text-white truncate">{item.shippingAddress?.addressLine1 || '—'}</p>
                  <p className="text-dark-400">{item.shippingAddress?.city}, {item.shippingAddress?.state} {item.shippingAddress?.pincode}</p>
                  {item.deliveryId && (
                    <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-white/5">
                      <FiTruck size={10} className="text-gold-400 flex-shrink-0" />
                      <span className="font-mono text-gold-400 font-semibold">{delivID}</span>
                      {item.estimatedDelivery && <span className="text-dark-500 ml-auto">ETA {formatDate(item.estimatedDelivery)}</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline + partner row */}
              <div className="flex flex-wrap items-center gap-2 text-xs border-t border-white/5 pt-2.5">
                {item.dispatchedAt && (
                  <span className="text-dark-500 flex items-center gap-1"><FiClock size={9} /> {formatDate(item.dispatchedAt)}</span>
                )}
                {item.deliveredAt && (
                  <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px]">
                    <FiCheck size={9} /> {formatDate(item.deliveredAt)}
                  </span>
                )}
                {item.deliveredByPartnerId && (
                  <span className="inline-flex items-center gap-1 text-gold-400 bg-gold-500/10 border border-gold-500/20 px-2 py-0.5 rounded-full text-[10px]">
                    <FiUser size={9} />
                    {item.deliveredByPartnerName && <span>{item.deliveredByPartnerName}</span>}
                    <span className="font-mono opacity-70">({item.deliveredByPartnerId})</span>
                  </span>
                )}
              </div>

              {/* Tracking — compact, last 4 only */}
              {item.trackingHistory?.length > 0 && (
                <div className="border-t border-white/5 pt-2.5">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {[...item.trackingHistory].slice(-4).map((h, i) => (
                      <span key={i} className="flex items-center gap-1.5 text-[10px] text-dark-400">
                        <span className="w-1 h-1 rounded-full bg-dark-600 flex-shrink-0" />
                        <span className="capitalize text-dark-300">{(h.status || '').replace(/_/g, ' ')}</span>
                        <span className="text-dark-600">{formatDate(h.timestamp || h.date)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
        orderService.getAllOrders({ status: 'delivered', paymentStatus: 'all', limit: 25 }),
      ];
      const customFetches = [
        ...IN_PROGRESS_CUSTOM.map(s => customOrderService.getAllOrders({ status: s, limit: 100 })),
        customOrderService.getAllOrders({ status: 'shipped', limit: 100 }),
        customOrderService.getAllOrders({ status: 'delivered', limit: 25 }),
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
      (o.items?.[0]?.name || '').toLowerCase().includes(q) ||
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
        <StatPill label="Delivered"   hint="Recently completed"  value={counts.delivered} color="emerald" icon={FiCheck} active={tab==='delivered'} onClick={() => setTab('delivered')} />
      </div>

      {/* Search */}
      <div className="relative group">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search order ID, customer, city, PIN, delivery ID…"
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
