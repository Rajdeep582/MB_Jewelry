import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FiPackage, FiChevronRight, FiTruck, FiCheck, FiAlertCircle,
  FiRefreshCw, FiClock, FiMapPin, FiPhone, FiUser, FiCreditCard,
  FiCalendar, FiHash, FiChevronDown, FiArrowLeft, FiFilter,
} from 'react-icons/fi';
import { orderService } from '../services/services';
import { formatPrice, getOrderStatusColor, getPaymentStatusColor, resolveImageUrl } from '../utils/helpers';
import { OrderCardSkeleton } from '../components/common/Skeletons';
import toast from 'react-hot-toast';
import PropTypes from 'prop-types';

// ─── Constants ─────────────────────────────────────────────────────────────────
const STATUS_STEPS = ['confirmed', 'ready_to_ship', 'shipped', 'delivered'];

const STATUS_LABELS = {
  confirmed:        'Confirmed & Processing',
  ready_to_ship:    'Ready to Ship',
  shipped:          'Shipped',
  delivered:        'Delivered',
};

const STATUS_DESCRIPTIONS = {
  confirmed:        'Your order has been placed and is being prepared.',
  ready_to_ship:    'Your order is packed and ready for dispatch.',
  shipped:          'Your order is on its way to you.',
  delivered:        'Your order has been delivered successfully.',
};

const PAYMENT_METHOD_LABELS = {
  razorpay: 'Online (Razorpay)',
};

const FILTER_OPTIONS = [
  { value: 'all',            label: 'Any Status' },
  { value: 'confirmed',      label: 'Processing' },
  { value: 'ready_to_ship',  label: 'Ready to Ship' },
  { value: 'shipped',        label: 'Shipped' },
  { value: 'delivered',      label: 'Delivered' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function getStepIcon(step, i, idx) {
  if (i <= idx) return <FiCheck size={13} className="text-dark-900" />;
  switch (step) {
    case 'confirmed':     return <FiHash size={12} />;
    case 'ready_to_ship': return <FiCalendar size={12} />;
    case 'shipped':       return <FiTruck size={12} />;
    case 'delivered':     return <FiCheck size={12} />;
    default:              return <FiCheck size={12} />;
  }
}

// ─── Progress Stepper ─────────────────────────────────────────────────────────
function OrderProgressStepper({ order }) {
  // Map old statuses like in_production to nearest step
  let mappedStatus = order.orderStatus;
  if (mappedStatus === 'in_production') mappedStatus = 'confirmed';

  const idx = STATUS_STEPS.indexOf(mappedStatus);

  // Build a map of when each status was reached from tracking history
  const stepTimestamps = {};
  (order.trackingHistory || []).forEach(entry => {
    if (!stepTimestamps[entry.status]) stepTimestamps[entry.status] = entry.timestamp;
  });

  // With 4 steps each flex-1, dot centers sit at 12.5%, 37.5%, 62.5%, 87.5%
  const stepCount = STATUS_STEPS.length;
  const trackStart = `${100 / (stepCount * 2)}%`;   // 12.5%
  const trackEnd   = trackStart;                     // same from right
  const trackTotal = 100 - (100 / stepCount);         // 75%
  const fillPct    = idx < 0 ? 0 : (idx / (stepCount - 1)) * trackTotal;

  return (
    <div className="mt-5">
      <div className="relative">
        {/* Background track */}
        <div
          className="absolute top-4 h-0.5 bg-dark-700 z-0"
          style={{ left: trackStart, right: trackEnd }}
        />
        {/* Filled track */}
        <div
          className="absolute top-4 h-0.5 bg-gold-500 z-0 transition-all duration-700"
          style={{
            left: trackStart,
            width: `${fillPct}%`,
          }}
        />

        <div className="flex justify-between relative z-10">
          {STATUS_STEPS.map((step, i) => {
            const reached = i <= idx;
            const ts      = stepTimestamps[step];
            return (
              <div key={step} className="flex flex-col items-center gap-1.5 flex-1">
                {/* Node — solid gold for all reached steps */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 flex-shrink-0 ${
                  reached
                    ? 'bg-gold-500 border-gold-500 text-dark-900'
                    : 'border-dark-600 bg-dark-800 text-dark-600'
                }`}>
                  {getStepIcon(step, i, idx)}
                </div>
                {/* Label */}
                <p className={`text-xs text-center leading-tight max-w-[80px] hidden sm:block ${
                  reached ? 'text-gold-400 font-medium' : 'text-dark-600'
                }`}>
                  {STATUS_LABELS[step]}
                </p>
                {/* Timestamp */}
                {ts && (
                  <p className="text-dark-500 text-[10px] text-center hidden md:block leading-tight max-w-[80px]">
                    {formatDateTime(ts)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current status description */}
      <div className="mt-6 flex items-center gap-2 text-sm">
        <FiClock size={14} className="text-gold-400 flex-shrink-0" />
        <span className="text-dark-300">{STATUS_DESCRIPTIONS[mappedStatus] || 'Status updating…'}</span>
      </div>
    </div>
  );
}

OrderProgressStepper.propTypes = {
  order: PropTypes.shape({
    orderStatus: PropTypes.string.isRequired,
    trackingHistory: PropTypes.arrayOf(PropTypes.shape({
      status: PropTypes.string,
      timestamp: PropTypes.string,
    })),
  }).isRequired,
};

// ─── Timeline Entry ───────────────────────────────────────────────────────────
function TimelineEntry({ entry, isFirst, isLast }) {
  const label = STATUS_LABELS[entry.status] || entry.status.replaceAll(/_/g, ' ');
  return (
    <div className="flex gap-4">
      {/* spine */}
      <div className="flex flex-col items-center w-6 flex-shrink-0">
        <div className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0 bg-gold-500 border-2 border-gold-500" />
        {!isLast && <div className="flex-1 w-px bg-gold-500/30 my-1" />}
      </div>
      {/* content */}
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-1">
          <p className={`text-sm font-medium capitalize ${isFirst ? 'text-white' : 'text-dark-200'}`}>
            {label}
          </p>
          <time className="text-xs text-dark-500 flex-shrink-0 flex items-center gap-1">
            <FiClock size={10} />
            {formatDateTime(entry.timestamp || entry.createdAt)}
          </time>
        </div>
        {entry.comment && (
          <p className="text-dark-400 text-xs mt-0.5 leading-relaxed">{entry.comment}</p>
        )}
        {entry.updatedBy?.name && (
          <p className="text-dark-600 text-xs mt-0.5 flex items-center gap-1">
            <FiUser size={9} />
            Updated by {entry.updatedBy.name}
          </p>
        )}
      </div>
    </div>
  );
}

TimelineEntry.propTypes = {
  entry: PropTypes.shape({
    status: PropTypes.string.isRequired,
    timestamp: PropTypes.string,
    createdAt: PropTypes.string,
    comment: PropTypes.string,
    updatedBy: PropTypes.shape({
      name: PropTypes.string,
    }),
  }).isRequired,
  isFirst: PropTypes.bool.isRequired,
  isLast: PropTypes.bool.isRequired,
};

// ─── Order Detail View ────────────────────────────────────────────────────────
function OrderDetailView({ id }) {
  const [order,    setOrder]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);

  useEffect(() => {
    setLoading(true);
    orderService.getOrder(id)
      .then(res => setOrder(res.data.order))
      .catch(() => toast.error('Could not load order.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleRetryVerify = async () => {
    setRetrying(true);
    try {
      const res = await orderService.retryVerify(id);
      toast.success(res.data.message || 'Order recovered!');
      setOrder(res.data.order);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not confirm payment. Please contact support.', { duration: 7000 });
    } finally {
      setRetrying(false);
    }
  };

  if (loading) return <OrderCardSkeleton />;
  if (!order)  return <p className="text-dark-400 text-center py-12">Order not found.</p>;

  const reversed = [...(order.trackingHistory || [])].reverse();

  return (
    <div className="space-y-5">

      {/* ── Header Card ──────────────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-1">
          <div>
            <p className="text-dark-500 text-xs mb-1 flex items-center gap-1.5">
              <FiHash size={11} /> Order ID
            </p>
            <h2 className="text-white font-semibold font-mono text-lg">
              {order.orderId || `#${order._id.slice(-8).toUpperCase()}`}
            </h2>
            <p className="text-dark-500 text-xs mt-1 flex items-center gap-1">
              <FiCalendar size={10} />
              Placed on {formatDateTime(order.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className={getPaymentStatusColor(order.payment?.status)}>
              {order.payment?.status}
            </span>
            <span className={getOrderStatusColor(order.orderStatus)}>
              {STATUS_LABELS[order.orderStatus] || order.orderStatus}
            </span>
          </div>
        </div>

        {/* Progress stepper */}
        <OrderProgressStepper order={order} />
      </div>

      {/* ── Payment Recovery Banner ──────────────────────────────────────────── */}
      {order.payment?.status === 'failed' && order.payment?.razorpayOrderId && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3 mb-4">
            <FiAlertCircle className="text-amber-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-white font-medium mb-1">Payment status unclear</p>
              <p className="text-dark-400 text-sm leading-relaxed">
                Your payment may have been captured by Razorpay but we couldn't confirm it due to a
                network issue. Click below to securely check and recover your order.
              </p>
            </div>
          </div>
          <button
            id="retry-verify-btn"
            onClick={handleRetryVerify}
            disabled={retrying}
            className="btn-gold w-full py-3 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {retrying ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                {' '}Checking with Razorpay…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <FiRefreshCw size={15} /> Recover My Order
              </span>
            )}
          </button>
        </div>
      )}


      {/* ── Payment Details ───────────────────────────────────────────────────── */}
      <div className="card p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <FiCreditCard size={15} className="text-gold-400" />
          Payment Details
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-dark-500 text-xs mb-0.5">Method</p>
            <p className="text-white font-medium">{PAYMENT_METHOD_LABELS[order.payment?.method] || order.payment?.method}</p>
          </div>
          <div>
            <p className="text-dark-500 text-xs mb-0.5">Payment Status</p>
            <p className="text-white font-medium capitalize">{order.payment?.status}</p>
          </div>
          {order.payment?.paidAt && (
            <div>
              <p className="text-dark-500 text-xs mb-0.5">Paid At</p>
              <p className="text-white font-medium">{formatDateTime(order.payment.paidAt)}</p>
            </div>
          )}
          {order.payment?.razorpayPaymentId && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-dark-500 text-xs mb-0.5">Razorpay Payment ID</p>
              <p className="text-white font-mono text-xs break-all">{order.payment.razorpayPaymentId}</p>
            </div>
          )}

          {order.payment?.failReason && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-dark-500 text-xs mb-0.5">Failure Reason</p>
              <p className="text-red-400 text-xs">{order.payment.failReason}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Order Items ───────────────────────────────────────────────────────── */}
      <div className="card p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <FiPackage size={15} className="text-gold-400" />
          Order Items
        </h3>
        <div className="space-y-4">
          {order.items.map((item, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-dark-700 flex-shrink-0 border border-white/5">
                <img
                  src={resolveImageUrl(item.image) || ''}
                  alt={item.name}
                  className="w-full h-full object-cover"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium leading-snug">{item.name}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                  <p className="text-dark-500 text-xs">Qty: <span className="text-dark-300">{item.quantity}</span></p>
                  <p className="text-dark-500 text-xs">Unit: <span className="text-dark-300">{formatPrice(item.price)}</span></p>
                </div>
              </div>
              <p className="text-gold-500 text-sm font-semibold flex-shrink-0">
                {formatPrice(item.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>

        {/* Price breakdown */}
        <div className="border-t border-white/8 mt-5 pt-4 space-y-2 text-sm">
          <div className="flex justify-between text-dark-400">
            <span>Subtotal</span>
            <span className="text-white">{formatPrice(order.itemsPrice)}</span>
          </div>
          <div className="flex justify-between text-dark-400">
            <span>Shipping</span>
            <span className="text-white">{order.shippingPrice > 0 ? formatPrice(order.shippingPrice) : 'Free'}</span>
          </div>
          <div className="flex justify-between text-dark-400">
            <span>Tax (GST)</span>
            <span className="text-white">{formatPrice(order.taxPrice)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-white/8 pt-3 mt-1">
            <span className="text-white">Total</span>
            <span className="text-gold-500 text-base">{formatPrice(order.totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* ── Shipping & Delivery ───────────────────────────────────────────────── */}
      <div className="card p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <FiMapPin size={15} className="text-gold-400" />
          Shipping Details
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-dark-500 text-xs mb-2">Delivery Address</p>
            <p className="text-white text-sm font-medium">{order.shippingAddress.fullName}</p>
            <p className="text-dark-400 text-sm">{order.shippingAddress.addressLine1}</p>
            {order.shippingAddress.addressLine2 && (
              <p className="text-dark-400 text-sm">{order.shippingAddress.addressLine2}</p>
            )}
            <p className="text-dark-400 text-sm">
              {order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.pincode}
            </p>
            <p className="text-dark-400 text-sm">{order.shippingAddress.country}</p>
            <p className="text-dark-400 text-sm flex items-center gap-1 mt-1">
              <FiPhone size={11} /> {order.shippingAddress.phone}
            </p>
          </div>
          <div className="space-y-3">
            {order.deliveredAt && (
              <div>
                <p className="text-dark-500 text-xs mb-0.5">Delivered On</p>
                <p className="text-green-400 text-sm font-medium">{formatDateTime(order.deliveredAt)}</p>
              </div>
            )}
            {order.dispatchedAt && (
              <div>
                <p className="text-dark-500 text-xs mb-0.5">Dispatched On</p>
                <p className="text-white text-sm">{formatDateTime(order.dispatchedAt)}</p>
              </div>
            )}
            {order.estimatedDelivery && (
              <div>
                <p className="text-dark-500 text-xs mb-0.5">Estimated Delivery</p>
                <p className="text-white text-sm">{formatDateTime(order.estimatedDelivery)}</p>
              </div>
            )}
            {order.deliveryId && (
              <div>
                <p className="text-dark-500 text-xs mb-0.5">Tracking Number</p>
                <p className="text-white text-sm font-mono">
                  MB-{order.deliveryId.replace(/-/g, '').slice(-8).toUpperCase()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Full Status Timeline ──────────────────────────────────────────────── */}
      {reversed.length > 0 && (
        <div className="card p-5">
          <button
            onClick={() => setShowTimeline(v => !v)}
            className="w-full flex items-center justify-between text-white font-semibold mb-1 group"
          >
            <span className="flex items-center gap-2">
              <FiClock size={15} className="text-gold-400" />
              Order Timeline
              <span className="text-dark-500 text-xs font-normal">({reversed.length} events)</span>
            </span>
            <FiChevronDown
              size={16}
              className={`text-dark-400 group-hover:text-white transition-transform duration-200 ${showTimeline ? 'rotate-180' : ''}`}
            />
          </button>

          {showTimeline && (
            <div className="mt-4">
              {reversed.map((entry, i) => (
                <TimelineEntry
                  key={i}
                  entry={entry}
                  isFirst={i === 0}
                  isLast={i === reversed.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

OrderDetailView.propTypes = {
  id: PropTypes.string.isRequired,
};

// ─── Order List Card ──────────────────────────────────────────────────────────
function OrderCard({ order }) {
  return (
    <Link to={`/orders/${order._id}`} className="block card-hover p-4 group">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs text-dark-500 mb-0.5 font-mono">
            {order.orderId || `#${order._id.slice(-8).toUpperCase()}`}
          </p>
          <p className="text-dark-500 text-xs flex items-center gap-1">
            <FiCalendar size={10} /> {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={getPaymentStatusColor(order.payment?.status)}>
            {order.payment?.status}
          </span>
          <span className={getOrderStatusColor(order.orderStatus)}>
            {STATUS_LABELS[order.orderStatus] || order.orderStatus}
          </span>
          <FiChevronRight size={14} className="text-dark-500 group-hover:text-gold-400 transition-colors" />
        </div>
      </div>

      {/* Product thumbnails */}
      <div className="flex gap-2 mb-3">
        {order.items.slice(0, 4).map((item, i) => (
          <div key={i} className="w-11 h-11 rounded-lg overflow-hidden bg-dark-700 flex-shrink-0 border border-white/5">
            <img
              src={resolveImageUrl(item.image) || ''}
              alt={item.name}
              className="w-full h-full object-cover"
              onError={e => { e.target.style.display = 'none'; }}
            />
          </div>
        ))}
        {order.items.length > 4 && (
          <div className="w-11 h-11 rounded-lg bg-dark-700 flex items-center justify-center text-dark-400 text-xs border border-white/5">
            +{order.items.length - 4}
          </div>
        )}
      </div>

      {/* Item names */}
      <p className="text-dark-400 text-xs mb-2 line-clamp-1">
        {order.items.map(i => i.name).join(', ')}
      </p>

      <div className="flex justify-between items-center">
        <p className="text-dark-500 text-xs">{order.items.length} item{order.items.length > 1 ? 's' : ''}</p>
        <p className="text-gold-500 font-semibold">{formatPrice(order.totalAmount)}</p>
      </div>
    </Link>
  );
}

OrderCard.propTypes = {
  order: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    orderId: PropTypes.string,
    createdAt: PropTypes.string,
    orderStatus: PropTypes.string.isRequired,
    totalAmount: PropTypes.number.isRequired,
    payment: PropTypes.shape({
      status: PropTypes.string,
    }),
    items: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
      image: PropTypes.string,
    })).isRequired,
  }).isRequired,
};

// ─── Orders List View ─────────────────────────────────────────────────────────
function OrdersListView() {
  const [allOrders, setAllOrders] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState('all');

  useEffect(() => {
    document.title = 'My Orders — M&B Jewelry';
    orderService.getMyOrders()
      .then(res => setAllOrders(res.data.orders || []))
      .catch(() => toast.error('Failed to load orders.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return allOrders;
    return allOrders.filter(o => o.orderStatus === filter);
  }, [allOrders, filter]);

  const counts = useMemo(() => {
    const c = { all: allOrders.length };
    FILTER_OPTIONS.forEach(({ value }) => {
      if (value !== 'all') c[value] = allOrders.filter(o => o.orderStatus === value).length;
    });
    return c;
  }, [allOrders]);

  return (
    <>
      {/* Filter bar */}
      {!loading && allOrders.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FiFilter size={13} className="text-dark-400" />
            <span className="text-dark-400 text-xs">Filter by status</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map(({ value, label }) => {
              const count = counts[value] || 0;
              if (value !== 'all' && count === 0) return null;
              return (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-all flex items-center gap-1.5 ${
                    filter === value
                      ? 'bg-gold-500/15 border-gold-500/50 text-gold-400'
                      : 'border-white/10 text-dark-400 hover:border-white/25'
                  }`}
                >
                  {label}
                  <span className={`text-xs font-bold rounded-full px-1 ${
                    filter === value ? 'text-gold-300' : 'text-dark-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <OrderCardSkeleton key={i} />)}
        </div>
      ) : allOrders.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="font-display text-2xl text-white mb-3">No orders yet</h3>
          <p className="text-dark-400 mb-6">Shop our luxury collection and your orders will appear here</p>
          <Link to="/shop" className="btn-gold">Start Shopping</Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-dark-400 text-sm">No orders with status "{FILTER_OPTIONS.find(f => f.value === filter)?.label}"</p>
          <button onClick={() => setFilter('all')} className="text-gold-400 text-sm mt-2 hover:text-gold-300">
            Clear filter →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(order => <OrderCard key={order._id} order={order} />)}
        </div>
      )}
    </>
  );
}

// ─── Root Page ────────────────────────────────────────────────────────────────
export default function Orders() {
  const { id } = useParams();

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-7">
          {id && (
            <Link
              to="/orders"
              className="text-sm text-dark-400 hover:text-gold-400 transition-colors flex items-center gap-1.5 mb-4 group"
            >
              <FiArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
              Back to My Orders
            </Link>
          )}
          <h1 className="section-title">{id ? 'Order Details' : 'My Orders'}</h1>
          <div className="gold-divider mt-3 mx-0" />
        </div>

        {id ? <OrderDetailView id={id} /> : <OrdersListView />}
      </div>
    </div>
  );
}
