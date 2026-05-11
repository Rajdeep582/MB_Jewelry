import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import PropTypes from 'prop-types';
import { FiChevronRight, FiTruck, FiCheck, FiAlertCircle, FiCreditCard, FiMessageSquare } from 'react-icons/fi';
import { useSelector } from 'react-redux';
import { customOrderService } from '../services/services';
import api from '../services/api';
import { formatPrice, formatDate, getCustomOrderStatusColor } from '../utils/helpers';
import { selectUser } from '../store/authSlice';
import { OrderCardSkeleton } from '../components/common/Skeletons';
import toast from 'react-hot-toast';

// ─── Razorpay loader ──────────────────────────────────────────────────────────
let razorpayScriptPromise = null;
function loadRazorpaySdk() {
  if (globalThis.Razorpay) return Promise.resolve(true);
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

// ─── Status Steps ─────────────────────────────────────────────────────────────
const STATUS_STEPS = ['advance_paid', 'shipped', 'delivered'];
const STATUS_LABELS = {
  advance_paid:             'In Production',
  in_production:            'In Production',
  final_payment_pending:    'Review Pending',
  final_payment_paid:       'Balance Paid',
  ready_to_ship:            'Ready to Ship',
  shipped:                  'Shipped',
  delivered:                'Delivered',
};

function getTimelineStepClass(i, idx) {
  if (i < idx) return 'bg-gold-500 border-gold-500';
  if (i === idx) return 'border-gold-500 bg-gold-500/10';
  return 'border-dark-600';
}

function getTimelineStepIcon(i, idx) {
  if (i < idx) return <FiCheck size={14} className="text-dark-900" />;
  if (i === 0) return <FiCreditCard size={12} />;
  if (i === 3) return <FiTruck size={12} />;
  return <FiCheck size={12} />;
}

function OrderTimeline({ status }) {
  const idx = STATUS_STEPS.indexOf(status);
  if (idx === -1) return null;
  return (
    <div className="flex items-center gap-1 sm:gap-2 my-6 overflow-x-auto scrollbar-hide">
      {STATUS_STEPS.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className={`flex flex-col items-center ${i <= idx ? 'text-gold-500' : 'text-dark-600'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${getTimelineStepClass(i, idx)}`}>
              {getTimelineStepIcon(i, idx)}
            </div>
            <p className="font-jakarta text-[10px] mt-1.5 capitalize hidden sm:block whitespace-nowrap font-medium">
              {STATUS_LABELS[step]}
            </p>
          </div>
          {i < STATUS_STEPS.length - 1 && (
            <div className={`w-8 sm:w-14 h-px mx-1 ${i < idx ? 'bg-gold-500' : 'bg-dark-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

OrderTimeline.propTypes = {
  status: PropTypes.string.isRequired,
};

// ─── List Card ────────────────────────────────────────────────────────────────
function CustomOrderCard({ order }) {
  const typeInitial = order.type?.[0]?.toUpperCase() || '✦';

  return (
    <Link
      to={`/custom-orders/${order._id}`}
      className="group block relative overflow-hidden rounded-2xl border border-white/5 bg-dark-800 hover:border-gold-500/25 transition-all duration-300 hover:shadow-[0_8px_40px_rgba(212,175,55,0.10)] hover:-translate-y-0.5"
    >
      {/* Gold left accent bar */}
      <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full bg-gradient-to-b from-transparent via-gold-500 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="p-5 pl-6">
        {/* Top: order ref + status */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-jakarta text-[10px] font-semibold tracking-[0.22em] text-gold-600 uppercase mb-0.5">
              Custom Order
            </p>
            <p className="font-jakarta text-xs font-medium text-dark-400 tracking-widest">
              #{order._id.slice(-8).toUpperCase()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`${getCustomOrderStatusColor(order.status)} font-jakarta`}>
              {order.status.replaceAll('_', ' ')}
            </span>
            <FiChevronRight
              size={14}
              className="text-dark-600 group-hover:text-gold-400 group-hover:translate-x-0.5 transition-all duration-200"
            />
          </div>
        </div>

        {/* Body: icon + type/material + price */}
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-gold-500/15 to-gold-700/5 border border-gold-500/20 flex items-center justify-center shadow-[inset_0_1px_0_rgba(212,175,55,0.1)]">
            <span className="font-jakarta text-lg font-bold text-gold-400 leading-none">{typeInitial}</span>
          </div>

          {/* Name + chips */}
          <div className="flex-1 min-w-0">
            <p className="font-jakarta text-white text-sm font-semibold mb-1.5 truncate">
              {order.type}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-jakarta text-[11px] font-medium text-dark-300 bg-dark-700/80 px-2 py-0.5 rounded-full">
                {order.material}
              </span>
              {order.purity && order.purity !== 'None' && (
                <span className="font-jakarta text-[11px] font-medium text-gold-500 bg-gold-500/10 px-2 py-0.5 rounded-full border border-gold-500/20">
                  {order.purity}
                </span>
              )}
            </div>
          </div>

          {/* Price + date */}
          <div className="text-right flex-shrink-0">
            {order.quoteAmount ? (
              <p className="font-jakarta text-gold-400 font-bold text-base leading-tight">
                {formatPrice(order.quoteAmount)}
              </p>
            ) : (
              <p className="font-jakarta text-dark-500 text-xs italic">Quote pending</p>
            )}
            <p className="font-jakarta text-dark-600 text-[11px] mt-1">{formatDate(order.createdAt)}</p>
          </div>
        </div>

        {/* Action required footer */}
        {order.status === 'quoted' && (
          <div className="mt-4 pt-3.5 border-t border-gold-500/10 flex items-center justify-between">
            <p className="font-jakarta text-gold-500/80 text-xs font-medium">
              Payment required to confirm order
            </p>
            <span className="badge badge-gold font-jakarta text-[10px] animate-pulse">Action Required</span>
          </div>
        )}
      </div>
    </Link>
  );
}

CustomOrderCard.propTypes = {
  order: PropTypes.shape({
    _id:         PropTypes.string.isRequired,
    createdAt:   PropTypes.string.isRequired,
    status:      PropTypes.string.isRequired,
    type:        PropTypes.string.isRequired,
    material:    PropTypes.string.isRequired,
    purity:      PropTypes.string,
    quoteAmount: PropTypes.number,
  }).isRequired,
};

// ─── Detail View ──────────────────────────────────────────────────────────────
function CustomOrderDetail({ id }) {
  const [order,      setOrder]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [gstRates,   setGstRates]   = useState([]);
  const user = useSelector(selectUser);

  const pendingPayRef = useRef(null);

  useEffect(() => {
    api.get('/products/public/gst-rates').then(r => setGstRates(r.data.rates || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setFetchError('');
    customOrderService.getOrder(id)
      .then((res) => {
        if (res.data.order) setOrder(res.data.order);
        else setFetchError('Order not found');
      })
      .catch((err) => {
        const msg = err?.response?.data?.message || err?.message || 'Failed to load order';
        setFetchError(msg);
        toast.error(msg);
      })
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

      const quoteAmt   = order.quoteAmount || 0;
      const _gstEntry  = gstRates.find(r => r.material === order.material && (r.purity === order.purity || order.purity === 'None'))
                      || gstRates.find(r => r.material === order.material);
      const _gstRate   = _gstEntry
        ? (_gstEntry.gst / 100)
        : (order.taxAmount > 0 ? (order.taxAmount / quoteAmt) : 0.18);
      const taxAmt     = Math.round(quoteAmt * _gstRate);
      const totalAmt   = order.totalAmount  > 0 ? order.totalAmount  : quoteAmt + taxAmt;
      const advanceAmt = order.advanceAmount > 0 ? order.advanceAmount : Math.round(totalAmt * 0.70);
      const finalAmt   = order.finalAmount  > 0 ? order.finalAmount  : totalAmt - advanceAmt;
      const amtForPhase = phase === 'advance' ? advanceAmt : finalAmt;

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
        name:        'M.B. JEWELLERS',
        description: `Custom ${order.type} — ${phase === 'advance' ? '70% Advance' : '30% Balance'}`,
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
            if (verifyRes.data?.order) setOrder(verifyRes.data.order);
            setProcessing(false);
            toast.success(
              phase === 'advance'
                ? 'Advance paid! Your order is now in production. 🎉'
                : 'Final payment complete! We will confirm delivery shortly. 🎉',
              { duration: 6000 }
            );
            customOrderService.getOrder(order._id)
              .then((res) => { if (res.data?.order) setOrder(res.data.order); })
              .catch(() => {});
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

      const rzp = new globalThis.Razorpay(options);
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

  const handleCancelOrder = async () => {
    if (!window.confirm('Are you sure you want to cancel this custom order? This action cannot be undone.')) return;
    setProcessing(true);
    try {
      const res = await customOrderService.cancelOrder(order._id);
      setOrder(res.data.order);
      toast.success('Order cancelled successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel order');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <OrderCardSkeleton />;
  if (fetchError) return (
    <div className="text-center py-12 space-y-3">
      <FiAlertCircle className="mx-auto text-red-400" size={32} />
      <p className="font-jakarta text-red-400 text-sm">{fetchError}</p>
    </div>
  );
  if (!order) return (
    <p className="font-jakarta text-dark-400 text-center py-12">Order not found</p>
  );

  const typeInitial = order.type?.[0]?.toUpperCase() || '✦';

  return (
    <div className="space-y-4 font-jakarta">

      {/* Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-dark-800">
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-gold-500 to-transparent opacity-60" />
        <div className="p-6 pl-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gold-500/20 to-gold-700/5 border border-gold-500/25 flex items-center justify-center flex-shrink-0 shadow-[inset_0_1px_0_rgba(212,175,55,0.15)]">
                <span className="font-jakarta text-xl font-bold text-gold-400">{typeInitial}</span>
              </div>
              <div>
                <p className="font-jakarta text-[10px] font-semibold tracking-[0.22em] text-gold-600 uppercase mb-1">
                  Custom Order
                </p>
                <h2 className="font-jakarta text-white font-bold text-lg leading-tight">
                  #{order._id.slice(-8).toUpperCase()}
                </h2>
                <p className="font-jakarta text-dark-500 text-xs mt-0.5">{formatDate(order.createdAt)}</p>
              </div>
            </div>
            <span className={`${getCustomOrderStatusColor(order.status)} font-jakarta mt-1`}>
              {order.status.replaceAll('_', ' ')}
            </span>
          </div>

          {['advance_paid', 'in_production', 'final_payment_pending', 'final_payment_paid', 'ready_to_ship', 'shipped', 'delivered'].includes(order.status) && (
            <OrderTimeline status={order.status} />
          )}
        </div>
      </div>

      {/* Quote & Payment */}
      {order.quoteAmount && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-gold-500/20 bg-gradient-to-br from-gold-500/8 via-dark-800 to-dark-800 p-6 font-jakarta"
        >
          {(() => {
            const quoteAmt   = order.quoteAmount;
            const _gstEntry  = gstRates.find(r => r.material === order.material && (r.purity === order.purity || order.purity === 'None'))
                            || gstRates.find(r => r.material === order.material);
            const _gstRate   = _gstEntry
              ? (_gstEntry.gst / 100)
              : (order.taxAmount > 0 ? (order.taxAmount / quoteAmt) : 0.18);
            const taxAmt     = Math.round(quoteAmt * _gstRate);
            const totalAmt   = quoteAmt + taxAmt;
            const advanceAmt = order.advanceAmount > 0 ? order.advanceAmount : Math.round(totalAmt * 0.70);
            const finalAmt   = order.finalAmount  > 0 ? order.finalAmount  : totalAmt - advanceAmt;

            return (
              <>
                <div className="flex justify-between flex-wrap items-start mb-5">
                  <div>
                    <p className="font-jakarta text-[10px] font-semibold tracking-[0.22em] text-gold-600 uppercase mb-1">
                      Quote Breakdown
                    </p>
                    <h3 className="font-jakarta text-white font-bold text-xl">Your Item Quote</h3>
                    {order.quoteNote && (
                      <p className="font-jakarta text-dark-400 text-sm mt-1">{order.quoteNote}</p>
                    )}
                    {order.expectedDeliveryDate && (
                      <p className="font-jakarta text-gold-400 text-sm font-medium mt-3 flex items-center gap-1.5">
                        <FiTruck size={14} />
                        Expected: {new Date(order.expectedDeliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  {order.quotedAt && (
                    <p className="font-jakarta text-dark-600 text-[11px] mt-1">
                      Quoted {formatDate(order.quotedAt)}
                    </p>
                  )}
                </div>

                {/* Pricing breakdown */}
                <div className="bg-dark-900/60 border border-white/5 rounded-xl p-4 mb-5">
                  <div className="flex justify-between items-center text-sm mb-2.5">
                    <p className="font-jakarta text-dark-400 font-medium">Base Quote</p>
                    <p className="font-jakarta text-white font-medium">{formatPrice(quoteAmt)}</p>
                  </div>
                  <div className="flex justify-between items-center text-sm pb-3 mb-3 border-b border-white/5">
                    <p className="font-jakarta text-dark-500">{Math.round((taxAmt / quoteAmt) * 100)}% GST</p>
                    <p className="font-jakarta text-dark-400">{formatPrice(taxAmt)}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="font-jakarta text-white font-semibold">Grand Total</p>
                    <p className="font-jakarta text-gold-400 font-bold text-lg">{formatPrice(totalAmt)}</p>
                  </div>
                </div>

                {/* Payment split */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className={`p-4 rounded-xl border ${order.advancePayment?.status === 'paid' ? 'border-green-500/25 bg-green-500/5' : 'border-gold-500/25 bg-gold-500/5'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-jakarta text-dark-400 text-xs font-medium">70% Advance</p>
                      {order.advancePayment?.status === 'paid' && (
                        <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                          <FiCheck size={10} className="text-green-400" />
                        </div>
                      )}
                    </div>
                    <p className="font-jakarta text-white font-bold text-xl">{formatPrice(advanceAmt)}</p>
                    {order.advancePayment?.status === 'paid' && (
                      <p className="font-jakarta text-green-500 text-[10px] font-medium mt-1">Paid</p>
                    )}
                  </div>
                  <div className={`p-4 rounded-xl border ${order.finalPayment?.status === 'paid' ? 'border-green-500/25 bg-green-500/5' : 'border-white/5 bg-dark-900/40'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-jakarta text-dark-500 text-xs font-medium">30% Balance</p>
                      {order.finalPayment?.status === 'paid' && (
                        <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                          <FiCheck size={10} className="text-green-400" />
                        </div>
                      )}
                    </div>
                    <p className={`font-jakarta font-bold text-xl ${order.finalPayment?.status === 'paid' ? 'text-white' : 'text-dark-400'}`}>
                      {formatPrice(finalAmt)}
                    </p>
                    {order.finalPayment?.status === 'paid' && (
                      <p className="font-jakarta text-green-500 text-[10px] font-medium mt-1">Paid</p>
                    )}
                  </div>
                </div>

                {/* Pay buttons */}
                {order.status === 'quoted' && (
                  <button
                    onClick={() => handlePay('advance')}
                    disabled={processing}
                    className="btn-gold w-full py-3.5 font-jakarta font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {processing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                        Processing…
                      </span>
                    ) : (
                      <><FiCreditCard size={16} /> Pay 70% Advance — {formatPrice(advanceAmt)}</>
                    )}
                  </button>
                )}

                {['shipped', 'final_payment_pending'].includes(order.status) && order.finalPayment?.status !== 'paid' && (
                  <>
                    <div className="mb-3 text-center">
                      <p className="font-jakarta text-dark-500 text-xs">
                        Your order has shipped — complete the balance payment to confirm delivery.
                      </p>
                    </div>
                    <button
                      onClick={() => handlePay('final')}
                      disabled={processing}
                      className="btn-gold w-full py-3.5 font-jakarta font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {processing ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                          Processing…
                        </span>
                      ) : (
                        <><FiCreditCard size={16} /> Pay 30% Balance — {formatPrice(finalAmt)}</>
                      )}
                    </button>
                  </>
                )}

                {(order.status === 'quoted' || order.status === 'shipped') && processing && (
                  <p className="font-jakarta text-dark-600 text-xs text-center mt-3 flex items-center justify-center gap-1">
                    <FiAlertCircle size={11} /> Do not close this tab while payment is in progress
                  </p>
                )}
              </>
            );
          })()}
        </motion.div>
      )}

      {/* Design Specs */}
      <div className="rounded-2xl border border-white/5 bg-dark-800 p-6">
        <p className="font-jakarta text-[10px] font-semibold tracking-[0.22em] text-gold-600 uppercase mb-1">Details</p>
        <h3 className="font-jakarta text-white font-bold mb-5">Design Specifications</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 text-sm">
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
              <p className="font-jakarta text-dark-500 text-[10px] font-semibold uppercase tracking-wider mb-1">{k}</p>
              <p className="font-jakarta text-white font-semibold text-sm">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-5 border-t border-white/5">
          <p className="font-jakarta text-dark-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Description</p>
          <p className="font-jakarta text-dark-300 text-sm leading-relaxed">{order.description}</p>
        </div>
      </div>

      {/* Reference Images */}
      {order.referenceImages?.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-dark-800 p-6">
          <p className="font-jakarta text-[10px] font-semibold tracking-[0.22em] text-gold-600 uppercase mb-1">Images</p>
          <h3 className="font-jakarta text-white font-bold mb-4">Reference Images</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {order.referenceImages.map((img) => (
              <div key={img.url} className="aspect-square rounded-xl overflow-hidden bg-dark-700 border border-white/5">
                <img src={img.url} alt="ref" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shipping Address */}
      {order.shippingAddress && (
        <div className="rounded-2xl border border-white/5 bg-dark-800 p-6">
          <p className="font-jakarta text-[10px] font-semibold tracking-[0.22em] text-gold-600 uppercase mb-1">Shipping</p>
          <h3 className="font-jakarta text-white font-bold mb-3">Delivery Address</h3>
          <p className="font-jakarta text-dark-300 text-sm font-semibold">{order.shippingAddress.fullName}</p>
          <p className="font-jakarta text-dark-400 text-sm mt-0.5">{order.shippingAddress.addressLine1}</p>
          <p className="font-jakarta text-dark-400 text-sm">
            {order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.pincode}
          </p>
          <p className="font-jakarta text-dark-500 text-sm mt-1">{order.shippingAddress.phone}</p>
        </div>
      )}

      {/* Tracking — only show when not yet delivered */}
      {order.status !== 'delivered' && (order.trackingNumber || order.estimatedDelivery) && (
        <div className="rounded-2xl border border-white/5 bg-dark-800 p-6">
          <div className="flex items-center gap-2 mb-3">
            <FiTruck size={14} className="text-gold-500" />
            <p className="font-jakarta text-[10px] font-semibold tracking-[0.22em] text-gold-600 uppercase">
              Tracking
            </p>
          </div>
          {order.estimatedDelivery && (
            <p className="font-jakarta text-gold-400 text-sm font-semibold mb-3 flex items-center gap-1.5">
              <FiTruck size={13} />
              Estimated Delivery: {new Date(order.estimatedDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
          {order.courierPartner && (
            <p className="font-jakarta text-dark-300 text-sm font-medium">{order.courierPartner}</p>
          )}
          {order.trackingNumber && (
            <p className="font-jakarta text-dark-400 text-sm">{order.trackingNumber}</p>
          )}
          {order.trackingUrl && (
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-jakarta text-gold-500 hover:text-gold-400 text-sm font-medium mt-2 inline-flex items-center gap-1 transition-colors"
            >
              Track Shipment <FiChevronRight size={13} />
            </a>
          )}
        </div>
      )}

      {/* Delivered */}
      {order.status === 'delivered' && (
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center flex-shrink-0">
              <FiCheck size={20} className="text-green-400" />
            </div>
            <div>
              <p className="font-jakarta text-white font-bold">Delivered Successfully</p>
              <p className="font-jakarta text-dark-400 text-xs mt-0.5">
                Delivered on{' '}
                {order.deliveredAt
                  ? new Date(order.deliveredAt).toLocaleString('en-IN', {
                      day: 'numeric', month: 'long', year: 'numeric',
                      hour: 'numeric', minute: '2-digit', hour12: true,
                    })
                  : formatDate(order.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5">
        <div className="flex items-center gap-2 text-dark-400 text-sm">
          <FiMessageSquare size={15} className="text-gold-500" />
          <span className="font-jakarta text-dark-400 text-sm">
            Need help?{' '}
            <a
              href="mailto:support@mbjewelry.com"
              className="font-jakarta text-white hover:text-gold-400 underline decoration-white/20 underline-offset-4 transition-colors"
            >
              Contact Support
            </a>
          </span>
        </div>
        {['pending', 'quoted'].includes(order.status) && (
          <button
            onClick={handleCancelOrder}
            disabled={processing}
            className="font-jakarta text-red-400 hover:text-red-300 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel Order
          </button>
        )}
      </div>
    </div>
  );
}

CustomOrderDetail.propTypes = {
  id: PropTypes.string.isRequired,
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CustomOrders() {
  const { id }  = useParams();
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Custom Orders — M.B. JEWELLERS';
    if (!id) {
      setLoading(true);
      customOrderService.getMyOrders()
        .then((res) => setOrders(res.data.orders || []))
        .catch(() => toast.error('Failed to load orders'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [id]);

  return (
    <div className="min-h-screen pt-24 pb-20 font-jakarta">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-10">
          {id && (
            <Link
              to="/custom-orders"
              className="font-jakarta text-xs font-medium text-dark-500 hover:text-gold-400 transition-colors flex items-center gap-1.5 mb-6"
            >
              <FiChevronRight size={12} className="rotate-180" />
              Back to Custom Orders
            </Link>
          )}
          <p className="font-jakarta text-[10px] font-semibold tracking-[0.25em] text-gold-600 uppercase mb-2">
            {id ? 'Order Details' : 'My Orders'}
          </p>
          <div className="flex items-end justify-between gap-4">
            <h1 className="font-jakarta text-3xl font-bold text-white leading-tight">
              {id ? 'Custom Order Details' : 'My Custom Orders'}
            </h1>
            {!id && !loading && orders.length > 0 && (
              <span className="font-jakarta text-dark-500 text-sm mb-0.5 flex-shrink-0">
                {orders.length} order{orders.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="w-10 h-0.5 bg-gold-gradient mt-4 rounded-full" />
        </div>

        {/* Content */}
        {id ? (
          <CustomOrderDetail id={id} />
        ) : loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }, (_, n) => n).map((n) => <OrderCardSkeleton key={n} />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl leading-none">✦</span>
            </div>
            <p className="font-jakarta text-white font-bold text-xl mb-2">No custom orders yet</p>
            <p className="font-jakarta text-dark-500 text-sm mb-8 max-w-xs mx-auto leading-relaxed">
              Design something unique — crafted exclusively for you by our master artisans.
            </p>
            <Link to="/custom-jewelry" className="btn-gold px-8 py-3 font-jakarta font-semibold text-sm">
              Start a Custom Order
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <CustomOrderCard key={order._id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
