import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiChevronRight, FiTruck, FiCheck, FiAlertCircle, FiCreditCard } from 'react-icons/fi';
import { useSelector } from 'react-redux';
import { customOrderService } from '../services/services';
import { formatPrice, formatDate, getCustomOrderStatusColor } from '../utils/helpers';
import { selectUser } from '../store/authSlice';
import { OrderCardSkeleton } from '../components/common/Skeletons';
import toast from 'react-hot-toast';

// ─── Razorpay loader (same as Checkout.jsx) ───────────────────────────────────
let razorpayScriptPromise = null;
function loadRazorpaySdk() {
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => { razorpayScriptPromise = null; resolve(false); };
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

// ─── Status Steps for production orders ──────────────────────────────────────
const STATUS_STEPS = ['advance_paid', 'in_production', 'final_payment_paid', 'ready_to_ship', 'shipped', 'delivered'];
const STATUS_LABELS = {
  advance_paid:       'Advance Paid',
  in_production:      'In Production',
  final_payment_pending: 'Review Pending',
  final_payment_paid: 'Balance Paid',
  ready_to_ship:      'Ready to Ship',
  shipped:            'Shipped',
  delivered:          'Delivered',
};

function OrderTimeline({ status }) {
  const idx = STATUS_STEPS.indexOf(status);
  if (idx === -1) return null;
  return (
    <div className="flex items-center gap-1 sm:gap-2 my-6 overflow-x-auto scrollbar-hide">
      {STATUS_STEPS.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className={`flex flex-col items-center ${i <= idx ? 'text-gold-500' : 'text-dark-600'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
              i < idx ? 'bg-gold-500 border-gold-500' : i === idx ? 'border-gold-500 bg-gold-500/10' : 'border-dark-600'
            }`}>
              {i < idx ? <FiCheck size={14} className="text-dark-900" /> :
               i === 0 ? <FiCreditCard size={12} /> : i === 3 ? <FiTruck size={12} /> : <FiCheck size={12} />}
            </div>
            <p className="text-xs mt-1 capitalize hidden sm:block whitespace-nowrap">{STATUS_LABELS[step]}</p>
          </div>
          {i < STATUS_STEPS.length - 1 && (
            <div className={`w-8 sm:w-12 h-0.5 mx-1 ${i < idx ? 'bg-gold-500' : 'bg-dark-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── List Card ────────────────────────────────────────────────────────────────
function CustomOrderCard({ order }) {
  return (
    <Link to={`/custom-orders/${order._id}`} className="block card-hover p-4 group">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs text-dark-500 mb-1">Custom #{order._id.slice(-8).toUpperCase()}</p>
          <p className="text-dark-400 text-xs">{formatDate(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={getCustomOrderStatusColor(order.status)}>
            {order.status.replace(/_/g, ' ')}
          </span>
          <FiChevronRight size={14} className="text-dark-500 group-hover:text-gold-400 transition-colors" />
        </div>
      </div>

      <div className="flex gap-3 items-center mb-3">
        <div className="w-10 h-10 rounded-lg glass-gold flex items-center justify-center text-gold-400 text-lg flex-shrink-0">
          💎
        </div>
        <div>
          <p className="text-white text-sm font-medium">{order.type} — {order.material}</p>
          <p className="text-dark-500 text-xs">{order.purity !== 'None' ? order.purity : ''}</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        {order.quoteAmount ? (
          <p className="text-gold-500 font-semibold text-sm">Quote: {formatPrice(order.quoteAmount)}</p>
        ) : (
          <p className="text-dark-500 text-xs italic">Awaiting quote…</p>
        )}
        {order.status === 'quoted' && (
          <span className="badge badge-gold text-xs animate-pulse">Action Required</span>
        )}
      </div>
    </Link>
  );
}

// ─── Detail View ──────────────────────────────────────────────────────────────
function CustomOrderDetail({ id }) {
  const [order,      setOrder]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [processing, setProcessing] = useState(false);
  const user = useSelector(selectUser);

  const pendingPayRef = useRef(null);

  useEffect(() => {
    customOrderService.getOrder(id)
      .then((res) => setOrder(res.data.order))
      .catch(() => toast.error('Could not load order'))
      .finally(() => setLoading(false));
  }, [id]);

  const reportFailure = useCallback(async (phase, reason = 'Payment cancelled by user') => {
    const cid = pendingPayRef.current;
    if (!cid) return;
    try { await customOrderService.failPayment({ customOrderId: cid, reason, phase }); }
    catch { /* best effort */ }
    finally { pendingPayRef.current = null; }
  }, []);

  const handlePay = async (phase) => {
    if (!order) return;
    setProcessing(true);
    pendingPayRef.current = null;

    try {
      const loaded = await loadRazorpaySdk();
      if (!loaded) { toast.error('Payment gateway failed to load.', { duration: 5000 }); setProcessing(false); return; }

      // Compute the amount this phase will charge (mirrors the server-side logic)
      const quoteAmt   = order.quoteAmount || 0;
      const taxAmt     = order.taxAmount    > 0 ? order.taxAmount    : Math.round(quoteAmt * 0.18);
      const totalAmt   = order.totalAmount  > 0 ? order.totalAmount  : quoteAmt + taxAmt;
      const advanceAmt = order.advanceAmount > 0 ? order.advanceAmount : Math.round(totalAmt * 0.25);
      const finalAmt   = order.finalAmount  > 0 ? order.finalAmount  : totalAmt - advanceAmt;
      const amtForPhase = phase === 'advance' ? advanceAmt : finalAmt;

      // Razorpay caps a single transaction at ₹5,00,00,000 (5 crore)
      const RAZORPAY_MAX_INR = 5_00_00_000;
      if (amtForPhase > RAZORPAY_MAX_INR) {
        toast.error(
          `This payment (₹${amtForPhase.toLocaleString('en-IN')}) exceeds Razorpay's per-transaction limit of ₹5 crore. Please contact us to arrange an alternate payment method.`,
          { duration: 8000 }
        );
        setProcessing(false);
        return;
      }

      const { data } = await customOrderService.createPayment({ customOrderId: order._id, phase });
      pendingPayRef.current = order._id;

      const options = {
        key:         data.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount:      data.amount,
        currency:    data.currency,
        name:        'M&B Jewelry',
        description: `Custom ${order.type} — ${phase === 'advance' ? '25% Advance' : '75% Balance'}`,
        order_id:    data.razorpayOrderId,
        prefill: {
          name:    user?.name  || '',
          email:   user?.email || '',
          contact: order.shippingAddress?.phone || '',
        },
        theme: { color: '#D4AF37' },

        handler: async (response) => {
          try {
            const verifyRes = await customOrderService.verifyPayment({
              razorpayOrderId:   response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              customOrderId:     order._id,
              phase,
            });
            pendingPayRef.current = null;
            // Update local order state from verified response so UI reflects new status immediately
            if (verifyRes.data?.order) {
              setOrder(verifyRes.data.order);
            }
            setProcessing(false);
            toast.success(phase === 'advance' ? 'Advance paid! Your order is now in production. 🎉' : 'Final balance paid! We will ship it shortly. 🎉', { duration: 6000 });
            // Reload the order to get fresh data in case the response was partial
            customOrderService.getOrder(order._id)
              .then((res) => { if (res.data?.order) setOrder(res.data.order); })
              .catch(() => {/* non-critical */});
          } catch (err) {
            toast.error(err.response?.data?.message || 'Payment verification failed', { duration: 6000 });
            setProcessing(false);
          }
        },

        modal: {
          ondismiss: async () => {
            toast.error('Payment cancelled');
            await reportFailure(phase, 'Payment cancelled by user');
            setProcessing(false);
          },
          escape: true,
          animation: true,
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', async (response) => {
        const reason = response.error?.description || 'Payment failed';
        toast.error(`Payment failed: ${reason}`, { duration: 6000 });
        await reportFailure(phase, reason);
        setProcessing(false);
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong. Please try again.', { duration: 5000 });
      setProcessing(false);
    }
  };

  if (loading) return <OrderCardSkeleton />;
  if (!order)  return <p className="text-dark-400 text-center py-12">Order not found</p>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div>
            <h2 className="text-white font-medium">Custom #{order._id.slice(-8).toUpperCase()}</h2>
            <p className="text-dark-400 text-sm">{formatDate(order.createdAt)}</p>
          </div>
          <span className={getCustomOrderStatusColor(order.status)}>{order.status.replace(/_/g, ' ')}</span>
        </div>
        {['advance_paid', 'in_production', 'final_payment_pending', 'final_payment_paid', 'ready_to_ship', 'shipped', 'delivered'].includes(order.status) && (
          <OrderTimeline status={order.status} />
        )}
      </div>

      {/* Quote Section & Payments */}
      {order.quoteAmount && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-gold rounded-2xl p-5">
          {/* Compute derived amounts client-side — handles legacy orders where
              taxAmount/advanceAmount/finalAmount weren't stored on the DB record */}
          {(() => {
            const quoteAmt   = order.quoteAmount;
            const taxAmt     = order.taxAmount    > 0 ? order.taxAmount    : Math.round(quoteAmt * 0.18);
            const totalAmt   = order.totalAmount  > 0 ? order.totalAmount  : quoteAmt + taxAmt;
            const advanceAmt = order.advanceAmount > 0 ? order.advanceAmount : Math.round(totalAmt * 0.25);
            const finalAmt   = order.finalAmount  > 0 ? order.finalAmount  : totalAmt - advanceAmt;

            return (
              <>
                <div className="flex justify-between flex-wrap items-start">
                  <div>
                    <h3 className="text-white font-display text-lg mb-1">Your Item Quote</h3>
                    <p className="text-dark-400 text-sm mb-4">{order.quoteNote || 'Our artisans have reviewed your request.'}</p>
                  </div>
                  {order.quotedAt && <p className="text-dark-500 text-xs">Quoted on {formatDate(order.quotedAt)}</p>}
                </div>

                {/* Pricing Breakdown */}
                <div className="border border-white/5 bg-dark-900/50 rounded-xl p-4 mb-5">
                  <div className="flex justify-between items-center text-sm mb-2 text-dark-300">
                    <p>Base Quote</p>
                    <p>{formatPrice(quoteAmt)}</p>
                  </div>
                  <div className="flex justify-between items-center text-sm mb-3 pb-3 border-b border-white/5 text-dark-400">
                    <p>18% GST</p>
                    <p>{formatPrice(taxAmt)}</p>
                  </div>
                  <div className="flex justify-between items-center text-base font-medium text-gold-400 mb-1">
                    <p>Grand Total</p>
                    <p>{formatPrice(totalAmt)}</p>
                  </div>
                </div>

                {/* Payment Split info */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className={`p-4 rounded-xl border ${order.advancePayment?.status === 'paid' ? 'border-green-500/30 bg-green-500/5' : 'border-gold-500/30 bg-gold-500/5'}`}>
                    <div className="flex justify-between items-start mb-1 text-xs">
                      <span className="text-dark-300">25% Advance</span>
                      {order.advancePayment?.status === 'paid' && <FiCheck className="text-green-500" />}
                    </div>
                    <p className="font-display sm:text-xl text-lg text-white">{formatPrice(advanceAmt)}</p>
                  </div>
                  <div className={`p-4 rounded-xl border ${order.finalPayment?.status === 'paid' ? 'border-green-500/30 bg-green-500/5' : 'border-white/5'}`}>
                    <div className="flex justify-between items-start mb-1 text-xs">
                      <span className="text-dark-400">75% Balance</span>
                      {order.finalPayment?.status === 'paid' && <FiCheck className="text-green-500" />}
                    </div>
                    <p className="font-display sm:text-xl text-lg text-dark-300">{formatPrice(finalAmt)}</p>
                  </div>
                </div>

                {/* Contextual Payment Buttons */}
                {order.status === 'quoted' && (
                  <button
                    onClick={() => handlePay('advance')}
                    disabled={processing}
                    className="btn-gold w-full py-3.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {processing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                        Processing…
                      </span>
                    ) : (
                      <><FiCreditCard size={16} /> Pay 25% Advance ({formatPrice(advanceAmt)})</>
                    )}
                  </button>
                )}

                {order.status === 'final_payment_pending' && (
                  <button
                    onClick={() => handlePay('final')}
                    disabled={processing}
                    className="btn-gold w-full py-3.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {processing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                        Processing…
                      </span>
                    ) : (
                      <><FiCreditCard size={16} /> Pay 75% Balance ({formatPrice(finalAmt)})</>
                    )}
                  </button>
                )}

                {(order.status === 'quoted' || order.status === 'final_payment_pending') && processing && (
                  <p className="text-dark-500 text-xs text-center mt-2 flex items-center justify-center gap-1">
                    <FiAlertCircle size={11} /> Do not close this tab while payment is in progress
                  </p>
                )}
              </>
            );
          })()}
        </motion.div>
      )}

      {/* Design Specs */}
      <div className="card p-5">
        <h3 className="text-white font-medium mb-4">Design Specifications</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            ['Type',     order.type],
            ['Material', order.material],
            ['Purity',   order.purity !== 'None' ? order.purity : '—'],
            order.fingerSize && ['Finger Size', order.fingerSize],
            order.neckSize   && ['Neck Size',   order.neckSize],
            order.wristSize  && ['Wrist Size',  order.wristSize],
            order.weight     && ['Est. Weight', order.weight],
            order.budget     && ['Budget',      order.budget],
          ].filter(Boolean).map(([k, v]) => (
            <div key={k}>
              <p className="text-dark-500 text-xs">{k}</p>
              <p className="text-white font-medium">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-dark-500 text-xs mb-1">Description</p>
          <p className="text-dark-300 text-sm leading-relaxed">{order.description}</p>
        </div>
      </div>

      {/* Reference Images */}
      {order.referenceImages?.length > 0 && (
        <div className="card p-5">
          <h3 className="text-white font-medium mb-3">Reference Images</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {order.referenceImages.map((img, i) => (
              <div key={i} className="aspect-square rounded-xl overflow-hidden bg-dark-700">
                <img src={img.url} alt={`ref-${i}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shipping Address */}
      {order.shippingAddress && (
        <div className="card p-5">
          <h3 className="text-white font-medium mb-3">Delivery Address</h3>
          <p className="text-dark-400 text-sm">{order.shippingAddress.fullName}</p>
          <p className="text-dark-400 text-sm">{order.shippingAddress.addressLine1}</p>
          <p className="text-dark-400 text-sm">{order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.pincode}</p>
          <p className="text-dark-500 text-sm">{order.shippingAddress.phone}</p>
        </div>
      )}

      {/* Tracking */}
      {order.trackingNumber && (
        <div className="card p-5">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2"><FiTruck size={14} className="text-gold-500" /> Tracking</h3>
          <p className="text-dark-400 text-sm">{order.courierPartner} — {order.trackingNumber}</p>
          {order.trackingUrl && (
            <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-gold-500 hover:text-gold-400 text-sm transition-colors">
              Track Shipment →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CustomOrders() {
  const { id }  = useParams();
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Custom Orders — M&B Jewelry';
    if (!id) {
      customOrderService.getMyOrders()
        .then((res) => setOrders(res.data.orders))
        .finally(() => setLoading(false));
    }
  }, [id]);

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          {id && (
            <Link to="/custom-orders" className="text-sm text-dark-400 hover:text-gold-400 transition-colors flex items-center gap-1 mb-4">
              ← Back to Custom Orders
            </Link>
          )}
          <h1 className="section-title">{id ? 'Custom Order Details' : 'My Custom Orders'}</h1>
          <div className="gold-divider mt-3 mx-0" />
        </div>

        {id ? (
          <CustomOrderDetail id={id} />
        ) : loading ? (
          <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <OrderCardSkeleton key={i} />)}</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">💎</div>
            <h3 className="font-display text-2xl text-white mb-3">No custom orders yet</h3>
            <p className="text-dark-400 mb-6">Design your dream piece and our artisans will bring it to life</p>
            <Link to="/custom-order" className="btn-gold">Request Custom Jewelry</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => <CustomOrderCard key={o._id} order={o} />)}
          </div>
        )}
      </div>
    </div>
  );
}
