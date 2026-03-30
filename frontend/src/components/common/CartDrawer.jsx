import { useEffect } from 'react';
import jewelryImg from '../../assets/necklace.webp';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { FiX, FiShoppingBag, FiMinus, FiPlus, FiTrash2 } from 'react-icons/fi';
import {
  selectCartItems, selectCartTotal, selectCartOpen,
  closeCart, removeFromCart, updateQuantity,
} from '../../store/cartSlice';
import { formatPrice } from '../../utils/helpers';

export default function CartDrawer() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const items = useSelector(selectCartItems);
  const total = useSelector(selectCartTotal);
  const isOpen = useSelector(selectCartOpen);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleCheckout = () => {
    dispatch(closeCart());
    navigate('/checkout');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => dispatch(closeCart())}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-full max-w-md z-50 glass shadow-xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FiShoppingBag className="text-gold-500" size={20} />
                <span className="font-display text-lg text-white">Your Cart</span>
                <span className="badge badge-gold">{items.length}</span>
              </div>
              <button
                id="close-cart-btn"
                onClick={() => dispatch(closeCart())}
                className="p-2 text-dark-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
                  <div className="w-20 h-20 rounded-full bg-dark-800 flex items-center justify-center">
                    <FiShoppingBag size={32} className="text-dark-500" />
                  </div>
                  <div>
                    <p className="text-white font-medium mb-1">Your cart is empty</p>
                    <p className="text-dark-400 text-sm">Discover our luxury jewelry collection</p>
                  </div>
                  <Link
                    to="/shop"
                    onClick={() => dispatch(closeCart())}
                    className="btn-gold text-sm py-2.5"
                  >
                    Explore Shop
                  </Link>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <motion.div
                      key={item._id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex gap-3 p-3 bg-dark-800 rounded-xl border border-white/5"
                    >
                      {/* Image */}
                      <Link to={`/products/${item._id}`} onClick={() => dispatch(closeCart())}>
                        <div className="w-18 h-18 rounded-lg overflow-hidden bg-dark-700 flex-shrink-0">
                          <img
                            src={item.images?.[0]?.url || jewelryImg}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            style={{ width: '72px', height: '72px' }}
                          />
                        </div>
                      </Link>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{item.name}</p>
                        <p className="text-dark-400 text-xs mt-0.5">{item.material} · {item.type}</p>
                        <p className="text-gold-500 font-semibold text-sm mt-1">
                          {formatPrice(item.discountedPrice || item.price)}
                        </p>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => dispatch(updateQuantity({ id: item._id, quantity: item.quantity - 1 }))}
                            className="w-6 h-6 rounded-md bg-dark-700 hover:bg-dark-600 flex items-center justify-center text-dark-300 hover:text-white transition-colors"
                          >
                            <FiMinus size={10} />
                          </button>
                          <span className="text-white text-sm w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => dispatch(updateQuantity({ id: item._id, quantity: item.quantity + 1 }))}
                            disabled={item.quantity >= item.stock}
                            className="w-6 h-6 rounded-md bg-dark-700 hover:bg-dark-600 flex items-center justify-center text-dark-300 hover:text-white transition-colors disabled:opacity-40"
                          >
                            <FiPlus size={10} />
                          </button>
                          <button
                            onClick={() => dispatch(removeFromCart(item._id))}
                            className="ml-auto p-1 text-dark-500 hover:text-red-400 transition-colors"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-5 border-t border-white/10 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-dark-400">Subtotal</span>
                  <span className="text-white font-semibold text-lg">{formatPrice(total)}</span>
                </div>
                <p className="text-dark-500 text-xs">Shipping & taxes calculated at checkout</p>
                <button
                  id="checkout-btn"
                  onClick={handleCheckout}
                  className="btn-gold w-full py-3.5 text-sm font-semibold"
                >
                  Proceed to Checkout
                </button>
                <Link
                  to="/shop"
                  onClick={() => dispatch(closeCart())}
                  className="block text-center text-dark-400 hover:text-gold-400 text-sm transition-colors"
                >
                  Continue Shopping
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
