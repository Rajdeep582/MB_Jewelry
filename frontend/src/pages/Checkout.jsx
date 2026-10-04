import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMapPin, FiCreditCard, FiCheck, FiAlertCircle, FiLock, FiShield, FiShoppingBag, FiTruck } from 'react-icons/fi';
import jewelryImg from '../assets/necklace.webp';
import { selectCartItems, selectCartTotal, clearCart } from '../store/cartSlice';
import { selectUser } from '../store/authSlice';
import { orderService, userService } from '../services/services';
import { formatPrice, resolveImageUrl, BLANK_ADDRESS, REQUIRED_ADDR_FIELDS } from '../utils/helpers';
import toast from 'react-hot-toast';
import AddressSelector from '../components/common/AddressSelector';

// ─── Load Razorpay SDK (memoised) ────────────────────────────────────────────
let razorpayScriptPromise = null;

function loadRazorpaySdk() {
  if (globalThis.Razorpay) return Promise.resolve(true);
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




// ─── UI helpers (presentation only) ──────────────────────────────────────────
const SERIF = "font-['Cormorant_Garamond',Georgia,serif]";

function CheckoutSteps({ addressReady }) {
  const steps = [
    { label: 'Cart',     state: 'done' },
    { label: 'Delivery', state: addressReady ? 'done' : 'active' },
    { label: 'Payment',  state: addressReady ? 'active' : 'todo' },
  ];
  return (
    <ol className="flex items-center gap-2 sm:gap-3" aria-label="Checkout progress">
      {steps.map((st, i) => (
        <li key={st.label} className="flex items-center gap-2 sm:gap-3">
          <span className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-500 ${
              st.state === 'done'   ? 'bg-gold-500 text-dark-900' :
              st.state === 'active' ? 'border border-gold-500 text-gold-400 shadow-[0_0_12px_rgba(212,175,55,0.4)]' :
                                      'border border-white/15 text-dark-500'
            }`}>
              {st.state === 'done' ? <FiCheck size={12} /> : i + 1}
            </span>
            <span className={`font-jakarta text-xs font-medium transition-colors duration-500 ${st.state === 'todo' ? 'text-dark-500' : 'text-dark-200'}`}>{st.label}</span>
          </span>
          {i < steps.length - 1 && (
            <span className="relative w-6 sm:w-10 h-px bg-white/10 overflow-hidden">
              <motion.span
                className="absolute inset-0 bg-gold-500 origin-left"
                initial={false}
                animate={{ scaleX: st.state === 'done' ? 1 : 0 }}
                transition={{ duration: 0.6 }}
              />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function SectionHeader({ n, icon, title, done, right }) {
  const Icon = icon;
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${done ? 'bg-gold-500 text-dark-900' : 'border border-gold-500/40 text-gold-400'}`}>
          {done ? <FiCheck size={14} /> : <Icon size={14} />}
        </span>
        <div>
          <p className="font-jakarta text-[10px] uppercase tracking-[0.25em] text-dark-500">Step {n}</p>
          <h2 className={`${SERIF} text-white text-xl sm:text-2xl font-semibold leading-tight pt-0`}>{title}</h2>
        </div>
      </div>
      {right}
    </div>
  );
}

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

  // ─── Server quote: PIN code → delivery area → shipping, GST, total ────────
  // The backend is the source of truth; the same calculation is used for payment.
  const [quoteState, setQuoteState] = useState({ key: null, data: null, error: null });

  // ─── Load addresses ───────────────────────────────────────────────────────
  useEffect(() => {
    document.title = 'Checkout — M.B. JEWELLERS';

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

  // Build the quote request for the current address selection (null = nothing to quote yet)
  const itemsKey = items.map((i) => `${i._id}:${i.quantity}`).join('|');
  const newPin   = String(newAddr.pincode ?? '').trim();
  const quoteRequest = useMemo(() => {
    if (addrLoading || items.length === 0) return null;
    const reqItems = items.map((i) => ({ productId: i._id, quantity: i.quantity }));
    if (!showNewAddr && selectedAddrId) return { items: reqItems, shippingAddressId: selectedAddrId };
    if (showNewAddr && /^\d{6}$/.test(newPin)) return { items: reqItems, shippingAddress: { pincode: newPin } };
    return null;
  }, [addrLoading, showNewAddr, selectedAddrId, newPin, itemsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const quoteKey = quoteRequest ? JSON.stringify(quoteRequest) : null;

  useEffect(() => {
    if (!quoteRequest) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await orderService.getQuote(quoteRequest);
        if (!cancelled) setQuoteState({ key: quoteKey, data: res.data, error: null });
      } catch (err) {
        if (!cancelled) {
          setQuoteState({
            key: quoteKey,
            data: null,
            error: err.response?.data || { message: 'Could not calculate shipping. Please try again.' },
          });
        }
      }
    }, quoteRequest.shippingAddress ? 350 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [quoteKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const quoteLoading = !!quoteKey && quoteState.key !== quoteKey;
  const quote        = quoteKey && quoteState.key === quoteKey ? quoteState.data : null;
  const quoteError   = quoteKey && quoteState.key === quoteKey ? quoteState.error : null;
  const deliverable  = !!quote?.delivery;
  const grandTotal   = quote?.pricing?.totalAmount ?? null;

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const getSelectedAddress = useCallback(() => {
    if (showNewAddr) return newAddr;
    return addresses.find((a) => a._id === selectedAddrId) ?? null;
  }, [showNewAddr, newAddr, addresses, selectedAddrId]);

  const validateAddress = useCallback((addr) => {
    for (const field of REQUIRED_ADDR_FIELDS) {
      if (!addr[field]?.trim()) {
        toast.error(`Please fill in: ${field.replaceAll(/([A-Z])/g, ' $1').toLowerCase()}`);
        return false;
      }
    }
    if (!/^\d{6}$/.test(addr.pincode)) {
      toast.error('PIN code must be 6 digits');
      return false;
    }
    if (!/^[6-9]\d{9}$/.test(addr.phone.replaceAll(/\s/g, ''))) {
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
    if (quoteError) {
      toast.error(quoteError.message || 'Delivery is not available to this PIN code');
      return;
    }
    if (!quote || quoteLoading) {
      toast.error('Calculating shipping for your PIN code — please wait a moment');
      return;
    }

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
      // Shipping/total are recalculated on the server; expectedTotal only lets the
      // server refuse if the amount differs from what the customer was shown.
      const { data } = await orderService.createPayment({
        items: items.map((i) => ({ productId: i._id, quantity: i.quantity })),
        shippingAddress,
        ...(!showNewAddr && selectedAddrId ? { shippingAddressId: selectedAddrId } : {}),
        method: 'razorpay',
        expectedTotal: quote.pricing.totalAmount,
      });

      // Store pending order ID so we can handle failures
      pendingOrderIdRef.current = data.pendingOrderId;

      // 3. Open Razorpay modal
      const options = {
        key:         data.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount:      data.amount,
        currency:    data.currency,
        name:        'M.B. JEWELLERS',
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

      const rzp = new globalThis.Razorpay(options);

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
      const body = err.response?.data;
      if (err.response?.status === 409 && body?.code === 'PRICE_CHANGED' && body.pricing) {
        // Show the server's amount; customer must press Pay again to accept it
        setQuoteState({ key: quoteKey, data: { ...quote, pricing: body.pricing, delivery: body.delivery ?? quote?.delivery }, error: null });
      }
      const msg = body?.message || 'Something went wrong. Please try again.';
      toast.error(msg, { duration: 5000 });
      setProcessing(false);
    }
  };

  // ─── Render (presentation only) ──────────────────────────────────────────
  const selectedAddr = getSelectedAddress();
  const addressReady = !!selectedAddr && REQUIRED_ADDR_FIELDS.every((f) => String(selectedAddr[f] ?? '').trim());
  const itemCount    = items.reduce((n, i) => n + i.quantity, 0);
  const payDisabled  = processing || addrLoading || items.length === 0 || !quote || quoteLoading || !!quoteError;
  const deliveryReady = addressReady && deliverable;
  const unavailable  = quoteError?.code === 'DELIVERY_UNAVAILABLE' ? quoteError : null;
  let shippingText = 'Enter PIN code';
  if (quote?.delivery) shippingText = formatPrice(quote.delivery.charge);
  else if (unavailable) shippingText = 'Not available';
  else if (quoteLoading) shippingText = 'Calculating…';

  const payLabel = processing ? (
    <span className="flex items-center justify-center gap-2">
      <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
      {'Processing…'}
    </span>
  ) : (
    <>
      <FiLock size={15} />
      {grandTotal !== null ? `Pay ${formatPrice(grandTotal)} Securely` : 'Pay Securely'}
    </>
  );

  return (
    <div className="relative min-h-screen pt-24 pb-32 lg:pb-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(55%_100%_at_50%_0%,rgba(212,175,55,0.08),transparent_70%)]" aria-hidden="true" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <p className="font-jakarta text-[11px] font-semibold tracking-[0.3em] text-gold-500 uppercase mb-1.5 flex items-center gap-1.5">
              <FiLock size={11} /> Secure Checkout
            </p>
            <h1 className={`${SERIF} text-white text-3xl sm:text-4xl font-semibold leading-tight pt-0`}>Checkout</h1>
          </div>
          <CheckoutSteps addressReady={deliveryReady} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 lg:gap-6 items-start">
          {/* ── Left: Address + Payment ─────────────────────────────────── */}
          <div className="space-y-4">
            <motion.section
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              className={`card p-5 transition-colors duration-500 ${deliveryReady ? 'border-gold-500/25' : ''} ${unavailable ? '!border-red-500/30' : ''}`}
            >
              <SectionHeader
                n={1} icon={FiMapPin} title="Delivery Address" done={deliveryReady}
                right={deliveryReady && !showNewAddr ? <span className="badge badge-green text-[11px]">Selected</span> : null}
              />
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
              <AnimatePresence mode="wait">
                {quote?.delivery && (
                  <motion.div
                    key={`ok-${quote.delivery.pincode}`}
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-green-500/25 bg-green-500/[0.06] text-xs"
                  >
                    <FiTruck size={13} className="text-green-400 flex-shrink-0" />
                    <span className="text-dark-200">
                      Delivering to <span className="text-white font-medium">{quote.delivery.area}</span> ({quote.delivery.pincode})
                    </span>
                    <span className="ml-auto text-green-400 font-semibold whitespace-nowrap">Shipping {formatPrice(quote.delivery.charge)}</span>
                  </motion.div>
                )}
                {quoteError && (
                  <motion.div
                    key="unavailable"
                    role="alert"
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mt-3 px-3 py-2.5 rounded-xl border border-red-500/30 bg-red-500/[0.06] text-xs"
                  >
                    <p className="text-red-300 font-medium flex items-center gap-1.5">
                      <FiAlertCircle size={13} className="flex-shrink-0" />
                      {unavailable ? `Delivery not available to PIN code ${unavailable.pincode}` : quoteError.message}
                    </p>
                    {unavailable?.supportedZones?.length > 0 && (
                      <p className="text-dark-400 mt-1.5 leading-relaxed">
                        We currently deliver to:{' '}
                        {unavailable.supportedZones.map((z) => `${z.area} (${z.pincode})`).join(', ')}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
              className="card p-5"
            >
              <SectionHeader n={2} icon={FiCreditCard} title="Payment" done={false} />
              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-gold-500/50 bg-gold-500/[0.06]">
                <span className="mt-0.5 w-4 h-4 rounded-full border-2 border-gold-500 flex items-center justify-center flex-shrink-0">
                  <span className="w-2 h-2 rounded-full bg-gold-500" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">Online Payment (Razorpay)</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {['UPI', 'Credit / Debit Card', 'Net Banking', 'Wallets'].map((m) => (
                      <span key={m} className="px-2 py-0.5 rounded-md bg-dark-700/80 border border-white/5 text-dark-300 text-[11px]">{m}</span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-dark-500 text-xs leading-relaxed mt-3 flex items-start gap-1.5">
                <FiShield size={12} className="text-gold-500 mt-0.5 flex-shrink-0" />
                All transactions are secure and encrypted. Payment is processed only after you confirm on the Razorpay screen.
              </p>
            </motion.section>
          </div>

          {/* ── Right: Order Summary ───────────────────────────────────── */}
          <motion.aside
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
            className="card p-5 lg:sticky lg:top-24"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className={`${SERIF} text-white text-xl sm:text-2xl font-semibold leading-tight pt-0`}>Order Summary</h2>
              <span className="font-jakarta text-xs text-dark-400 flex items-center gap-1"><FiShoppingBag size={12} /> {itemCount} item{itemCount === 1 ? '' : 's'}</span>
            </div>

            {/* Items */}
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto scrollbar-hide -mx-1 px-1" data-lenis-prevent="true">
              {items.map((item) => (
                <div key={item._id} className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-dark-700 flex-shrink-0 border border-white/5">
                    <img
                      src={item.images?.[0]?.url ? resolveImageUrl(item.images[0].url) : jewelryImg}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.src = jewelryImg; }}
                    />
                    {item.quantity > 1 && (
                      <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gold-500 text-dark-900 text-[10px] font-bold flex items-center justify-center">{item.quantity}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{item.name}</p>
                    <p className="text-dark-500 text-xs">{formatPrice(item.discountedPrice ?? item.price)} × {item.quantity}</p>
                  </div>
                  <span className="text-gold-400 text-sm font-semibold whitespace-nowrap">
                    {formatPrice((item.discountedPrice ?? item.price) * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Pricing breakdown — values come from the server quote */}
            <div className="border-t border-white/10 pt-3.5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-400">Subtotal</span>
                <span className="text-white">{formatPrice(quote?.pricing?.itemsPrice ?? total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">GST (3%)</span>
                <span className="text-white">{quote ? formatPrice(quote.pricing.taxPrice) : '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-dark-400 min-w-0">
                  Shipping
                  {quote?.delivery && <span className="block text-[11px] text-dark-500">{quote.delivery.area} · {quote.delivery.pincode}</span>}
                </span>
                <span className={`whitespace-nowrap ${unavailable ? 'text-red-400 text-xs font-medium' : 'text-white'}`}>
                  {shippingText}
                </span>
              </div>
              <div className="border-t border-white/10 pt-3 mt-1 flex justify-between items-baseline">
                <span className="text-white font-semibold">Total</span>
                <span className="text-gold-400 text-xl font-bold">{grandTotal !== null ? formatPrice(grandTotal) : '—'}</span>
              </div>
            </div>

            {/* Pay button */}
            <motion.button
              id="pay-now-btn"
              onClick={handlePayment}
              disabled={payDisabled}
              whileTap={payDisabled ? undefined : { scale: 0.98 }}
              className="group relative overflow-hidden btn-gold w-full py-3.5 mt-5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {!payDisabled && (
                <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] translate-x-0 group-hover:translate-x-[420%] transition-transform duration-1000" aria-hidden="true" />
              )}
              <span className="relative flex items-center justify-center gap-2">{payLabel}</span>
            </motion.button>

            <AnimatePresence>
              {!addressReady && !addrLoading && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="text-dark-500 text-xs text-center mt-2.5">
                  Complete your delivery address to continue
                </motion.p>
              )}
            </AnimatePresence>

            {processing && (
              <p className="text-dark-500 text-xs text-center mt-2 flex items-center justify-center gap-1">
                <FiAlertCircle size={11} />
                Do not close this tab while payment is in progress
              </p>
            )}

            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-center gap-4 text-[11px] text-dark-500">
              <span className="flex items-center gap-1"><FiLock size={11} className="text-gold-500/80" /> Encrypted payment</span>
              <span className="w-1 h-1 rounded-full bg-dark-600" />
              <span className="flex items-center gap-1"><FiShield size={11} className="text-gold-500/80" /> Powered by Razorpay</span>
            </div>
          </motion.aside>
        </div>
      </div>

      {/* Mobile pay bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-white/10 bg-dark-900/95 backdrop-blur-md px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-dark-500 text-[11px] uppercase tracking-wider">Total</p>
          <p className="text-gold-400 font-bold text-lg leading-tight">{grandTotal !== null ? formatPrice(grandTotal) : '—'}</p>
        </div>
        <button
          id="pay-now-btn-mobile"
          onClick={handlePayment}
          disabled={payDisabled}
          className="btn-gold py-3 px-5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {processing ? 'Processing…' : <><FiLock size={14} /> Pay Securely</>}
        </button>
      </div>
    </div>
  );
}
