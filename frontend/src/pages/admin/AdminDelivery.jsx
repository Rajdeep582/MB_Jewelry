import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiMapPin, FiPhone, FiUser, FiPackage, FiSearch,
  FiRefreshCw, FiAlertCircle, FiTruck, FiX, FiCheck,
  FiClock, FiSend, FiCheckCircle, FiCalendar,
  FiChevronDown, FiChevronUp, FiShield, FiZap,
  FiArchive, FiRadio, FiTag,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { orderService, customOrderService } from '../../services/services';
import { formatDate, formatPrice, resolveImageUrl } from '../../utils/helpers';
import toast from 'react-hot-toast';

// ─── Lifecycle constants ──────────────────────────────────────────────────────

// Regular order statuses that appear in the delivery pipeline
const ORDER_DELIVERY_STATUSES = ['confirmed', 'in_production', 'ready_to_ship', 'shipped', 'delivered'];

// Custom order statuses that appear in the delivery pipeline
const CUSTOM_DELIVERY_STATUSES = ['in_production', 'final_payment_pending', 'final_payment_paid', 'ready_to_ship', 'shipped', 'delivered'];

const STATUS_META = {
  confirmed: {
    label: 'Confirmed', color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20', dot: 'bg-yellow-400',
    border: 'border-l-yellow-500/60', pulse: false,
  },
  in_production: {
    label: 'In Production', color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400',
    border: 'border-l-amber-500/60', pulse: true,
  },
  ready_to_ship: {
    label: 'Ready to Ship', color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-400',
    border: 'border-l-blue-500', pulse: true,
  },
  shipped: {
    label: 'In Transit', color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20', dot: 'bg-green-400',
    border: 'border-l-green-500', pulse: true,
  },
  delivered: {
    label: 'Delivered', color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400',
    border: 'border-l-emerald-500', pulse: false,
  },
};

// ─── Normalise any deliverable into a standard shape ─────────────────────────
// sourceType: 'order' | 'custom_order'
function normaliseOrder(raw, sourceType) {
  if (sourceType === 'order') {
    return {
      ...raw,
      _sourceType:  'order',
      _displayStatus: raw.orderStatus,              // confirmed | ready_to_ship | shipped | delivered
      payment: raw.payment,
    };
  }

  // Map custom order status → display status (consolidate active manufacturing stages)
  let displayStatus = raw.status;
  if (['advance_paid', 'in_production', 'final_payment_pending', 'final_payment_paid'].includes(raw.status)) {
    displayStatus = 'in_production';
  }

  // Synthesise a single "item" so the card renders consistently
  const syntheticItem = {
    _id:      raw._id,
    product:  raw._id,
    name:     `Custom ${raw.type} — ${raw.material}${raw.purity && raw.purity !== 'None' ? ` (${raw.purity})` : ''}`,
    image:    raw.referenceImages?.[0]?.url || '',
    price:    raw.totalAmount || 0,
    quantity: 1,
  };

  return {
    _id:              raw._id,
    _sourceType:      'custom_order',
    _displayStatus:   displayStatus,
    _rawStatus:       raw.status,
    user:             raw.user,
    shippingAddress:  raw.shippingAddress,
    totalAmount:      raw.totalAmount || 0,
    items:            [syntheticItem],
    deliveryId:       raw.deliveryId,
    dispatchedAt:     raw.dispatchedAt,
    estimatedDelivery: raw.estimatedDelivery,
    deliveredAt:      raw.deliveredAt,
    trackingHistory:  raw.trackingHistory || [],
    trackingNumber:   raw.trackingNumber,
    createdAt:        raw.createdAt,
    // custom-order-specific extras for the card details panel
    _description:     raw.description,
    _budget:          raw.budget,
    payment:          raw.payment,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskDeliveryId(uuid) {
  if (!uuid) return null;
  return `MB-${uuid.replace(/-/g, '').slice(-8).toUpperCase()}`;
}
function resolveOrderId(item) {
  if (!item) return '—';
  if (item._sourceType === 'order') return item.orderId || `ORD-${String(item._id).slice(-8).toUpperCase()}`;
  if (item._sourceType === 'custom_order') return item.customOrderId || `CUS-${String(item._id).slice(-8).toUpperCase()}`;
  return `ID-${String(item._id).slice(-8).toUpperCase()}`;
}
function resolveUserId(user) {
  if (!user) return '—';
  const idStr = String(user._id || user);
  return user.userId || `USR-${idStr.slice(-6).toUpperCase()}`;
}

function daysUntil(date) {
  if (!date) return null;
  return Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
}
function etaLabel(date) {
  const d = daysUntil(date);
  if (d === null) return null;
  if (d < 0)   return { text: 'Overdue',      cls: 'text-red-400' };
  if (d === 0) return { text: 'Due Today',    cls: 'text-amber-400' };
  if (d === 1) return { text: 'Due Tomorrow', cls: 'text-amber-300' };
  return { text: `${d} days left`, cls: 'text-dark-300' };
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────
function StatPill({ label, value, color = 'gold', icon: Icon }) {
  const colors = {
    gold:    'bg-gold-500/10 border-gold-500/20 text-gold-400',
    blue:    'bg-blue-500/10 border-blue-500/20 text-blue-400',
    green:   'bg-green-500/10 border-green-500/20 text-green-400',
    amber:   'bg-amber-500/10 border-amber-500/20 text-amber-400',
    red:     'bg-red-500/10 border-red-500/20 text-red-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 flex flex-col gap-0.5 ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <p className="text-2xl font-display font-semibold">{value}</p>
        {Icon && <Icon size={16} className="opacity-60" />}
      </div>
      <p className="text-xs opacity-75">{label}</p>
    </div>
  );
}

// ─── Ready to Ship Modal ──────────────────────────────────────────────────────
function ReadyToShipModal({ item, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const isCustom = item._sourceType === 'custom_order';

  const handleConfirm = async () => {
    setSaving(true);
    try {
      if (isCustom) {
        await customOrderService.updateStatus(item._id, { status: 'ready_to_ship', comment: 'Marked ready to ship.' });
      } else {
        await orderService.updateOrderStatus(item._id, { status: 'ready_to_ship', comment: 'Marked ready to ship.' });
      }
      toast.success(`${resolveOrderId(item)} is now Ready to Ship`);
      onSaved(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="w-full max-w-md glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"><FiArchive className="text-blue-400" size={16} /></div>
            <div>
              <h2 className="font-display text-lg text-white">Mark Ready to Ship</h2>
              <p className="text-dark-500 text-xs font-mono">{resolveOrderId(item)} {isCustom && '· Custom Order'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-dark-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"><FiX size={18} /></button>
        </div>
        <div className="bg-dark-900 border border-white/5 rounded-xl p-3 mb-5">
          <p className="text-white text-sm font-medium">{item.user?.name || item.shippingAddress?.fullName}</p>
          <p className="text-dark-500 text-xs mt-0.5">{item.items?.[0]?.name} · {formatPrice(item.totalAmount)}</p>
        </div>
        <p className="text-dark-400 text-sm mb-5">Confirm once the item is packed and ready for pickup by internal courier.</p>
        <div className="flex gap-3">
          <button onClick={handleConfirm} disabled={saving} className="btn-gold flex-1 py-3 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" /> : <><FiArchive size={14} /> Confirm Ready</>}
          </button>
          <button onClick={onClose} className="btn-dark flex-1 py-3">Cancel</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Dispatch Modal ───────────────────────────────────────────────────────────
function DispatchModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    estimatedDelivery: item.estimatedDelivery ? new Date(item.estimatedDelivery).toISOString().split('T')[0] : '',
    comment: '',
  });
  const [saving, setSaving] = useState(false);
  const isCustom = item._sourceType === 'custom_order';

  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { status: 'shipped', estimatedDelivery: form.estimatedDelivery || undefined, comment: form.comment || 'Dispatched via internal courier.' };
      if (isCustom) {
        await customOrderService.updateStatus(item._id, payload);
      } else {
        await orderService.updateOrderStatus(item._id, payload);
      }
      toast.success(`${resolveOrderId(item)} dispatched! Delivery ID generated.`);
      onSaved(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Dispatch failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="w-full max-w-md glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center"><FiSend className="text-gold-400" size={16} /></div>
            <div>
              <h2 className="font-display text-lg text-white">Dispatch Shipment</h2>
              <p className="text-dark-500 text-xs font-mono">{resolveOrderId(item)} {isCustom && '· Custom Order'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-dark-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"><FiX size={18} /></button>
        </div>
        <div className="flex items-center gap-2.5 bg-gold-500/5 border border-gold-500/20 rounded-xl px-3 py-2.5 mb-5">
          <FiShield size={13} className="text-gold-400 flex-shrink-0" />
          <p className="text-xs text-dark-300">A unique <span className="text-gold-400 font-semibold">Delivery ID</span> (MB-XXXXXXXX) will be auto-generated as the internal tracking reference.</p>
        </div>
        <div className="bg-dark-900 border border-white/5 rounded-xl p-3 mb-5 flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">{item.user?.name || item.shippingAddress?.fullName}</p>
            <p className="text-dark-500 text-xs">{item.shippingAddress?.city}, {item.shippingAddress?.state} — {item.shippingAddress?.pincode}</p>
          </div>
          <p className="text-gold-500 font-semibold">{formatPrice(item.totalAmount)}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-dark flex items-center gap-2"><FiCalendar size={12} /> Estimated Delivery Date <span className="text-dark-500 font-normal">(optional)</span></label>
            <input type="date" value={form.estimatedDelivery} min={new Date().toISOString().split('T')[0]} onChange={(e) => field('estimatedDelivery', e.target.value)} className="input-dark" />
          </div>
          <div>
            <label className="label-dark">Internal Note <span className="text-dark-500 font-normal">(optional)</span></label>
            <input value={form.comment} onChange={(e) => field('comment', e.target.value)} placeholder="e.g. Dispatched from workshop, handle with care…" className="input-dark" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-gold flex-1 py-3 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" /> : <><FiSend size={14} /> Dispatch</>}
            </button>
            <button type="button" onClick={onClose} className="btn-dark flex-1 py-3">Cancel</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Delivery Confirm Modal ───────────────────────────────────────────────────
function DeliveryConfirmModal({ item, onClose, onSaved }) {
  const [comment, setComment] = useState('');
  const [saving, setSaving]   = useState(false);
  const isCustom = item._sourceType === 'custom_order';

  const handleConfirm = async () => {

    setSaving(true);
    try {
      const payload = { 
        status: 'delivered', 
        comment: comment.trim() || 'Delivered to recipient.',
      };
      if (isCustom) {
        await customOrderService.updateStatus(item._id, payload);
      } else {
        await orderService.updateOrderStatus(item._id, payload);
      }
      toast.success(`${resolveOrderId(item)} marked as Delivered!`);
      onSaved(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="w-full max-w-md glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><FiCheckCircle className="text-emerald-400" size={16} /></div>
            <div>
              <h2 className="font-display text-lg text-white">Confirm Delivery</h2>
              <p className="text-dark-500 text-xs font-mono">{resolveOrderId(item)} {isCustom && '· Custom Order'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-dark-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"><FiX size={18} /></button>
        </div>
        <div className="bg-dark-900 border border-white/5 rounded-xl p-3 mb-4">
          <p className="text-white text-sm font-medium">{item.user?.name || item.shippingAddress?.fullName}</p>
          {item.deliveryId && <p className="text-gold-400 font-mono text-xs mt-0.5 flex items-center gap-1"><FiShield size={10} /> {maskDeliveryId(item.deliveryId)}</p>}
        </div>
        <p className="text-dark-400 text-sm mb-4">This is a <span className="text-white font-medium">final, irreversible</span> action. Confirm only after physical delivery has been verified.</p>
        

        <div className="mb-5">
          <label className="label-dark">Delivery Note <span className="text-dark-500 font-normal">(optional)</span></label>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Delivered to recipient, signature obtained…" className="input-dark" />
        </div>
        <div className="flex gap-3">
          <button onClick={handleConfirm} disabled={saving} className="btn-gold flex-1 py-3 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" /> : <><FiCheckCircle size={14} /> Confirm Delivered</>}
          </button>
          <button onClick={onClose} className="btn-dark flex-1 py-3">Cancel</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Tracking Timeline ────────────────────────────────────────────────────────
function TrackingTimeline({ history }) {
  if (!history?.length) return null;
  const labels = {
    processing: 'Order Placed', confirmed: 'Payment Confirmed — In Production',
    final_payment_paid: 'Final Payment Received — In Production',
    ready_to_ship: 'Ready to Ship', shipped: 'Dispatched — In Transit',
    delivered: 'Delivered', cancelled: 'Cancelled',
  };
  return (
    <div className="mt-4 pt-4 border-t border-white/5 space-y-2.5">
      <p className="text-xs text-dark-500 uppercase tracking-wider mb-2">Order Timeline</p>
      {[...history].reverse().map((entry, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="w-1.5 h-1.5 rounded-full bg-gold-500/60 mt-2 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 justify-between">
              <p className="text-xs text-white capitalize font-medium">{labels[entry.status] || entry.status?.replace(/_/g, ' ')}</p>
              <p className="text-xs text-dark-600">{formatDate(entry.timestamp || entry.createdAt)}</p>
            </div>
            {entry.comment && <p className="text-xs text-dark-500 mt-0.5">{entry.comment}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Delivery Card ────────────────────────────────────────────────────────────
function DeliveryCard({ item, onReadyToShip, onDispatch, onConfirmDelivery }) {
  const [expanded, setExpanded] = useState(false);
  const meta    = STATUS_META[item._displayStatus] || STATUS_META.confirmed;
  const eta     = etaLabel(item.estimatedDelivery);
  const delivID = maskDeliveryId(item.deliveryId);
  const isCustom = item._sourceType === 'custom_order';

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`card p-5 border-l-4 ${meta.border} transition-shadow hover:shadow-lg hover:shadow-black/20`}>

      {/* Row 1: IDs / Status / Amount */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-gold-400 font-semibold text-sm">{resolveOrderId(item)}</span>

          {/* Source badge */}
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${
            isCustom
              ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
              : 'bg-gold-500/10 border-gold-500/20 text-gold-400'
          }`}>
            <FiTag size={9} /> {isCustom ? 'Custom' : 'Regular'}
          </span>

          {/* Status badge */}
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${meta.pulse ? 'animate-pulse' : ''}`} />
            {meta.label}
          </span>

          {/* Delivery ID (post-dispatch) */}
          {delivID && (
            <span className="inline-flex items-center gap-1 text-xs font-mono bg-gold-500/10 border border-gold-500/30 text-gold-300 px-2.5 py-0.5 rounded-full">
              <FiShield size={9} /> {delivID}
            </span>
          )}

          {/* ETA */}
          {item.estimatedDelivery && eta && (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-dark-800 border border-white/5 ${eta.cls}`}>
              <FiClock size={10} /> {eta.text}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {item.payment && (
            <span className={`text-xs px-2 py-0.5 border rounded border-dark-600 font-mono flex items-center gap-1 text-blue-400 border-blue-500/30`}>
              ONLINE
              {item.payment.status === 'pending' ? ' (PENDING)' : ' (PAID)'}
            </span>
          )}
          <p className="text-gold-500 font-medium text-sm">{formatPrice(item.totalAmount)}</p>
          <p className="text-dark-600 text-xs">{formatDate(item.createdAt)}</p>
        </div>
      </div>

      {/* Linked IDs row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 pb-3 border-b border-white/5 text-xs">
        <span className="text-dark-600">User: <span className="font-mono text-blue-400/70">{resolveUserId(item.user)}</span></span>
        <span className="text-dark-600">Order: <span className="font-mono text-gold-400/70">{resolveOrderId(item)}</span></span>
        {delivID && <span className="text-dark-600">Delivery: <span className="font-mono text-gold-300">{delivID}</span></span>}
        {item.dispatchedAt && <span className="text-dark-600">Dispatched: <span className="text-dark-400">{formatDate(item.dispatchedAt)}</span></span>}
      </div>

      {/* Items + Customer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Items */}
        <div className="space-y-2">
          <p className="text-xs text-dark-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <FiPackage size={10} /> {isCustom ? 'Custom Design' : `Items (${item.items?.length})`}
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide pr-1">
            {item.items?.map((it) => (
              <div key={it._id || it.product} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-dark-800 flex-shrink-0 overflow-hidden border border-white/5">
                  {it.image && <img src={resolveImageUrl(it.image)} alt={it.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{it.name}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-dark-400">Qty {it.quantity} · {formatPrice(it.price)}</p>
                    {!isCustom && <span className="text-dark-600 text-xs font-mono">{it.product?.productId || `PRD-${String(it.product?._id || it.product).slice(-6).toUpperCase()}`}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Custom order description snippet */}
          {isCustom && item._description && (
            <p className="text-xs text-dark-500 line-clamp-2 mt-1 italic">"{item._description}"</p>
          )}
        </div>

        {/* Customer / Address / Delivery Ref */}
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
            <p className="text-sm text-white leading-snug">{item.shippingAddress?.addressLine1}</p>
            {item.shippingAddress?.addressLine2 && <p className="text-sm text-dark-400">{item.shippingAddress.addressLine2}</p>}
            <p className="text-xs text-dark-400 mt-0.5">{item.shippingAddress?.city}, {item.shippingAddress?.state} — {item.shippingAddress?.pincode}</p>
          </div>

          {/* Internal delivery reference (post-dispatch) */}
          {item.deliveryId && item._displayStatus !== 'confirmed' && item._displayStatus !== 'ready_to_ship' && (
            <div className="bg-dark-800 border border-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
              <FiTruck size={12} className="text-gold-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-dark-500 mb-0.5">Internal Delivery Reference</p>
                <span className="font-mono text-gold-400 text-sm font-semibold">{delivID}</span>
              </div>
              {item.estimatedDelivery && (
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-dark-500">ETA</p>
                  <p className={`text-xs font-medium ${eta?.cls || 'text-dark-300'}`}>{formatDate(item.estimatedDelivery)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-white/5">
        {item._displayStatus === 'confirmed' && (
          <button id={`ready-btn-${item._id}`} onClick={() => onReadyToShip(item)}
            className="btn-dark text-xs px-4 py-2 flex items-center gap-2 border border-blue-500/30 text-blue-400 hover:border-blue-500/60 hover:bg-blue-500/5 transition-all">
            <FiArchive size={13} /> Mark Ready to Ship
          </button>
        )}
        {item._displayStatus === 'ready_to_ship' && (
          <button id={`dispatch-btn-${item._id}`} onClick={() => onDispatch(item)}
            className="btn-gold text-xs px-4 py-2 flex items-center gap-2">
            <FiSend size={13} /> Dispatch Shipment
          </button>
        )}
        {item._displayStatus === 'shipped' && (
          <button id={`deliver-btn-${item._id}`} onClick={() => onConfirmDelivery(item)}
            className="text-xs px-4 py-2 flex items-center gap-2 rounded-xl border border-emerald-500/30 text-emerald-400 hover:border-emerald-500/60 hover:bg-emerald-500/5 transition-all">
            <FiCheckCircle size={13} /> Confirm Delivery
          </button>
        )}
        {item._displayStatus === 'delivered' && (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
            <FiCheck size={12} /> Delivered {item.deliveredAt ? `on ${formatDate(item.deliveredAt)}` : ''}
          </span>
        )}
        <button onClick={() => setExpanded((e) => !e)} className="ml-auto text-dark-400 hover:text-white transition-colors flex items-center gap-1 text-xs">
          {expanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
          {expanded ? 'Hide' : 'History'}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <TrackingTimeline history={item.trackingHistory} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AdminDelivery() {
  const [items,        setItems]        = useState([]);
  const [stats,        setStats]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error,        setError]        = useState('');
  const [search,       setSearch]       = useState('');
  const [view,         setView]         = useState('all');

  const [readyModal,    setReadyModal]    = useState(null);
  const [dispatchModal, setDispatchModal] = useState(null);
  const [deliverModal,  setDeliverModal]  = useState(null);

  const pollingRef   = useRef(null);
  const lastRefresh  = useRef(null);

  useEffect(() => { document.title = 'Delivery Management — Admin'; }, []);

  // ── Load unified delivery stats ───────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await orderService.getDeliveryStats();
      setStats(res.data.stats);
    } catch { /* non-fatal */ } finally { setStatsLoading(false); }
  }, []);

  // ── Load all pipeline items (Order + CustomOrder) ─────────────────────────
  const loadItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      // Regular orders: confirmed, ready_to_ship, shipped + recent delivered
      const orderFetches = [
        ...ORDER_DELIVERY_STATUSES.filter((s) => s !== 'delivered').map((s) =>
          orderService.getAllOrders({ status: s, paymentStatus: 'all', limit: 100 })
        ),
        orderService.getAllOrders({ status: 'delivered', paymentStatus: 'all', limit: 25 }),
      ];

      // Custom orders: delivery-relevant statuses
      const customFetches = CUSTOM_DELIVERY_STATUSES.map((s) =>
        customOrderService.getAllOrders({ status: s, limit: 100 })
      );

      const [orderResults, customResults] = await Promise.all([
        Promise.all(orderFetches),
        Promise.all(customFetches),
      ]);

      const rawOrders  = orderResults.flatMap((r) => r.data.orders || []);
      const rawCustoms = customResults.flatMap((r) => r.data.orders || []);

      const normOrders  = rawOrders.map((o) => normaliseOrder(o, 'order'));
      const normCustoms = rawCustoms.map((o) => normaliseOrder(o, 'custom_order'));

      // Deduplicate and sort newest first
      const combined = [...normOrders, ...normCustoms];
      const unique   = Array.from(new Map(combined.map((i) => [i._id, i])).values());
      unique.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setItems(unique);
      lastRefresh.current = new Date();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load delivery data');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadItems(); loadStats(); }, [loadItems, loadStats]);

  // ── 30-second auto-polling ────────────────────────────────────────────────
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      loadItems(true);
      loadStats();
    }, 30_000);
    return () => clearInterval(pollingRef.current);
  }, [loadItems, loadStats]);

  const afterSave   = () => { loadItems(true); loadStats(); };
  const handleRefresh = () => { loadItems(); loadStats(); };

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = items.filter((o) => {
    if (view === 'confirmed'      && o._displayStatus !== 'confirmed')     return false;
    if (view === 'production'     && o._displayStatus !== 'in_production') return false;
    if (view === 'ready_to_ship'  && o._displayStatus !== 'ready_to_ship') return false;
    if (view === 'in_transit'     && o._displayStatus !== 'shipped')       return false;
    if (view === 'delivered'      && o._displayStatus !== 'delivered')     return false;
    if (view === 'all'            && o._displayStatus === 'delivered')     return false;
    if (view === 'orders'         && o._sourceType !== 'order')            return false;
    if (view === 'custom_orders'  && o._sourceType !== 'custom_order')     return false;

    const q = search.toLowerCase();
    if (!q) return true;
    return (
      o._id.toLowerCase().includes(q) ||
      (o.user?.name  || '').toLowerCase().includes(q) ||
      (o.user?.email || '').toLowerCase().includes(q) ||
      (o.shippingAddress?.city    || '').toLowerCase().includes(q) ||
      (o.shippingAddress?.pincode || '').toLowerCase().includes(q) ||
      (o.items?.[0]?.name || '').toLowerCase().includes(q) ||
      (o.deliveryId ? maskDeliveryId(o.deliveryId).toLowerCase().includes(q) : false) ||
      resolveOrderId(o).toLowerCase().includes(q)
    );
  });

  const counts = {
    all:          items.filter((o) => o._displayStatus !== 'delivered').length,
    confirmed:    items.filter((o) => o._displayStatus === 'confirmed').length,
    production:   items.filter((o) => o._displayStatus === 'in_production').length,
    ready_to_ship:items.filter((o) => o._displayStatus === 'ready_to_ship').length,
    in_transit:   items.filter((o) => o._displayStatus === 'shipped').length,
    delivered:    items.filter((o) => o._displayStatus === 'delivered').length,
    orders:       items.filter((o) => o._sourceType === 'order').length,
    custom_orders:items.filter((o) => o._sourceType === 'custom_order').length,
  };

  const overdueCount = items.filter((o) =>
    o._displayStatus === 'shipped' && daysUntil(o.estimatedDelivery) !== null && daysUntil(o.estimatedDelivery) < 0
  ).length;

  const TABS = [
    { key: 'all',           label: 'Pipeline',       count: counts.all           },
    { key: 'confirmed',     label: 'Confirmed',      count: counts.confirmed     },
    { key: 'production',    label: 'In Production',  count: counts.production    },
    { key: 'ready_to_ship', label: 'Ready to Ship',  count: counts.ready_to_ship },
    { key: 'in_transit',    label: 'In Transit',     count: counts.in_transit    },
    { key: 'delivered',     label: 'Delivered',      count: counts.delivered     },
    { key: 'orders',        label: 'Regular Orders', count: counts.orders        },
    { key: 'custom_orders', label: 'Custom Orders',  count: counts.custom_orders },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-white">Delivery Management</h1>
          <p className="text-dark-400 text-sm mt-0.5 flex items-center gap-2">
            {loading ? 'Loading…' : `${counts.all} in pipeline · ${counts.in_transit} in transit · ${counts.orders} regular + ${counts.custom_orders} custom`}
            {lastRefresh.current && !loading && (
              <span className="text-dark-600 text-xs flex items-center gap-1"><FiRadio size={10} className="text-green-500" /> Auto-sync every 30s</span>
            )}
          </p>
        </div>
        <button onClick={handleRefresh} disabled={loading} className="btn-dark text-sm flex items-center gap-2 disabled:opacity-50">
          <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatPill label="Confirmed"      value={statsLoading ? '…' : (stats?.confirmed      || 0)} color="yellow"  icon={FiPackage}     />
        <StatPill label="In Production"  value={statsLoading ? '…' : (stats?.in_production  || 0)} color="amber"   icon={FiClock}     />
        <StatPill label="Ready to Ship"  value={statsLoading ? '…' : (stats?.ready_to_ship  || 0)} color="blue"    icon={FiArchive}     />
        <StatPill label="In Transit"     value={statsLoading ? '…' : (stats?.shipped        || 0)} color="green"   icon={FiTruck}       />
        <StatPill label="Delivered"      value={statsLoading ? '…' : (stats?.delivered      || 0)} color="emerald" icon={FiCheckCircle} />
        <StatPill label="Overdue ETA"    value={statsLoading ? '…' : overdueCount}                  color={overdueCount > 0 ? 'red' : 'gold'} icon={FiAlertCircle} />
        <StatPill label="Total Pipeline" value={statsLoading ? '…' : (stats?.pipeline       || 0)} color="gold"    icon={FiZap}         />
      </div>

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
          <FiAlertCircle className="text-red-400 flex-shrink-0" size={16} />
          <span className="text-red-300"><strong>{overdueCount}</strong> shipment{overdueCount > 1 ? 's are' : ' is'} past estimated delivery date.</span>
        </div>
      )}

      {/* Controls */}
      <div className="card p-4 space-y-4">
        <div className="relative">
          <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order ID, delivery ID, customer, item name, city…"
            className="input-dark pl-9 text-sm w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS.map(({ key, label, count }) => (
            <button key={key} onClick={() => setView(key)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs transition-all border ${
                view === key ? 'bg-gold-500/15 border-gold-500/50 text-gold-400' : 'border-white/10 text-dark-400 hover:border-white/30'
              }`}>
              {label}
              <span className={`text-xs font-semibold rounded-full px-1.5 py-0.5 ${view === key ? 'bg-gold-500/20 text-gold-300' : 'bg-dark-700 text-dark-500'}`}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
          <FiAlertCircle size={16} /> {error}
        </div>
      )}

      {/* Cards */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="skeleton h-5 rounded w-1/4" />
              <div className="skeleton h-4 rounded w-2/3" />
              <div className="skeleton h-4 rounded w-1/2" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center p-16 bg-dark-900/60 rounded-2xl border border-white/5">
            <FiTruck size={36} className="mx-auto mb-4 text-dark-700" />
            <p className="text-dark-400 text-sm">{search ? `No deliveries matching "${search}"` : 'No deliveries in this view'}</p>
          </div>
        ) : (
          filtered.map((item) => (
            <DeliveryCard key={`${item._sourceType}-${item._id}`} item={item}
              onReadyToShip={(i)     => setReadyModal(i)}
              onDispatch={(i)        => setDispatchModal(i)}
              onConfirmDelivery={(i) => setDeliverModal(i)}
            />
          ))
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {readyModal    && <ReadyToShipModal    item={readyModal}    onClose={() => setReadyModal(null)}    onSaved={afterSave} />}
        {dispatchModal && <DispatchModal       item={dispatchModal} onClose={() => setDispatchModal(null)} onSaved={afterSave} />}
        {deliverModal  && <DeliveryConfirmModal item={deliverModal} onClose={() => setDeliverModal(null)}  onSaved={afterSave} />}
      </AnimatePresence>
    </div>
  );
}
