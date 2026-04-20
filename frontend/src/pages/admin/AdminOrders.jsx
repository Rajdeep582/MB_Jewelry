import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiChevronDown, FiX, FiAlertCircle, FiRefreshCw, FiSearch,
  FiPackage, FiTruck, FiCheck, FiClock, FiUser, FiMail,
  FiPhone, FiMapPin, FiCreditCard, FiHash, FiCalendar,
  FiChevronUp, FiEdit2, FiFilter, FiExternalLink,
} from 'react-icons/fi';
import { orderService } from '../../services/services';
import {
  formatPrice, formatDate, getOrderStatusColor, getPaymentStatusColor, resolveImageUrl,
} from '../../utils/helpers';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Constants ──────────────────────────────────────────────────────────────────
const DELIVERY_STATUSES = ['confirmed', 'in_production', 'ready_to_ship', 'shipped', 'delivered', 'returned_refunded', 'failed'];

const STATUS_LABELS = {
  confirmed:        'Confirmed',
  in_production:    'In Production',
  ready_to_ship:    'Ready to Ship',
  shipped:          'Shipped',
  delivered:        'Delivered',
  returned_refunded:'Returned & Refunded',
  failed:           'Failed',
};

const PAYMENT_METHOD_LABELS = {
  razorpay: 'Razorpay (Online)',
  cod:      'Cash on Delivery',
};

const QUICK_FILTERS = [
  { label: 'Needs Attention', status: 'needs_attention', paymentStatus: 'all', badgeKey: 'needsAttention' },
  { label: 'Any Status',      status: '',                paymentStatus: 'all' },
  { label: 'All Paid',        status: '',                paymentStatus: 'paid' },
  { label: 'In Production',   status: 'in_production',  paymentStatus: 'all' },
  { label: 'Shipped',         status: 'shipped',         paymentStatus: 'all' },
  { label: 'Delivered',       status: 'delivered',       paymentStatus: 'all' },
  { label: 'Failed',          status: 'failed',          paymentStatus: 'all' },
];

const STATUS_FILTER_OPTIONS = [
  { value: '',                label: 'Any Status' },
  { value: 'needs_attention', label: 'Needs Attention' },
  { value: 'confirmed',       label: 'Confirmed' },
  { value: 'in_production',   label: 'In Production' },
  { value: 'ready_to_ship',   label: 'Ready to Ship' },
  { value: 'shipped',         label: 'Shipped' },
  { value: 'delivered',       label: 'Delivered' },
  { value: 'returned_refunded', label: 'Returned & Refunded' },
  { value: 'failed',          label: 'Failed' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────
function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

// ─── Update Status Modal ────────────────────────────────────────────────────────
function UpdateModal({ order, onClose, onSaved }) {
  const [form, setForm] = useState({
    status:        order.orderStatus,
    paymentStatus: order.payment?.status || 'pending',
    comment:       '',
    estimatedDelivery: order.estimatedDelivery
      ? new Date(order.estimatedDelivery).toISOString().slice(0, 10)
      : '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (['failed', 'returned_refunded'].includes(form.status) && !form.comment.trim()) {
      toast.error('Please provide a reason for this status.');
      return;
    }
    setSaving(true);
    try {
      await orderService.updateOrderStatus(order._id, {
        status:            form.status,
        paymentStatus:     form.paymentStatus,
        comment:           form.comment,
        estimatedDelivery: form.estimatedDelivery || undefined,
      });
      toast.success('Order updated successfully');
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
        className="w-full max-w-lg glass rounded-2xl p-6 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display text-xl text-white">Update Order</h2>
            <p className="text-dark-400 text-xs mt-0.5 font-mono">
              {order.orderId || `#${order._id.slice(-8).toUpperCase()}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-dark-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
            <FiX size={18} />
          </button>
        </div>

        {/* Current state summary */}
        <div className="mb-5 grid grid-cols-2 gap-3 bg-dark-900/60 border border-white/8 p-4 rounded-xl text-xs">
          <div>
            <p className="text-dark-500 mb-1">Current Status</p>
            <span className={getOrderStatusColor(order.orderStatus)}>
              {STATUS_LABELS[order.orderStatus] || order.orderStatus}
            </span>
          </div>
          <div>
            <p className="text-dark-500 mb-1">Payment Status</p>
            <span className={getPaymentStatusColor(order.payment?.status)}>
              {order.payment?.status}
            </span>
          </div>
          <div>
            <p className="text-dark-500 mb-1">Method</p>
            <p className="text-dark-300 font-medium">{PAYMENT_METHOD_LABELS[order.payment?.method] || order.payment?.method}</p>
          </div>
          <div>
            <p className="text-dark-500 mb-1">Amount</p>
            <p className="text-gold-400 font-semibold">{formatPrice(order.totalAmount)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Delivery status */}
          <div>
            <label className="label-dark">New Delivery Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="input-dark"
            >
              {DELIVERY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s] || s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Payment status */}
          <div>
            <label className="label-dark">Payment Status</label>
            <select
              value={form.paymentStatus}
              onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}
              className="input-dark"
            >
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {/* Estimated delivery date (show when shipping-related) */}
          {['ready_to_ship', 'shipped'].includes(form.status) && (
            <div>
              <label className="label-dark">Estimated Delivery Date</label>
              <input
                type="date"
                value={form.estimatedDelivery}
                onChange={(e) => setForm({ ...form, estimatedDelivery: e.target.value })}
                className="input-dark"
              />
            </div>
          )}

          {/* Comment */}
          <div>
            <label className="label-dark">
              {['failed', 'returned_refunded'].includes(form.status)
                ? 'Reason (required)'
                : 'Admin Comment (optional)'}
            </label>
            <input
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              placeholder={
                form.status === 'failed'           ? 'Reason for failure / cancellation…' :
                form.status === 'returned_refunded' ? 'Return or refund reason…' :
                form.status === 'shipped'           ? 'e.g. Dispatched via Blue Dart…' :
                form.status === 'in_production'     ? 'e.g. Crafting started in workshop…' :
                'Admin note…'
              }
              className="input-dark"
              required={['failed', 'returned_refunded'].includes(form.status)}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-gold flex-1 py-2.5 disabled:opacity-60">
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                  Saving…
                </span>
              ) : 'Save Update'}
            </button>
            <button type="button" onClick={onClose} className="btn-dark flex-1 py-2.5">
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Order Detail Drawer ────────────────────────────────────────────────────────
function OrderDetailDrawer({ order, onUpdate }) {
  const [showTimeline, setShowTimeline] = useState(true);
  const reversed = [...(order.trackingHistory || [])].reverse();
  const isCOD = order.payment?.method === 'cod';

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden"
    >
      <div className="bg-dark-900/50 border-t border-white/5 p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT — Items + Pricing */}
        <div className="lg:col-span-2 space-y-4">

          {/* Order items */}
          <div>
            <h4 className="text-dark-400 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FiPackage size={11} /> Order Items
            </h4>
            <div className="space-y-3">
              {order.items?.map((item, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <div className="w-12 h-12 rounded-lg bg-dark-700 overflow-hidden flex-shrink-0 border border-white/5">
                    <img
                      src={resolveImageUrl(item.image) || ''}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{item.name}</p>
                    <p className="text-dark-500 text-xs">
                      Qty {item.quantity} × {formatPrice(item.price)}
                    </p>
                  </div>
                  <p className="text-gold-400 text-sm font-semibold flex-shrink-0">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            {/* Price breakdown */}
            <div className="border-t border-white/8 mt-4 pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-dark-500">
                <span>Subtotal</span><span className="text-dark-300">{formatPrice(order.itemsPrice)}</span>
              </div>
              <div className="flex justify-between text-dark-500">
                <span>Shipping</span>
                <span className="text-dark-300">{order.shippingPrice > 0 ? formatPrice(order.shippingPrice) : 'Free'}</span>
              </div>
              <div className="flex justify-between text-dark-500">
                <span>Tax (GST)</span><span className="text-dark-300">{formatPrice(order.taxPrice)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-white/8 pt-2 mt-1 text-sm">
                <span className="text-white">Total</span>
                <span className="text-gold-500">{formatPrice(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Payment details */}
          <div>
            <h4 className="text-dark-400 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FiCreditCard size={11} /> Payment Details
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-dark-500 mb-0.5">Method</p>
                <div className="flex items-center gap-1.5">
                  {isCOD && (
                    <span className="text-[10px] font-bold border border-blue-500/30 text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full">COD</span>
                  )}
                  <p className="text-dark-300 font-medium">{PAYMENT_METHOD_LABELS[order.payment?.method] || order.payment?.method}</p>
                </div>
              </div>
              <div>
                <p className="text-dark-500 mb-0.5">Status</p>
                <span className={getPaymentStatusColor(order.payment?.status)}>{order.payment?.status}</span>
              </div>
              {order.payment?.paidAt && (
                <div className="col-span-2">
                  <p className="text-dark-500 mb-0.5">Paid At</p>
                  <p className="text-dark-300">{formatDateTime(order.payment.paidAt)}</p>
                </div>
              )}
              {order.payment?.razorpayPaymentId && (
                <div className="col-span-2">
                  <p className="text-dark-500 mb-0.5">Razorpay Payment ID</p>
                  <p className="text-dark-300 font-mono break-all">{order.payment.razorpayPaymentId}</p>
                </div>
              )}
              {order.payment?.failReason && (
                <div className="col-span-2">
                  <p className="text-dark-500 mb-0.5">Failure Reason</p>
                  <p className="text-red-400">{order.payment.failReason}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Customer, Shipping, Timeline */}
        <div className="space-y-4">

          {/* Customer info */}
          <div>
            <h4 className="text-dark-400 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FiUser size={11} /> Customer
            </h4>
            <div className="text-xs space-y-1.5">
              <p className="text-white font-medium flex items-center gap-1.5">
                <FiUser size={10} className="text-dark-500" />
                {order.user?.name || 'N/A'}
              </p>
              <a href={`mailto:${order.user?.email}`} className="text-dark-400 hover:text-gold-400 transition-colors flex items-center gap-1.5">
                <FiMail size={10} className="text-dark-500" />
                {order.user?.email}
              </a>
              {order.shippingAddress?.phone && (
                <p className="text-dark-400 flex items-center gap-1.5">
                  <FiPhone size={10} className="text-dark-500" />
                  {order.shippingAddress.phone}
                </p>
              )}
            </div>
          </div>

          {/* Shipping address */}
          <div>
            <h4 className="text-dark-400 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FiMapPin size={11} /> Shipping Address
            </h4>
            <div className="text-xs text-dark-400 space-y-0.5">
              <p className="text-white font-medium">{order.shippingAddress?.fullName}</p>
              <p>{order.shippingAddress?.addressLine1}</p>
              {order.shippingAddress?.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
              <p>{order.shippingAddress?.city}, {order.shippingAddress?.state} — {order.shippingAddress?.pincode}</p>
              <p>{order.shippingAddress?.country}</p>
            </div>
          </div>

          {/* Delivery timestamps */}
          {(order.dispatchedAt || order.estimatedDelivery || order.deliveredAt || order.deliveryId) && (
            <div>
              <h4 className="text-dark-400 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FiTruck size={11} /> Delivery Info
              </h4>
              <div className="text-xs space-y-1.5">
                {order.deliveryId && (
                  <div>
                    <p className="text-dark-500">Tracking No.</p>
                    <p className="text-white font-mono">MB-{order.deliveryId.replace(/-/g, '').slice(-8).toUpperCase()}</p>
                  </div>
                )}
                {order.dispatchedAt && (
                  <div>
                    <p className="text-dark-500">Dispatched</p>
                    <p className="text-dark-300">{formatDateTime(order.dispatchedAt)}</p>
                  </div>
                )}
                {order.estimatedDelivery && (
                  <div>
                    <p className="text-dark-500">Estimated Delivery</p>
                    <p className="text-dark-300">{formatDateTime(order.estimatedDelivery)}</p>
                  </div>
                )}
                {order.deliveredAt && (
                  <div>
                    <p className="text-dark-500">Delivered</p>
                    <p className="text-green-400 font-medium">{formatDateTime(order.deliveredAt)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status Timeline */}
          {reversed.length > 0 && (
            <div>
              <button
                onClick={() => setShowTimeline(v => !v)}
                className="flex items-center justify-between w-full text-dark-400 text-xs uppercase tracking-wider mb-2 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <FiClock size={11} />
                  Timeline ({reversed.length})
                </span>
                {showTimeline ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
              </button>

              {showTimeline && (
                <div className="space-y-0">
                  {reversed.map((entry, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center w-4 flex-shrink-0">
                        <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                          i === 0 ? 'bg-gold-500' : 'bg-dark-600'
                        }`} />
                        {i < reversed.length - 1 && <div className="flex-1 w-px bg-dark-700 my-0.5" />}
                      </div>
                      <div className="pb-3 flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1 flex-wrap">
                          <p className={`text-xs font-medium capitalize ${i === 0 ? 'text-white' : 'text-dark-400'}`}>
                            {STATUS_LABELS[entry.status] || entry.status.replace(/_/g, ' ')}
                          </p>
                          <time className="text-dark-600 text-[10px] flex-shrink-0">
                            {formatDateTime(entry.timestamp || entry.createdAt)}
                          </time>
                        </div>
                        {entry.comment && (
                          <p className="text-dark-500 text-[11px] mt-0.5 leading-snug">{entry.comment}</p>
                        )}
                        {entry.updatedBy?.name && (
                          <p className="text-dark-600 text-[10px] mt-0.5">by {entry.updatedBy.name}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick action */}
          <button
            onClick={onUpdate}
            className="btn-gold w-full py-2 text-xs flex items-center justify-center gap-1.5"
          >
            <FiEdit2 size={12} /> Update Status
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Order Row ──────────────────────────────────────────────────────────────────
function OrderRow({ order, onUpdate, expanded, onToggle }) {
  const isCOD = order.payment?.method === 'cod';

  return (
    <div className={`border-b border-white/5 last:border-0 transition-all duration-150 ${expanded ? 'bg-white/[0.02]' : 'hover:bg-white/[0.015]'}`}>
      {/* Main row */}
      <div
        className="grid items-center gap-3 py-4 px-5 cursor-pointer select-none"
        style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr) 120px' }}
        onClick={onToggle}
      >
        {/* Order ID + date */}
        <div className="min-w-0">
          <p className="text-gold-400 font-mono text-xs font-semibold tracking-wide truncate">
            {order.orderId || `#${order._id.slice(-8).toUpperCase()}`}
          </p>
          <p className="text-dark-600 text-[10px] mt-1 flex items-center gap-1 truncate">
            <FiCalendar size={9} strokeWidth={2} />
            {formatDate(order.createdAt)}
          </p>
        </div>

        {/* Customer */}
        <div className="min-w-0">
          <p className="text-white text-xs font-medium truncate">{order.user?.name || '—'}</p>
          <p className="text-dark-500 text-[10px] truncate mt-0.5">{order.user?.email || '—'}</p>
        </div>


        {/* Amount */}
        <div className="min-w-0">
          <p className="text-gold-400 font-semibold text-sm tabular-nums truncate">{formatPrice(order.totalAmount)}</p>
        </div>

        {/* Payment status + COD tag */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className={`${getPaymentStatusColor(order.payment?.status)} capitalize truncate`}>
            {order.payment?.status || '—'}
          </span>
          {isCOD && (
            <span className="inline-flex items-center text-[9px] font-bold border border-blue-500/25 text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full leading-none">
              COD
            </span>
          )}
        </div>

        {/* Order status */}
        <div className="min-w-0 flex items-center">
          <span className={`${getOrderStatusColor(order.orderStatus)} capitalize truncate`}>
            {STATUS_LABELS[order.orderStatus] || order.orderStatus || '—'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={onUpdate}
            className="btn-gold px-2.5 py-1.5 text-xs inline-flex items-center gap-1.5 rounded-lg"
          >
            <FiEdit2 size={11} /> Update
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 text-dark-400 hover:text-white transition-colors rounded-lg hover:bg-white/8 border border-white/5"
          >
            {expanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expandable detail drawer */}
      <AnimatePresence>
        {expanded && (
          <OrderDetailDrawer order={order} onUpdate={onUpdate} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main AdminOrders Page ──────────────────────────────────────────────────────
export default function AdminOrders() {
  const [orders,          setOrders]          = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');
  const [statusFilter,    setStatusFilter]    = useState('');          // default: Any Status
  const [paymentFilter,   setPaymentFilter]   = useState('all');
  const [activeQuick,     setActiveQuick]     = useState(1);           // index 1 = "Any Status"
  const [search,          setSearch]          = useState('');
  const [page,            setPage]            = useState(1);
  const [total,           setTotal]           = useState(0);
  const [pages,           setPages]           = useState(1);
  const [stats,           setStats]           = useState(null);
  const [activeModal,     setActiveModal]     = useState(null);
  const [expandedRow,     setExpandedRow]     = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    document.title = 'Orders — Admin';
    orderService.getStats().then(res => setStats(res.data.stats)).catch(() => {});
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await orderService.getAllOrders({
        status:        statusFilter || undefined,
        paymentStatus: paymentFilter,
        page,
        limit: 20,
      });
      setOrders(res.data.orders || []);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, paymentFilter, page]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

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

  // Client-side search over loaded page
  const displayed = search.trim()
    ? orders.filter(o => {
        const q = search.toLowerCase();
        return (
          (o.orderId || '').toLowerCase().includes(q) ||
          o._id.toLowerCase().includes(q) ||
          (o.user?.name  || '').toLowerCase().includes(q) ||
          (o.user?.email || '').toLowerCase().includes(q) ||
          (o.shippingAddress?.city    || '').toLowerCase().includes(q) ||
          (o.shippingAddress?.pincode || '').toLowerCase().includes(q) ||
          o.items?.some(i => (i.name || '').toLowerCase().includes(q))
        );
      })
    : orders;

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-white">Orders</h1>
          <p className="text-dark-400 text-sm mt-0.5">
            {loading ? 'Loading…' : `${total} order${total !== 1 ? 's' : ''} found`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats?.needsAttention > 0 && (
            <button
              onClick={() => applyQuick(0)}
              className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 hover:bg-amber-500/15 transition-colors"
            >
              <FiAlertCircle className="text-amber-400" size={15} />
              <span className="text-amber-300 text-sm font-medium">
                {stats.needsAttention} need{stats.needsAttention > 1 ? '' : 's'} attention
              </span>
            </button>
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

      {/* ── Filters card ─────────────────────────────────────────────────────── */}
      <div className="card p-4 space-y-4">

        {/* Quick filter pills */}
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map((f, idx) => (
            <button
              key={f.label}
              onClick={() => applyQuick(idx)}
              className={`px-3.5 py-1.5 rounded-full text-xs border transition-all flex items-center gap-1.5 ${
                activeQuick === idx
                  ? 'bg-gold-500/15 border-gold-500/50 text-gold-400'
                  : 'border-white/10 text-dark-400 hover:border-white/25 hover:text-dark-200'
              }`}
            >
              {f.label}
              {f.badgeKey && stats?.[f.badgeKey] > 0 && (
                <span className="bg-amber-500 text-dark-900 text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  {stats[f.badgeKey]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Advanced controls row */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search order ID, customer, item, city…"
              className="input-dark pl-8 text-xs py-2 w-full"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white">
                <FiX size={12} />
              </button>
            )}
          </div>

          {/* Status dropdown */}
          <div className="flex items-center gap-1.5">
            <FiFilter size={12} className="text-dark-500" />
            <select
              value={statusFilter}
              onChange={e => handleStatusFilterChange(e.target.value)}
              className="input-dark text-xs py-2 min-w-[160px]"
            >
              {STATUS_FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Payment dropdown */}
          <select
            value={paymentFilter}
            onChange={e => handlePaymentFilterChange(e.target.value)}
            className="input-dark text-xs py-2 min-w-[140px]"
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid Only</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm">
            <FiAlertCircle size={14} /> {error}
          </div>
        )}
      </div>

      {/* ── Orders table ─────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">

        {/* Table header */}
        <div
          className="grid gap-3 py-3 px-5 border-b border-white/8 text-dark-500 text-[10px] uppercase tracking-widest font-semibold"
          style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.5fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.2fr) 120px' }}
        >
          <span>Order</span>
          <span>Customer</span>
          <span>Amount</span>
          <span>Payment</span>
          <span>Status</span>
          <span />
        </div>

        {/* Rows */}
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-b border-white/5 px-4 py-3.5">
              <div className="skeleton h-8 rounded-lg" />
            </div>
          ))
        ) : displayed.length === 0 ? (
          <div className="py-20 text-center text-dark-500 text-sm">
            No orders found for this filter.
          </div>
        ) : displayed.map(order => (
          <OrderRow
            key={order._id}
            order={order}
            expanded={expandedRow === order._id}
            onToggle={() => setExpandedRow(prev => prev === order._id ? null : order._id)}
            onUpdate={() => { setActiveModal(order); setExpandedRow(null); }}
          />
        ))}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
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

      {/* ── Update Modal ─────────────────────────────────────────────────────── */}
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
