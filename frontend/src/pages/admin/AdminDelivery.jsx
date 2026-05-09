import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiPackage, FiSearch, FiRefreshCw, FiAlertCircle, FiTruck,
  FiCheck, FiCheckCircle, FiShield, FiTag, FiRadio,
  FiMapPin, FiPhone, FiUser, FiClock, FiUserPlus, FiUserX, FiUsers,
  FiChevronDown, FiChevronUp, FiDownload,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { orderService, customOrderService, adminService } from '../../services/services';
import { downloadInvoice } from '../../utils/invoice';
import toast from 'react-hot-toast';
import { formatDate, formatPrice, resolveImageUrl } from '../../utils/helpers';

/* ── Pipeline stage mapping ─────────────────────────────────────────────────── */

const IN_PROGRESS_REGULAR = ['confirmed', 'in_production', 'ready_to_ship'];
const IN_PROGRESS_CUSTOM  = ['in_production', 'final_payment_pending', 'final_payment_paid', 'ready_to_ship'];

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

function StatPill({ label, value, color, icon: Icon, active, onClick }) {
  const colors = {
    amber:   'bg-amber-500/10 border-amber-500/20 text-amber-400',
    blue:    'bg-blue-500/10 border-blue-500/20 text-blue-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  };
  return (
    <button onClick={onClick}
      className={`rounded-xl border px-5 py-4 flex flex-col gap-1 transition-all text-left ${colors[color]} ${active ? 'ring-2 ring-offset-1 ring-offset-dark-950 ring-gold-500/50 scale-[1.02]' : 'hover:scale-[1.01]'}`}>
      <div className="flex items-center justify-between w-full">
        <p className="text-2xl font-display font-semibold">{value}</p>
        {Icon && <Icon size={18} className="opacity-50" />}
      </div>
      <p className="text-xs opacity-75">{label}</p>
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

function DeliveryCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const stage    = getStage(item._displayStatus);
  const meta     = STAGE_META[stage];
  const isCustom = item._sourceType === 'custom_order';
  const delivID  = maskDeliveryId(item.deliveryId);
  const mainItem = item.items?.[0];

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`card border-l-4 ${meta.border} transition-shadow hover:shadow-lg hover:shadow-black/20 overflow-hidden`}>

      {/* ── Collapsed Header (always visible, clickable) ── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left p-4 flex flex-wrap items-center gap-3"
      >
        {/* Thumbnail */}
        <div className="w-10 h-10 rounded-lg bg-dark-800 flex-shrink-0 overflow-hidden border border-white/5">
          {mainItem?.image
            ? <img src={resolveImageUrl(mainItem.image)} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
            : <FiPackage size={16} className="m-auto text-dark-600 mt-2.5" />}
        </div>

        {/* Core info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className="font-mono text-gold-400 font-semibold text-sm">{resolveOrderId(item)}</span>
            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${isCustom ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-gold-500/10 border-gold-500/20 text-gold-400'}`}>
              <FiTag size={8} /> {isCustom ? 'Custom' : 'Regular'}
            </span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${stage === 'shipped' ? 'animate-pulse' : ''}`} /> {meta.label}
            </span>
            {delivID && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-gold-500/10 border border-gold-500/30 text-gold-300 px-1.5 py-0.5 rounded-full">
                <FiShield size={8} /> {delivID}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0 text-xs text-dark-400">
            <span className="text-dark-300">{item.user?.name || item.shippingAddress?.fullName || '—'}</span>
            <span>{item.shippingAddress?.city}, {item.shippingAddress?.state}</span>
            <span className="text-dark-600">{formatDate(item.createdAt)}</span>
          </div>
        </div>

        {/* Amount + chevron */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <p className="text-gold-500 font-semibold text-sm">{formatPrice(item.totalAmount)}</p>
          {expanded ? <FiChevronUp size={14} className="text-dark-500" /> : <FiChevronDown size={14} className="text-dark-500" />}
        </div>
      </button>

      {/* ── Expanded Detail Panel ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/5 px-4 py-4 space-y-4">

              {/* Items + Customer grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Items */}
                <div>
                  <p className="text-xs text-dark-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <FiPackage size={10} /> {isCustom ? 'Custom Design' : `Items (${item.items?.length})`}
                  </p>
                  <div className="space-y-2 max-h-44 overflow-y-auto scrollbar-hide pr-1">
                    {item.items?.map((it) => (
                      <div key={it._id || it.product} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-dark-800 flex-shrink-0 overflow-hidden border border-white/5">
                          {it.image && <img src={resolveImageUrl(it.image)} alt={it.name} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{it.name}</p>
                          <p className="text-xs text-dark-400">Qty {it.quantity ?? 1} · {formatPrice(it.price)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer + Address */}
                <div className="space-y-3 md:border-l md:border-white/5 md:pl-5">
                  <div>
                    <p className="text-xs text-dark-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><FiUser size={10} /> Customer</p>
                    <p className="text-sm text-white font-medium">{item.user?.name || item.shippingAddress?.fullName || '—'}</p>
                    {item.user?.email && <p className="text-xs text-dark-500">{item.user.email}</p>}
                    {item.shippingAddress?.phone && (
                      <p className="text-xs text-dark-400 flex items-center gap-1 mt-0.5"><FiPhone size={10} /> {item.shippingAddress.phone}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-dark-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><FiMapPin size={10} /> Ship to</p>
                    <p className="text-sm text-white leading-snug">{item.shippingAddress?.addressLine1 || '—'}</p>
                    {item.shippingAddress?.addressLine2 && <p className="text-sm text-dark-400">{item.shippingAddress.addressLine2}</p>}
                    <p className="text-xs text-dark-400 mt-0.5">{item.shippingAddress?.city}, {item.shippingAddress?.state} — {item.shippingAddress?.pincode}</p>
                  </div>

                  {/* Delivery Reference */}
                  {item.deliveryId && (
                    <div className="bg-dark-800 border border-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
                      <FiTruck size={12} className="text-gold-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-dark-500 mb-0.5">Delivery Reference</p>
                        <span className="font-mono text-gold-400 text-sm font-semibold">{delivID}</span>
                      </div>
                      {item.estimatedDelivery && (
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-dark-500">ETA</p>
                          <p className="text-xs font-medium text-dark-300">{formatDate(item.estimatedDelivery)}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs border-t border-white/5 pt-3">
                {item.dispatchedAt && (
                  <span className="text-dark-500 flex items-center gap-1"><FiClock size={10} /> Dispatched: <span className="text-dark-300">{formatDate(item.dispatchedAt)}</span></span>
                )}
                {item.estimatedDelivery && <span className="text-dark-500">ETA: <span className="text-dark-300">{formatDate(item.estimatedDelivery)}</span></span>}
                {item.deliveredAt && (
                  <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    <FiCheck size={10} /> Delivered on {formatDate(item.deliveredAt)}
                  </span>
                )}
              </div>

              {/* Tracking History */}
              {item.trackingHistory?.length > 0 && (
                <div className="border-t border-white/5 pt-3">
                  <p className="text-xs text-dark-500 uppercase tracking-wider mb-2">Tracking</p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto scrollbar-hide">
                    {item.trackingHistory.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="text-dark-600 flex-shrink-0 w-20">{formatDate(h.timestamp || h.date)}</span>
                        <span className="text-dark-300 capitalize">{(h.status || h.note || '').replace(/_/g, ' ')}</span>
                        {h.note && h.note !== h.status && <span className="text-dark-500">— {h.note}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PDF Download */}
              <div className="border-t border-white/5 pt-3 flex justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); printInvoice(item); }}
                  className="flex items-center gap-2 text-xs bg-gold-500/10 border border-gold-500/30 text-gold-400 hover:bg-gold-500/20 rounded-lg px-3 py-2 transition-colors"
                >
                  <FiDownload size={12} /> Download Invoice PDF
                </button>
              </div>

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

function DeliveryPartnerManager({ onRefreshOrders }) {
  const [open, setOpen]               = useState(false);
  const [partners, setPartners]       = useState([]);
  const [allUsers, setAllUsers]       = useState([]);
  const [busy, setBusy]               = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [removingId, setRemovingId]   = useState(null);
  const [removeText, setRemoveText]   = useState('');

  const load = async () => {
    try {
      const [pRes, uRes] = await Promise.all([
        adminService.getDeliveryPartners(),
        adminService.getUsersForDeliveryAssign(),
      ]);
      setPartners(pRes.data.partners || []);
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
            <p className="text-dark-500 text-xs">{partners.length} active partner{partners.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <span className="text-dark-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-white/5 pt-4">
          {/* Current partners */}
          {partners.length > 0 && (
            <div>
              <p className="text-xs text-dark-500 uppercase tracking-wider mb-2">Active Partners</p>
              <div className="space-y-2">
                {partners.map(p => (
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
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {allUsers.map(u => (
                  <div key={u._id} className="bg-dark-900 rounded-lg border border-white/5 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <div>
                        <p className="text-white text-sm">{u.name}</p>
                        <p className="text-dark-500 text-xs">{u.email}</p>
                      </div>
                      {confirmingId === u._id ? (
                        <button
                          onClick={cancelAssign}
                          className="text-xs text-dark-500 hover:text-white px-2 py-1"
                        >Cancel</button>
                      ) : (
                        <button
                          onClick={() => startAssign(u._id)}
                          disabled={busy}
                          className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                        >
                          <FiUserPlus size={12} /> Assign
                        </button>
                      )}
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
      const unique = Array.from(new Map(combined.map(i => [i._id, i])).values());
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

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl text-white">Delivery Management</h1>
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
        <StatPill label="In Progress" value={counts.progress} color="amber"  icon={FiClock}   active={tab==='progress'}  onClick={() => setTab('progress')} />
        <StatPill label="Shipped"     value={counts.shipped}  color="blue"   icon={FiTruck}   active={tab==='shipped'}   onClick={() => setTab('shipped')} />
        <StatPill label="Delivered"   value={counts.delivered} color="emerald" icon={FiCheck} active={tab==='delivered'} onClick={() => setTab('delivered')} />
      </div>

      {/* Search */}
      <div className="relative">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search order ID, customer, city…"
          className="w-full bg-dark-800 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-violet-500/50"
        />
        <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
      </div>

      {/* Error */}
      {error && <div className="card p-4 border-red-500/20 text-red-400 text-sm">{error}</div>}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-dark-400 text-sm">Loading deliveries…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-dark-400 text-sm">No deliveries in this stage</div>
      ) : (
        <AnimatePresence initial={false}>
          {filtered.map(item => (
            <DeliveryCard key={item._id} item={item} />
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
