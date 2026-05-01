import { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus, FiMapPin, FiCreditCard, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { selectCartItems, selectCartTotal, clearCart } from '../store/cartSlice';
import { selectUser } from '../store/authSlice';
import { orderService, userService } from '../services/services';
import { formatPrice } from '../utils/helpers';
import toast from 'react-hot-toast';
import AddressSelector from '../components/common/AddressSelector';

// ─── Load Razorpay SDK (memoised) ────────────────────────────────────────────
let razorpayScriptPromise = null;

function loadRazorpaySdk() {
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => {
      razorpayScriptPromise = null; // allow retry
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

import { BLANK_ADDRESS, REQUIRED_ADDR_FIELDS } from '../utils/helpers';

// ─── Component ────────────────────────────────────────────────────────────────
export default function Checkout() {
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const items     = useSelector(selectCartItems);
  const total     = useSelector(selectCartTotal);
  const user      = useSelector(selectUser);

  const [addresses,       setAddresses]       = useState([]);
  const [selectedAddrId,  setSelectedAddrId]  = useState(null);
  const [showNewAddr,     setShowNewAddr]      = useState(false);
  const [newAddr,         setNewAddr]          = useState({ ...BLANK_ADDRESS, fullName: user?.name || '' });
  const [processing,      setProcessing]       = useState(false);
  const [addrLoading,     setAddrLoading]      = useState(true);

  // Track pending order ID so we can report failure on modal dismiss
  const pendingOrderIdRef = useRef(null);

  // ─── Computed Pricing (mirrors server logic exactly) ─────────────────────
  const shipping   = total > 999 ? 0 : 99;
  const tax        = Math.round(total * 0.03);
  const grandTotal = total + shipping + tax;

  // ─── Load addresses ───────────────────────────────────────────────────────
  useEffect(() => {
    document.title = 'Checkout — M&B Jewelry';

    // Guard: redirect if cart is empty
    if (items.length === 0) {
      navigate('/cart');
      return;
    }

    userService.getProfile()
      .then((res) => {
        const addrs = res.data.user?.addresses || [];
        setAddresses(addrs);
        const defaultAddr = addrs.find((a) => a.isDefault) ?? addrs[0];
        if (defaultAddr) {
          setSelectedAddrId(defaultAddr._id);
        } else {
          setShowNewAddr(true); // no saved addresses — show the form immediately
        }
      })
      .catch(() => {
        setShowNewAddr(true); // profile failed — just show the form
      })
      .finally(() => setAddrLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const getSelectedAddress = useCallback(() => {
    if (showNewAddr) return newAddr;
    return addresses.find((a) => a._id === selectedAddrId) ?? null;
  }, [showNewAddr, newAddr, addresses, selectedAddrId]);

  const validateAddress = useCallback((addr) => {
    for (const field of REQUIRED_ADDR_FIELDS) {
      if (!addr[field]?.trim()) {
        toast.error(`Please fill in: ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        return false;
      }
    }
    if (!/^\d{6}$/.test(addr.pincode)) {
      toast.error('PIN code must be 6 digits');
      return false;
    }
    if (!/^[6-9]\d{9}$/.test(addr.phone.replace(/\s/g, ''))) {
      toast.error('Please enter a valid 10-digit Indian mobile number');
      return false;
    }
    return true;
  }, []);

  // ─── Report payment failure to backend ───────────────────────────────────
  const reportPaymentFailure = useCallback(async (reason = 'Payment cancelled by user') => {
    const orderId = pendingOrderIdRef.current;
    if (!orderId) return;
    try {
      await orderService.failPayment({ pendingOrderId: orderId, reason });
    } catch {
      // Best-effort — don't block the UI
    } finally {
      pendingOrderIdRef.current = null;
    }
  }, []);

  // ─── Main Payment Handler ─────────────────────────────────────────────────
  const handlePayment = async () => {
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    const shippingAddress = getSelectedAddress();
    if (!shippingAddress) {
      toast.error('Please select or add a delivery address');
      return;
    }
    if (!validateAddress(shippingAddress)) return;

    setProcessing(true);
    pendingOrderIdRef.current = null;

    try {
      // Razorpay Flow: Load SDK
      const loaded = await loadRazorpaySdk();
      if (!loaded) {
        toast.error('Payment gateway failed to load. Please check your internet connection.', { duration: 5000 });
        setProcessing(false);
        return;
      }

      // Phase 1: Create pending order on backend (server-verified prices)
      const { data } = await orderService.createPayment({
        items: items.map((i) => ({ productId: i._id, quantity: i.quantity })),
        shippingAddress,
        method: 'razorpay',
      });

      // Store pending order ID so we can handle failures
      pendingOrderIdRef.current = data.pendingOrderId;

      // 3. Open Razorpay modal
      const options = {
        key:         data.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount:      data.amount,
        currency:    data.currency,
        name:        'M&B Jewelry',
        description: 'Luxury Jewelry Purchase',
        order_id:    data.razorpayOrderId,
        prefill: {
          name:    user?.name  ?? shippingAddress.fullName,
          email:   user?.email ?? '',
          contact: shippingAddress.phone,
        },
        notes: {
          pendingOrderId: data.pendingOrderId,
        },
        theme: { color: '#D4AF37' },

        // 4. Phase 2: Payment success → verify on backend
        handler: async (response) => {
          try {
            const verifyRes = await orderService.verifyPayment({
              razorpayOrderId:  response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              pendingOrderId:   data.pendingOrderId,
            });

            // Clear cart only after server confirms the order
            dispatch(clearCart());
            pendingOrderIdRef.current = null;

            toast.success('Order placed successfully! 🎉', { duration: 5000 });
            navigate(`/orders/${verifyRes.data.order._id}`);
          } catch (err) {
            const msg = err.response?.data?.message || 'Payment verification failed';
            toast.error(msg, { duration: 6000 });
            setProcessing(false);
          }
        },

        // 4b. Phase 3: User dismissed the modal
        modal: {
          ondismiss: async () => {
            toast.error('Payment cancelled');
            // Report failure to backend (marks pending order as failed, no stock touched)
            await reportPaymentFailure('Payment cancelled by user');
            setProcessing(false);
          },
          // Keep button disabled while modal is open
          escape: true,
          animation: true,
        },
      };

      const rzp = new window.Razorpay(options);

      // Handle Razorpay-level payment errors (e.g., card declined)
      rzp.on('payment.failed', async (response) => {
        const reason = response.error?.description || 'Payment failed';
        toast.error(`Payment failed: ${reason}`, { duration: 6000 });
        await reportPaymentFailure(reason);
        setProcessing(false);
      });

      rzp.open();
      // NOTE: Do NOT call setProcessing(false) here — button stays disabled
      // until handler/ondismiss/payment.failed resolves the flow.

    } catch (err) {
      // createPayment or SDK load failed
      const msg = err.response?.data?.message || 'Something went wrong. Please try again.';
      toast.error(msg, { duration: 5000 });
      setProcessing(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="section-title">Checkout</h1>
          <div className="gold-divider mt-3 mx-0" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Left: Address ─────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-5">
                <FiMapPin className="text-gold-500" />
                <h2 className="font-display text-xl text-white">Delivery Address</h2>
              </div>

              <AddressSelector
                addresses={addresses}
                selectedAddrId={selectedAddrId}
                setSelectedAddrId={setSelectedAddrId}
                showNewAddr={showNewAddr}
                setShowNewAddr={setShowNewAddr}
                newAddr={newAddr}
                setNewAddr={setNewAddr}
                addrLoading={addrLoading}
              />
            </div>

            {/* Payment Method */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <FiCreditCard className="text-gold-500" />
                <h2 className="font-display text-xl text-white">Payment Method</h2>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl border border-gold-500/50 bg-gold-500/5">
                <FiCreditCard className="text-gold-500 mt-0.5 flex-shrink-0" size={18} />
                <div>
                  <p className="text-white text-sm font-medium">Online Payment (Razorpay)</p>
                  <p className="text-dark-400 text-xs mt-0.5">Pay securely using UPI, Credit/Debit Cards, or Net Banking.</p>
                </div>
              </div>
            </div>

            {/* Payment Note */}
            <div className="glass-gold rounded-2xl p-4 flex items-start gap-3">
              <FiCreditCard className="text-gold-500 mt-0.5 flex-shrink-0" size={18} />
              <div>
                <p className="text-white text-sm font-medium mb-1">Secure Payment via Razorpay</p>
                <p className="text-dark-400 text-xs leading-relaxed">
                  All transactions are 100% secure and encrypted. We accept UPI, Debit/Credit Cards,
                  Net Banking, and Wallets. Payment is processed only after you confirm on the Razorpay screen.
                </p>
              </div>
            </div>
          </div>

          {/* ── Right: Order Summary ───────────────────────────────────── */}
          <div>
            <div className="card p-5 sticky top-24">
              <h2 className="font-display text-xl text-white mb-4">Order Summary</h2>

              {/* Items */}
              <div className="space-y-3 mb-5 max-h-60 overflow-y-auto scrollbar-hide">
                {items.map((item) => (
                  <div key={item._id} className="flex gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-dark-700 flex-shrink-0">
                      <img
                        src={item.images?.[0]?.url || ''}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{item.name}</p>
                      <p className="text-dark-500 text-xs">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-gold-500 text-xs font-semibold whitespace-nowrap">
                      {formatPrice((item.discountedPrice ?? item.price) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Pricing breakdown */}
              <div className="border-t border-white/10 pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-dark-400">Subtotal</span>
                  <span className="text-white">{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Shipping</span>
                  <span className={shipping === 0 ? 'text-green-400' : 'text-white'}>
                    {shipping === 0 ? 'FREE' : formatPrice(shipping)}
                  </span>
                </div>
                {shipping > 0 && (
                  <p className="text-dark-600 text-xs">
                    Add {formatPrice(999 - total)} more for free shipping
                  </p>
                )}
                <div className="flex justify-between">
                  <span className="text-dark-400">GST (3%)</span>
                  <span className="text-white">{formatPrice(tax)}</span>
                </div>
                <div className="border-t border-white/10 pt-3 flex justify-between font-semibold">
                  <span className="text-white">Total</span>
                  <span className="text-gold-500 text-lg">{formatPrice(grandTotal)}</span>
                </div>
              </div>

              {/* Pay button */}
              <button
                id="pay-now-btn"
                onClick={handlePayment}
                disabled={processing || addrLoading || items.length === 0}
                className="btn-gold w-full py-3.5 mt-5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                    Processing…
                  </span>
                ) : (
                  <>
                    <FiCheck size={16} />
                    {`Pay ${formatPrice(grandTotal)} Securely`}
                  </>
                )}
              </button>

              {processing && (
                <p className="text-dark-500 text-xs text-center mt-2 flex items-center justify-center gap-1">
                  <FiAlertCircle size={11} />
                  Do not close this tab while payment is in progress
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
