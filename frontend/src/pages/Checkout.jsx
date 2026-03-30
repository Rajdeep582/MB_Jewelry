import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiPlus, FiMapPin, FiCreditCard, FiCheck } from 'react-icons/fi';
import { selectCartItems, selectCartTotal, clearCart } from '../store/cartSlice';
import { selectUser } from '../store/authSlice';
import { orderService, userService } from '../services/services';
import { formatPrice } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function Checkout() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const items = useSelector(selectCartItems);
  const total = useSelector(selectCartTotal);
  const user = useSelector(selectUser);

  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [newAddr, setNewAddr] = useState({
    fullName: user?.name || '', phone: '', addressLine1: '', addressLine2: '',
    city: '', state: '', pincode: '', country: 'India',
  });

  const shipping = total > 999 ? 0 : 99;
  const tax = Math.round(total * 0.03);
  const grandTotal = total + shipping + tax;

  useEffect(() => {
    document.title = 'Checkout — M&B Jewelry';
    if (items.length === 0) navigate('/cart');
    userService.getProfile().then((res) => {
      const addrs = res.data.user.addresses;
      setAddresses(addrs);
      const def = addrs.find((a) => a.isDefault) || addrs[0];
      if (def) setSelectedAddress(def._id);
    });
  }, []);

  const loadRazorpay = () =>
    new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handlePayment = async () => {
    const addr = addresses.find((a) => a._id === selectedAddress);
    if (!addr && !showNewAddress) {
      toast.error('Please select a delivery address');
      return;
    }

    const shippingAddress = addr || newAddr;

    if (showNewAddress) {
      const required = ['fullName', 'phone', 'addressLine1', 'city', 'state', 'pincode'];
      for (const key of required) {
        if (!newAddr[key]) { toast.error(`Please fill in ${key}`); return; }
      }
    }

    setProcessing(true);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) { toast.error('Payment gateway failed to load'); return; }

      // Create Razorpay order via backend
      const { data } = await orderService.createPayment({
        items: items.map((i) => ({ productId: i._id, quantity: i.quantity })),
        shippingAddress,
      });

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: data.currency,
        name: 'M&B Jewelry',
        description: 'Luxury Jewelry Purchase',
        order_id: data.razorpayOrderId,
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: newAddr.phone || addr?.phone,
        },
        theme: { color: '#D4AF37' },
        handler: async (response) => {
          try {
            const verifyRes = await orderService.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              orderItems: data.orderItems,
              shippingAddress,
              pricing: data.pricing,
            });
            dispatch(clearCart());
            toast.success('Order placed successfully! 🎉', { duration: 4000 });
            navigate(`/orders/${verifyRes.data.order._id}`);
          } catch {
            toast.error('Payment verification failed. Contact support.');
          }
        },
        modal: {
          ondismiss: () => { setProcessing(false); toast.error('Payment cancelled'); },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="section-title">Checkout</h1>
          <div className="gold-divider mt-3 mx-0" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Address */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Address */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-5">
                <FiMapPin className="text-gold-500" />
                <h2 className="font-display text-xl text-white">Delivery Address</h2>
              </div>

              {/* Address list */}
              <div className="space-y-3 mb-4">
                {addresses.map((addr) => (
                  <div
                    key={addr._id}
                    onClick={() => { setSelectedAddress(addr._id); setShowNewAddress(false); }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedAddress === addr._id && !showNewAddress
                        ? 'border-gold-500 bg-gold-500/5'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white text-sm font-medium">{addr.fullName}</p>
                          {addr.isDefault && <span className="badge badge-gold text-xs">Default</span>}
                        </div>
                        <p className="text-dark-400 text-xs">{addr.addressLine1}, {addr.city}, {addr.state} — {addr.pincode}</p>
                        <p className="text-dark-500 text-xs">{addr.phone}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        selectedAddress === addr._id && !showNewAddress ? 'border-gold-500' : 'border-dark-500'
                      }`}>
                        {selectedAddress === addr._id && !showNewAddress && (
                          <div className="w-2.5 h-2.5 rounded-full bg-gold-500" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add new address */}
              <button
                onClick={() => { setShowNewAddress(!showNewAddress); setSelectedAddress(null); }}
                className="flex items-center gap-2 text-gold-500 hover:text-gold-400 text-sm transition-colors"
              >
                <FiPlus size={16} />
                {showNewAddress ? 'Cancel' : 'Add New Address'}
              </button>

              {showNewAddress && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  {[
                    { name: 'fullName', label: 'Full Name', col: 2 },
                    { name: 'phone', label: 'Phone', col: 1 },
                    { name: 'addressLine1', label: 'Address Line 1', col: 2 },
                    { name: 'addressLine2', label: 'Address Line 2 (optional)', col: 2 },
                    { name: 'city', label: 'City', col: 1 },
                    { name: 'state', label: 'State', col: 1 },
                    { name: 'pincode', label: 'PIN Code', col: 1 },
                  ].map(({ name, label, col }) => (
                    <div key={name} className={col === 2 ? 'sm:col-span-2' : ''}>
                      <label className="label-dark">{label}</label>
                      <input
                        type="text"
                        value={newAddr[name]}
                        onChange={(e) => setNewAddr({ ...newAddr, [name]: e.target.value })}
                        className="input-dark text-sm"
                      />
                    </div>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Payment Note */}
            <div className="glass-gold rounded-2xl p-4 flex items-start gap-3">
              <FiCreditCard className="text-gold-500 mt-0.5 flex-shrink-0" size={18} />
              <div>
                <p className="text-white text-sm font-medium mb-1">Secure Payment via Razorpay</p>
                <p className="text-dark-400 text-xs leading-relaxed">
                  All transactions are 100% secure. We accept UPI, Cards, Net Banking, and Wallets.
                  Payment is processed only after you confirm on the Razorpay screen.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Summary */}
          <div>
            <div className="card p-5 sticky top-24">
              <h2 className="font-display text-xl text-white mb-4">Order Summary</h2>

              <div className="space-y-3 mb-5 max-h-60 overflow-y-auto scrollbar-hide">
                {items.map((item) => (
                  <div key={item._id} className="flex gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-dark-700 flex-shrink-0">
                      <img src={item.images?.[0]?.url || ''} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{item.name}</p>
                      <p className="text-dark-500 text-xs">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-gold-500 text-xs font-semibold">
                      {formatPrice((item.discountedPrice || item.price) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

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
                <div className="flex justify-between">
                  <span className="text-dark-400">GST (3%)</span>
                  <span className="text-white">{formatPrice(tax)}</span>
                </div>
                <div className="border-t border-white/10 pt-3 flex justify-between font-semibold">
                  <span className="text-white">Total</span>
                  <span className="text-gold-500 text-lg">{formatPrice(grandTotal)}</span>
                </div>
              </div>

              <button
                id="pay-now-btn"
                onClick={handlePayment}
                disabled={processing}
                className="btn-gold w-full py-3.5 mt-5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <>
                    <FiCheck size={16} />
                    Pay {formatPrice(grandTotal)}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
