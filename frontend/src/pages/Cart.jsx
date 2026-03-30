import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiTrash2, FiMinus, FiPlus, FiShoppingBag, FiArrowRight } from 'react-icons/fi';
import jewelryImg from '../assets/necklace.webp';
import {
  selectCartItems, selectCartTotal,
  removeFromCart, updateQuantity, clearCart,
} from '../store/cartSlice';
import { selectIsAuthenticated } from '../store/authSlice';
import { formatPrice } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function Cart() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const items = useSelector(selectCartItems);
  const total = useSelector(selectCartTotal);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const shipping = total > 999 ? 0 : 99;
  const tax = Math.round(total * 0.03);
  const grandTotal = total + shipping + tax;

  useEffect(() => { document.title = 'Cart — M&B Jewelry'; }, []);

  if (items.length === 0) {
    return (
      <div className="min-h-screen pt-28 flex items-center justify-center">
        <div className="text-center px-6">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-8xl mb-6">🛒</motion.div>
          <h2 className="font-display text-3xl text-white mb-3">Your cart is empty</h2>
          <p className="text-dark-400 mb-8">Discover our luxury jewelry collection</p>
          <Link to="/shop" className="btn-gold">Explore Shop <FiArrowRight size={16} /></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="section-title">Shopping Cart</h1>
          <div className="gold-divider mt-3 mx-0" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-dark-400 text-sm">{items.length} item{items.length > 1 ? 's' : ''}</p>
              <button
                onClick={() => { dispatch(clearCart()); toast.success('Cart cleared'); }}
                className="text-red-400 hover:text-red-300 text-sm transition-colors"
              >
                Clear All
              </button>
            </div>

            {items.map((item) => (
              <motion.div
                key={item._id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="card p-4 flex gap-4"
              >
                <Link to={`/products/${item._id}`} className="flex-shrink-0">
                  <div className="w-24 h-24 rounded-xl overflow-hidden bg-dark-700">
                    <img
                      src={item.images?.[0]?.url || jewelryImg}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </Link>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-2">
                    <div>
                      <Link to={`/products/${item._id}`} className="text-white font-medium text-sm hover:text-gold-400 transition-colors line-clamp-2">
                        {item.name}
                      </Link>
                      <p className="text-dark-500 text-xs mt-0.5">{item.material} · {item.type}</p>
                    </div>
                    <button
                      onClick={() => { dispatch(removeFromCart(item._id)); toast.success('Removed from cart'); }}
                      className="text-dark-500 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <FiTrash2 size={15} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2 bg-dark-800 rounded-xl border border-white/10 p-0.5">
                      <button
                        onClick={() => dispatch(updateQuantity({ id: item._id, quantity: item.quantity - 1 }))}
                        className="w-7 h-7 rounded-lg hover:bg-dark-700 flex items-center justify-center text-dark-400 hover:text-white transition-colors"
                      >
                        <FiMinus size={12} />
                      </button>
                      <span className="w-7 text-center text-white text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => dispatch(updateQuantity({ id: item._id, quantity: item.quantity + 1 }))}
                        disabled={item.quantity >= item.stock}
                        className="w-7 h-7 rounded-lg hover:bg-dark-700 flex items-center justify-center text-dark-400 hover:text-white transition-colors disabled:opacity-40"
                      >
                        <FiPlus size={12} />
                      </button>
                    </div>
                    <span className="text-gold-500 font-semibold">
                      {formatPrice((item.discountedPrice || item.price) * item.quantity)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="card p-6 sticky top-24">
              <h2 className="font-display text-xl text-white mb-5">Order Summary</h2>

              <div className="space-y-3 text-sm">
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
                {shipping > 0 && (
                  <p className="text-xs text-dark-500">
                    Add {formatPrice(999 - total)} more for free shipping
                  </p>
                )}
                <div className="border-t border-white/10 pt-3 flex justify-between font-semibold">
                  <span className="text-white">Total</span>
                  <span className="text-gold-500 text-lg">{formatPrice(grandTotal)}</span>
                </div>
              </div>

              <button
                id="proceed-checkout-btn"
                onClick={() => {
                  if (!isAuthenticated) {
                    navigate('/login', { state: { from: { pathname: '/checkout' } } });
                    return;
                  }
                  navigate('/checkout');
                }}
                className="btn-gold w-full mt-5 py-3.5"
              >
                {isAuthenticated ? 'Proceed to Checkout' : 'Login to Checkout'}
                <FiArrowRight size={16} />
              </button>

              <Link to="/shop" className="block text-center text-dark-400 hover:text-gold-400 text-sm mt-3 transition-colors">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
