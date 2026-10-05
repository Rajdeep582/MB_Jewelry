import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiChevronDown, FiX, FiAlertCircle, FiRefreshCw, FiSearch,
  FiPackage, FiTruck, FiUser, FiMail, FiInbox,
  FiPhone, FiMapPin, FiCreditCard, FiCalendar,
  FiEdit2, FiFilter, FiRadio, FiDownload,
} from 'react-icons/fi';
import PropTypes from 'prop-types';
import { orderService, adminService } from '../../services/services';
import { downloadInvoice } from '../../utils/invoice';
import {
  formatPrice, formatDateTime, formatCalendarDate, getOrderStatusColor, getPaymentStatusColor, resolveImageUrl,
} from '../../utils/helpers';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Chip, KV, SectionTitle, CopyBtn, BillRow, Timeline } from '../../components/admin/OrderDetailUI';

// ─── Constants ──────────────────────────────────────────────────────────────────
const DELIVERY_STATUSES = ['ready_to_ship', 'shipped', 'delivered'];

// Forward-only transitions (mirrors backend DELIVERY_TRANSITIONS, happy-path only)
const STATUS_FORWARD = {
  confirmed:     ['ready_to_ship'],
  ready_to_ship: ['shipped'],
  shipped:       ['delivered'],
  delivered:     [],
};

const STATUS_LABELS = {
  confirmed:        'Confirmed & Processing',
  ready_to_ship:    'Ready to Ship',
  shipped:          'Shipped',
  delivered:        'Delivered',
};

const PAYMENT_METHOD_LABELS = {
  razorpay: 'Razorpay (Online)',
};

const QUICK_FILTERS = [
  { label: 'All Orders',      status: '',                paymentStatus: 'all' },
  { label: 'All Paid',        status: '',                paymentStatus: 'paid' },
  { label: 'Processing',      status: 'confirmed',       paymentStatus: 'all' },
  { label: 'Ready to Ship',   status: 'ready_to_ship',   paymentStatus: 'all' },
  { label: 'Shipped',         status: 'shipped',         paymentStatus: 'all' },
  { label: 'Delivered',       status: 'delivered',       paymentStatus: 'all' },
];

const STATUS_FILTER_OPTIONS = [
  { value: '',                label: 'Any Status' },
  { value: 'confirmed',       label: 'Confirmed & Processing' },
  { value: 'ready_to_ship',   label: 'Ready to Ship' },
  { value: 'shipped',         label: 'Shipped' },
  { value: 'delivered',       label: 'Delivered' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────
function getNotePlaceholder(status) {
  if (status === 'shipped') return 'e.g. Dispatched via courier…';
  if (status === 'delivered') return 'e.g. Delivered to recipient…';
  return 'Admin note…';
}

// ─── Shared PropTypes ───────────────────────────────────────────────────────────
const orderPropType = PropTypes.shape({
  _id: PropTypes.string.isRequired,
  orderId: PropTypes.string,
  orderStatus: PropTypes.string,
  totalAmount: PropTypes.number,
  itemsPrice: PropTypes.number,
  shippingPrice: PropTypes.number,
  taxPrice: PropTypes.number,
  createdAt: PropTypes.string,
  estimatedDelivery: PropTypes.string,
  dispatchedAt: PropTypes.string,
  deliveredAt: PropTypes.string,
  deliveredByPartnerId: PropTypes.string,
  deliveryId: PropTypes.string,
  payment: PropTypes.shape({
    status: PropTypes.string,
    method: PropTypes.string,
    paidAt: PropTypes.string,
    razorpayPaymentId: PropTypes.string,
    failReason: PropTypes.string,
  }),
  user: PropTypes.shape({
    name: PropTypes.string,
    email: PropTypes.string,
  }),
  shippingAddress: PropTypes.shape({
    fullName: PropTypes.string,
    phone: PropTypes.string,
    addressLine1: PropTypes.string,
    addressLine2: PropTypes.string,
    city: PropTypes.string,
    state: PropTypes.string,
    pincode: PropTypes.string,
    country: PropTypes.string,
  }),
  items: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string,
    product: PropTypes.string,
    name: PropTypes.string,
    image: PropTypes.string,
    price: PropTypes.number,
    quantity: PropTypes.number,
  })),
  trackingHistory: PropTypes.arrayOf(PropTypes.shape({
    status: PropTypes.string,
    comment: PropTypes.string,
    timestamp: PropTypes.string,
    createdAt: PropTypes.string,
    updatedBy: PropTypes.shape({ name: PropTypes.string }),
  })),
});

// ─── DP Confirm Block ────────────────────────────────────────────────────────────
function DpConfirmBlock({ order, source, onConfirmed }) {
  const [input, setInput] = useState('');
  const [modal, setModal] = useState(false);
  const [busy, setBusy]   = useState(false);

  const handleConfirm = async () => {
    setModal(false);
    setBusy(true);
    try {
      await adminService.adminConfirmDelivery(order._id, { source });
      toast.success('Order marked as delivered');
      onConfirmed();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to confirm');
    }
    setBusy(false);
    setInput('');
  };

  return (
    <>
      {modal && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-white font-semibold mb-2">Final Delivery Confirmation</h3>
              <p className="text-dark-400 text-sm mb-5">This will permanently mark the order as delivered. This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setModal(false)} className="flex-1 py-2.5 rounded-xl bg-dark-700 text-dark-300 text-sm hover:bg-dark-600 transition-colors">Cancel</button>
                <button onClick={handleConfirm} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors">Confirm Delivered</button>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}
      <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-medium flex-wrap">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          Delivery partner confirmed delivery — awaiting admin confirmation
          {order.dpNote && <span className="text-dark-500 font-normal ml-1 truncate">&ldquo;{order.dpNote}&rdquo;</span>}
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type DELIVERED to confirm"
            className="flex-1 bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-dark-600 focus:outline-none focus:border-emerald-500/40"
          />
          <button
            onClick={() => setModal(true)}
            disabled={busy || input.trim() !== 'DELIVERED'}
            className="px-3 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-600/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </>
  );
}

DpConfirmBlock.propTypes = {
  order:       PropTypes.object.isRequired,
  source:      PropTypes.string.isRequired,
  onConfirmed: PropTypes.func.isRequired,
};

// ─── Update Status Modal ────────────────────────────────────────────────────────
function UpdateModal({ order, onClose, onSaved }) {
  const isPaid = order.payment?.status === 'paid';

  // Forward statuses reachable from current
  const forwardStatuses = (STATUS_FORWARD[order.orderStatus] || []).filter(s =>
    DELIVERY_STATUSES.includes(s)
  );

  const [form, setForm] = useState({
    status: order.orderStatus,   // starts at current (disabled option) for date-only; user must pick forward status
    comment: '',
    estimatedDelivery: order.estimatedDelivery
      ? new Date(order.estimatedDelivery).toISOString().slice(0, 10)
      : '',
  });
  const [saving, setSaving] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const isStatusChanged     = form.status !== order.orderStatus;
  const isDeliverSelected   = form.status === 'delivered';
  const isShippedCurrent    = order.orderStatus === 'shipped';
  const confirmValid        = !isDeliverSelected || confirmText.trim().toUpperCase() === 'DELIVER';

  // Date-only update: order is shipped, status unchanged, estimatedDelivery changed
  const originalDate = order.estimatedDelivery
    ? new Date(order.estimatedDelivery).toISOString().slice(0, 10)
    : '';
  const isDateOnlyUpdate = isShippedCurrent && !isStatusChanged && form.estimatedDelivery !== originalDate;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isDeliverSelected && !confirmValid) {
      toast.error('Please type DELIVER to confirm.');
      return;
    }
    if (!isStatusChanged && !isDateOnlyUpdate) {
      toast.error('Nothing changed — select a new status or update the delivery date.');
      return;
    }
    if (form.status === 'shipped' && isStatusChanged && !form.estimatedDelivery) {
      toast.error('Set an estimated delivery date before marking as Shipped.');
      return;
    }
    setSaving(true);
    try {
      await orderService.updateOrderStatus(order._id, {
        status:            form.status,
        comment:           form.comment || undefined,
        estimatedDelivery: form.estimatedDelivery || undefined,
      });
      toast.success(isDateOnlyUpdate ? 'Delivery date updated' : 'Order updated successfully');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-md max-h-[92vh] overflow-y-auto overscroll-contain glass rounded-2xl p-5 shadow-2xl" data-lenis-prevent="true"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg text-white">Update Order</h2>
            <p className="text-dark-400 text-xs mt-0.5 font-mono">
              {order.orderId || `#${order._id.slice(-8).toUpperCase()}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-dark-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
            <FiX size={18} />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-3 bg-dark-900/60 border border-white/[0.08] px-4 py-3 rounded-xl text-xs">
          <div className="flex-1">
            <p className="text-dark-500 mb-0.5">Current Status</p>
            <span className={getOrderStatusColor(order.orderStatus)}>
              {STATUS_LABELS[order.orderStatus] || order.orderStatus}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-dark-500 mb-0.5">Payment</p>
            <span className={`${getPaymentStatusColor(order.payment?.status)} capitalize`}>
              {order.payment?.status}{isPaid ? ' ✓' : ''}
            </span>
          </div>
          <div className="text-right">
            <p className="text-dark-500 mb-0.5">Amount</p>
            <p className="text-gold-400 font-semibold">{formatPrice(order.totalAmount)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="delivery-status" className="label-dark text-xs">Delivery Status</label>
            <select
              id="delivery-status"
              value={form.status}
              onChange={(e) => { setForm({ ...form, status: e.target.value }); setConfirmText(''); }}
              className="input-dark text-sm"
              disabled={forwardStatuses.length === 0}
            >
              {/* Current status as disabled placeholder */}
              <option value={order.orderStatus} disabled>
                {STATUS_LABELS[order.orderStatus] || order.orderStatus.replaceAll('_', ' ')} (current)
              </option>
              {forwardStatuses.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s] || s.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
            {forwardStatuses.length === 0 && (
              <p className="text-dark-500 text-xs mt-1">No further status updates available.</p>
            )}
          </div>

          {/* Estimated delivery: show when advancing to shipped, or when current is shipped (date edit) */}
          {(form.status === 'shipped' || isShippedCurrent) && (
            <div>
              <label htmlFor="est-delivery-date" className="label-dark text-xs">
                Estimated Delivery Date
                {form.status === 'shipped' && isStatusChanged && <span className="text-red-400 ml-1">*</span>}
                {isShippedCurrent && !isStatusChanged && (
                  <span className="text-dark-500 font-normal ml-1">(editable — updates customer view)</span>
                )}
              </label>
              <input
                id="est-delivery-date"
                type="date"
                value={form.estimatedDelivery}
                onChange={(e) => setForm({ ...form, estimatedDelivery: e.target.value })}
                className={`input-dark text-sm ${form.status === 'shipped' && isStatusChanged && !form.estimatedDelivery ? 'border-red-500/40 focus:border-red-500' : ''}`}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}

          <div>
            <label htmlFor="admin-note" className="label-dark text-xs">Admin Note <span className="text-dark-600 font-normal">(optional)</span></label>
            <input
              id="admin-note"
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              placeholder={getNotePlaceholder(form.status)}
              className="input-dark text-sm"
            />
          </div>

          {isDeliverSelected && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 space-y-2">
              <p className="text-amber-400 text-xs font-medium flex items-center gap-1.5">⚠ This action is final and irreversible</p>
              <p className="text-dark-400 text-xs">Once marked as delivered, this order cannot be edited. Type <span className="text-white font-mono font-bold">DELIVER</span> to confirm.</p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELIVER"
                className="input-dark text-sm font-mono tracking-wider"
                autoComplete="off"
                spellCheck="false"
              />
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || !confirmValid || (!isStatusChanged && !isDateOnlyUpdate)}
              className="btn-gold flex-1 py-2.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />{' '}
                  Saving…
                </span>
              ) : isDateOnlyUpdate ? 'Update Date' : 'Update Status'}
            </button>
            <button type="button" onClick={onClose} className="btn-dark flex-1 py-2.5 text-sm">
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

UpdateModal.propTypes = {
  order: orderPropType.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

// ─── Display helpers ────────────────────────────────────────────────────────────
const displayOrderId = (order) => order.orderId || `#${order._id.slice(-8).toUpperCase()}`;
const trackingNo = (order) => (order.deliveryId ? `MB-${order.deliveryId.replaceAll('-', '').slice(-8).toUpperCase()}` : '');
const customerName = (order) => order.user?.name || order.shippingAddress?.fullName || 'Deleted account';

const PAYMENT_CHIP = {
  paid:     { label: 'Paid',            cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
  pending:  { label: 'Payment pending', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/25' },
  failed:   { label: 'Payment failed',  cls: 'text-red-300 bg-red-500/10 border-red-500/20' },
  refunded: { label: 'Refunded',        cls: 'text-sky-300 bg-sky-500/10 border-sky-500/20' },
};
const paymentChip = (order) => PAYMENT_CHIP[order.payment?.status] || PAYMENT_CHIP.pending;

// ─── Order Details (expanded card) ──────────────────────────────────────────────
function OrderDetails({ order }) {
  const addr = order.shippingAddress || {};
  const pay = order.payment || {};
  const chip = paymentChip(order);
  const gstPct = order.itemsPrice > 0 && order.taxPrice > 0 ? Math.round((order.taxPrice / order.itemsPrice) * 100) : null;
  const itemCount = (order.items || []).reduce((n, it) => n + (it.quantity || 1), 0);
  const hasDelivery = order.deliveryId || order.dispatchedAt || order.estimatedDelivery || order.dpConfirmedAt || order.deliveredAt;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div className="border-t border-white/[0.06] bg-dark-900/50 p-4 grid gap-4 lg:grid-cols-3">

        {/* ── Items & bill ── */}
        <section className="min-w-0">
          <SectionTitle icon={FiPackage} right={<span className="text-[11px] text-dark-500">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>}>Items &amp; bill</SectionTitle>
          <ul className="space-y-2 max-h-56 overflow-y-auto overscroll-contain pr-1" data-lenis-prevent="true">
            {order.items?.map((item) => (
              <li key={item._id || item.product || item.name} className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-lg bg-dark-800 overflow-hidden shrink-0 border border-white/10 flex items-center justify-center">
                  {item.image
                    ? <img src={resolveImageUrl(item.image)} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    : <FiPackage size={14} className="text-dark-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate" title={item.name}>{item.name}</p>
                  <p className="text-dark-500 text-[11px] tabular-nums">{item.quantity} × {formatPrice(item.price)}</p>
                </div>
                <p className="text-dark-100 text-xs font-semibold tabular-nums shrink-0">{formatPrice(item.price * item.quantity)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-2.5 border-t border-white/[0.06] space-y-1 text-xs tabular-nums">
            <BillRow label="Subtotal (excl. GST)">{formatPrice(order.itemsPrice)}</BillRow>
            <BillRow label={`Shipping${addr.pincode ? ` (PIN ${addr.pincode})` : ''}`}>
              {order.shippingPrice > 0 ? formatPrice(order.shippingPrice) : <span className="text-emerald-400">Free</span>}
            </BillRow>
            <BillRow label={`GST${gstPct !== null ? ` (${gstPct}%)` : ''}`}>{formatPrice(order.taxPrice || 0)}</BillRow>
            <BillRow label="Total" strong>{formatPrice(order.totalAmount)}</BillRow>
          </div>
        </section>

        {/* ── Payment & customer ── */}
        <section className="min-w-0 lg:border-l lg:border-white/[0.06] lg:pl-4 space-y-4">
          <div>
            <SectionTitle icon={FiCreditCard} right={<Chip className={chip.cls}>{chip.label}</Chip>}>Payment</SectionTitle>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <KV label="Placed">{formatDateTime(order.createdAt)}</KV>
              <KV label="Paid">{pay.paidAt ? formatDateTime(pay.paidAt) : null}</KV>
              <KV label="Method">{PAYMENT_METHOD_LABELS[pay.method] || pay.method}</KV>
              <KV label="Invoice no." mono>{order.invoiceNumber || null}</KV>
              <KV label="Amount">{formatPrice(order.totalAmount)}</KV>
              {pay.razorpayPaymentId && (
                <div className="col-span-2 min-w-0">
                  <dt className="text-[10px] uppercase tracking-wider text-dark-500">Payment ID</dt>
                  <dd className="flex items-center gap-1 text-xs text-dark-200 font-mono mt-0.5 break-all">{pay.razorpayPaymentId}<CopyBtn value={pay.razorpayPaymentId} label="Payment ID" /></dd>
                </div>
              )}
              <KV label="Failure reason" className="col-span-2">{pay.failReason ? <span className="text-red-400">{pay.failReason}</span> : null}</KV>
            </dl>
            {pay.status === 'paid' && (
              <button
                type="button"
                onClick={() => downloadInvoice(order)}
                className="mt-3 w-full py-2 text-xs inline-flex items-center justify-center gap-1.5 text-gold-300 bg-gold-500/10 border border-gold-500/20 hover:bg-gold-500/20 rounded-xl transition-colors"
              >
                <FiDownload size={12} /> Download tax invoice
              </button>
            )}
          </div>

          <div>
            <SectionTitle icon={FiUser}>Customer</SectionTitle>
            <div className="text-xs space-y-1">
              <p className="text-white font-medium">{customerName(order)}</p>
              {order.user?.email && (
                <a href={`mailto:${order.user.email}`} className="flex items-center gap-1.5 text-dark-400 hover:text-gold-400 break-all"><FiMail size={11} className="shrink-0" />{order.user.email}</a>
              )}
              {(addr.phone || order.user?.phone) && (
                <a href={`tel:${addr.phone || order.user.phone}`} className="flex items-center gap-1.5 text-dark-400 hover:text-gold-400"><FiPhone size={11} className="shrink-0" />{addr.phone || order.user.phone}</a>
              )}
              {addr.addressLine1 && (
                <p className="flex items-start gap-1.5 text-dark-400 pt-0.5">
                  <FiMapPin size={11} className="shrink-0 mt-0.5" />
                  <span>
                    {addr.fullName && addr.fullName !== customerName(order) && <span className="text-dark-200">{addr.fullName}, </span>}
                    {[addr.addressLine1, addr.addressLine2, addr.city, addr.state].filter(Boolean).join(', ')} — <span className="text-dark-200">{addr.pincode}</span>
                  </span>
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Delivery & timeline ── */}
        <section className="min-w-0 lg:border-l lg:border-white/[0.06] lg:pl-4 space-y-4">
          {hasDelivery ? (
            <div>
              <SectionTitle icon={FiTruck}>Delivery</SectionTitle>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                {order.deliveryId && (
                  <div className="col-span-2 min-w-0">
                    <dt className="text-[10px] uppercase tracking-wider text-dark-500">Tracking no.</dt>
                    <dd className="flex items-center gap-1 text-xs text-white font-mono mt-0.5">{trackingNo(order)}<CopyBtn value={trackingNo(order)} label="Tracking number" /></dd>
                  </div>
                )}
                <KV label="Dispatched">{order.dispatchedAt ? formatDateTime(order.dispatchedAt) : null}</KV>
                <KV label="ETA">{order.estimatedDelivery ? formatCalendarDate(order.estimatedDelivery, 'short') : null}</KV>
                <KV label="Partner confirmed">{order.dpConfirmedAt ? formatDateTime(order.dpConfirmedAt) : null}</KV>
                <KV label="Delivered">{order.deliveredAt ? <span className="text-emerald-400">{formatDateTime(order.deliveredAt)}</span> : null}</KV>
                <KV label="Delivered by" className="col-span-2">
                  {order.deliveredByPartnerName || order.deliveredByPartnerId
                    ? <>{order.deliveredByPartnerName}{order.deliveredByPartnerId && <span className="font-mono text-dark-500"> ({order.deliveredByPartnerId})</span>}</>
                    : null}
                </KV>
              </dl>
              {order.dpNote && <p className="mt-2 text-[11px] text-dark-400"><span className="text-dark-500">Partner note:</span> &ldquo;{order.dpNote}&rdquo;</p>}
            </div>
          ) : (
            <div>
              <SectionTitle icon={FiTruck}>Delivery</SectionTitle>
              <p className="text-xs text-dark-500">Not dispatched yet.</p>
            </div>
          )}
          <Timeline entries={order.trackingHistory} labels={STATUS_LABELS} />
        </section>
      </div>
    </motion.div>
  );
}

OrderDetails.propTypes = {
  order: orderPropType.isRequired,
};

// ─── Order Card (list row) ──────────────────────────────────────────────────────
function OrderCard({ order, onUpdate, expanded, onToggle }) {
  const addr = order.shippingAddress || {};
  const chip = paymentChip(order);
  const items = order.items || [];
  const thumb = items.find((it) => it.image)?.image;
  const itemCount = items.reduce((n, it) => n + (it.quantity || 1), 0);
  const awaitingAdmin = order.dpConfirmedAt && order.orderStatus === 'shipped';
  const canUpdate = order.orderStatus !== 'delivered';

  return (
    <div className={`rounded-2xl border transition-colors overflow-hidden ${expanded ? 'border-gold-500/30 bg-white/[0.02]' : 'border-white/[0.07] bg-dark-900/40 hover:border-white/15'}`}>
      <div
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-2.5 p-3 sm:p-3.5 cursor-pointer outline-none focus-visible:bg-white/[0.03] md:gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_9rem] md:items-center"
      >
        {/* Items + id + date */}
        <div className="col-span-2 md:col-span-1 flex items-center gap-3 min-w-0">
          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-dark-800 border border-white/10 shrink-0 flex items-center justify-center">
            {thumb
              ? <img src={resolveImageUrl(thumb)} alt="" className="w-full h-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              : <FiPackage size={18} className="text-dark-500" />}
            {itemCount > 1 && <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/70 text-[9px] text-dark-200">×{itemCount}</span>}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-gold-400 font-mono text-xs font-semibold">{displayOrderId(order)}</span>
              <span className={`${getOrderStatusColor(order.orderStatus)} !text-[10px] !px-2 !py-0.5`}>{STATUS_LABELS[order.orderStatus] || order.orderStatus?.replaceAll('_', ' ') || '—'}</span>
              {awaitingAdmin && <Chip className="text-amber-300 bg-amber-500/10 border-amber-500/25" title="Delivery partner confirmed — awaiting your confirmation"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />DP confirmed</Chip>}
            </div>
            <p className="text-white text-sm font-medium mt-0.5 truncate" title={items.map((it) => `${it.name} ×${it.quantity}`).join(', ')}>
              {items[0]?.name || '—'}
              {items[0]?.quantity > 1 && <span className="text-dark-400 font-normal"> ×{items[0].quantity}</span>}
              {items.length > 1 && <span className="text-dark-400 font-normal"> · +{items.length - 1} more</span>}
            </p>
            <p className="text-[11px] text-dark-500 mt-0.5 flex items-center gap-1"><FiCalendar size={10} /> {formatDateTime(order.createdAt)}</p>
          </div>
        </div>

        {/* Customer */}
        <div className="col-span-2 md:col-span-1 min-w-0 pl-[3.75rem] md:pl-0">
          <p className="text-dark-200 text-xs font-medium truncate flex items-center gap-1.5"><FiUser size={11} className="text-dark-500 shrink-0" />{customerName(order)}</p>
          {(addr.phone || order.user?.email) && <p className="text-[11px] text-dark-500 truncate mt-0.5">{addr.phone || order.user?.email}</p>}
          {addr.city && <p className="text-[11px] text-dark-500 truncate flex items-center gap-1"><FiMapPin size={10} className="shrink-0" />{addr.city} · {addr.pincode}</p>}
        </div>

        {/* Money */}
        <div className="min-w-0 pl-[3.75rem] md:pl-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-gold-400 font-semibold text-sm tabular-nums">{formatPrice(order.totalAmount)}</span>
            <Chip className={chip.cls}>{chip.label}</Chip>
          </div>
          <p className="text-[11px] text-dark-500 mt-1 tabular-nums">
            {itemCount} item{itemCount !== 1 ? 's' : ''} · Shipping {order.shippingPrice > 0 ? formatPrice(order.shippingPrice) : 'free'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1.5 self-end md:self-auto" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="group" aria-label="Order actions">
          {canUpdate && (
            <button type="button" onClick={onUpdate} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-dark-900 bg-gold-500 hover:bg-gold-400 transition-colors">
              <FiEdit2 size={11} /> Update
            </button>
          )}
          <button type="button" onClick={onToggle} className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-white/5 transition-colors" aria-expanded={expanded} aria-label={expanded ? 'Hide details' : 'Show details'}>
            <FiChevronDown size={15} className={`transition-transform duration-200 ${expanded ? 'rotate-180 text-gold-400' : ''}`} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && <OrderDetails order={order} />}
      </AnimatePresence>
    </div>
  );
}

OrderCard.propTypes = {
  order:    orderPropType.isRequired,
  onUpdate: PropTypes.func.isRequired,
  expanded: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
};

// ─── Main AdminOrders Page ──────────────────────────────────────────────────────
export default function AdminOrders() {
  const [orders,          setOrders]          = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');
  const [statusFilter,    setStatusFilter]    = useState('');
  const [paymentFilter,   setPaymentFilter]   = useState('all');
  const [activeQuick,     setActiveQuick]     = useState(0);
  const [search,          setSearch]          = useState('');
  const [query,           setQuery]           = useState(''); // debounced search sent to the server
  const [page,            setPage]            = useState(1);
  const [total,           setTotal]           = useState(0);
  const [pages,           setPages]           = useState(1);
  const [stats,           setStats]           = useState(null);
  const [activeModal,     setActiveModal]     = useState(null);
  const [expandedRow,     setExpandedRow]     = useState(null);
  const [seenCounts,      setSeenCounts]      = useState({});
  const searchRef = useRef(null);

  useEffect(() => {
    document.title = 'Orders — Admin';
    orderService.getStats().then(res => setStats(res.data.stats)).catch(() => {});
  }, []);

  useEffect(() => {
    if (stats?.statusCounts && statusFilter) {
      setSeenCounts(prev => ({ ...prev, [statusFilter]: stats.statusCounts[statusFilter] }));
    }
  }, [stats, statusFilter]);

  // Server-side search (all pages): order ID, tracking no. MB-XXXXXXXX, customer name/email/phone,
  // product, PIN, city, Razorpay payment ID — what a customer quotes when they call support.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await orderService.getAllOrders({
        status:        statusFilter || undefined,
        paymentStatus: paymentFilter,
        search:        query || undefined,
        page,
        limit: 20,
      });
      setOrders(res.data.orders || []);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      if (!silent) setError(err.response?.data?.message || 'Failed to load orders');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [statusFilter, paymentFilter, query, page]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    const interval = setInterval(() => loadOrders(true), 30_000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const applyQuick = (idx) => {
    const f = QUICK_FILTERS[idx];
    setActiveQuick(idx);
    setStatusFilter(f.status);
    setPaymentFilter(f.paymentStatus);
    setPage(1);
    setExpandedRow(null);
  };

  const handleStatusFilterChange = (val) => {
    setStatusFilter(val);
    setPage(1);
    setExpandedRow(null);
    const match = QUICK_FILTERS.findIndex(f => f.status === val && f.paymentStatus === paymentFilter);
    setActiveQuick(match);
  };

  const handlePaymentFilterChange = (val) => {
    setPaymentFilter(val);
    setPage(1);
    setExpandedRow(null);
    const match = QUICK_FILTERS.findIndex(f => f.status === statusFilter && f.paymentStatus === val);
    setActiveQuick(match);
  };

  // Failed-payment records stay hidden in normal views, but are shown when the admin is
  // explicitly looking at failed payments or searching for a specific customer's order.
  const showFailed = paymentFilter === 'failed' || statusFilter === 'needs_attention' || !!query;
  const displayed = orders.filter(o => showFailed || !['failed', 'returned_refunded', 'cancelled'].includes(o.orderStatus));
  const toProcess = (stats?.statusCounts?.confirmed || 0) + (stats?.statusCounts?.ready_to_ship || 0);
  const quickCount = (f) => (f.status ? stats?.statusCounts?.[f.status] : f.paymentStatus === 'paid' ? stats?.totalOrders : null);

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl text-white">Orders</h1>
          <p className="text-dark-400 text-sm mt-0.5 flex items-center gap-2">
            {loading && 'Loading…'}
            {!loading && `${total} order${total !== 1 ? 's' : ''} found`}
            {!loading && (
              <span className="text-dark-600 text-xs flex items-center gap-1">
                <FiRadio size={10} className="text-green-500" />{' '}Auto-sync 30s
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats && (
            <>
              <div className="rounded-xl border border-white/[0.07] bg-dark-900/40 px-3 py-1.5">
                <p className="text-[10px] uppercase tracking-wider text-dark-500">To process</p>
                <p className={`text-sm font-semibold tabular-nums ${toProcess > 0 ? 'text-amber-300' : 'text-dark-300'}`}>{toProcess}</p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-dark-900/40 px-3 py-1.5">
                <p className="text-[10px] uppercase tracking-wider text-dark-500">Revenue</p>
                <p className="text-sm font-semibold tabular-nums text-emerald-400">{formatPrice(stats.totalRevenue || 0)}</p>
              </div>
            </>
          )}
          <button
            onClick={() => { loadOrders(); orderService.getStats().then(r => setStats(r.data.stats)).catch(() => {}); }}
            disabled={loading}
            className="btn-dark p-2 disabled:opacity-50"
            title="Refresh"
          >
            <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex gap-2 -mx-1 px-1 overflow-x-auto scrollbar-hide sm:flex-wrap sm:overflow-visible">
          {QUICK_FILTERS.map((f, idx) => (
            <button
              key={f.label}
              onClick={() => applyQuick(idx)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs border transition-all flex items-center gap-1.5 ${
                activeQuick === idx
                  ? 'bg-gold-500/15 border-gold-500/50 text-gold-400'
                  : 'border-white/10 text-dark-400 hover:border-white/25 hover:text-dark-200'
              }`}
            >
              {f.label}
              {quickCount(f) > 0 && <span className={`tabular-nums text-[10px] ${activeQuick === idx ? 'text-gold-300/80' : 'text-dark-500'}`}>{quickCount(f)}</span>}
              {f.status && stats?.statusCounts?.[f.status] > (seenCounts[f.status] || 0) && f.status !== statusFilter && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="New updates" />
              )}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_9.5rem] items-center">
          <div className="relative min-w-0">
            <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search order ID, tracking no., customer, phone, item, PIN…"
              className="input-dark pl-8 text-xs py-2 w-full"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white">
                <FiX size={12} />
              </button>
            )}
          </div>

          <div className="relative">
            <FiFilter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={e => handleStatusFilterChange(e.target.value)}
              className="input-dark text-xs py-2 pl-8 w-full"
              aria-label="Filter by status"
            >
              {STATUS_FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <select
            value={paymentFilter}
            onChange={e => handlePaymentFilterChange(e.target.value)}
            className="input-dark text-xs py-2 w-full"
            aria-label="Filter by payment"
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid Only</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm">
            <FiAlertCircle size={14} /> {error}
          </div>
        )}
      </div>

      <div>
        {loading && (
          <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, idx) => <div key={`skeleton-${idx}`} className="skeleton h-[74px] rounded-2xl" />)}
          </div>
        )}
        {!loading && displayed.length === 0 && (
          <div className="card py-14 flex flex-col items-center text-center">
            <FiInbox size={26} className="text-dark-600 mb-2" />
            <p className="text-dark-400 text-sm">{query ? `No orders match "${query}".` : 'No orders found for this filter.'}</p>
          </div>
        )}
        {!loading && displayed.length > 0 && (
          <div className="space-y-2.5">
            {displayed.map(order => (
              <OrderCard
                key={order._id}
                order={order}
                expanded={expandedRow === order._id}
                onToggle={() => setExpandedRow(prev => prev === order._id ? null : order._id)}
                onUpdate={() => { setActiveModal(order); setExpandedRow(null); }}
              />
            ))}
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => { setPage(p); setExpandedRow(null); }}
              className={`w-8 h-8 rounded-lg text-xs transition-all ${
                p === page
                  ? 'bg-gold-500 text-dark-900 font-bold'
                  : 'bg-dark-800 text-dark-400 hover:text-white border border-white/10'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {activeModal && (
          <UpdateModal
            order={activeModal}
            onClose={() => setActiveModal(null)}
            onSaved={() => {
              loadOrders();
              orderService.getStats().then(r => setStats(r.data.stats)).catch(() => {});
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
