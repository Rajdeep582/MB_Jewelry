import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { FiShoppingBag, FiStar, FiShare2, FiChevronLeft, FiChevronRight, FiMinus, FiPlus, FiPackage, FiShield } from 'react-icons/fi';
import { fetchProduct, selectCurrentProduct } from '../store/productSlice';
import { addToCart, openCart } from '../store/cartSlice';
import { selectIsAuthenticated } from '../store/authSlice';
import { formatPrice, generateStars, formatDate } from '../utils/helpers';
import { productService } from '../services/services';
import { ProductDetailSkeleton } from '../components/common/Skeletons';
import toast from 'react-hot-toast';

export default function ProductDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const product = useSelector(selectCurrentProduct);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    dispatch(fetchProduct(id)).finally(() => setLoading(false));
    window.scrollTo(0, 0);
  }, [id, dispatch]);

  useEffect(() => {
    if (product) document.title = `${product.name} — M&B Jewelry`;
  }, [product]);

  if (loading) {
    return (
      <div className="min-h-screen pt-28 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ProductDetailSkeleton />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen pt-28 flex items-center justify-center">
        <div className="text-center">
          <p className="text-dark-400">Product not found.</p>
          <button onClick={() => navigate('/shop')} className="btn-gold mt-4 text-sm">Back to Shop</button>
        </div>
      </div>
    );
  }

  const { name, description, price, discountedPrice, images, material, type, stock, averageRating, numReviews, ratings, category } = product;

  const handleAddToCart = () => {
    if (stock === 0) return;
    dispatch(addToCart({ ...product, quantity }));
    dispatch(openCart());
    toast.success(`${name} added to cart! 💎`);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) { toast.error('Please login to review'); return; }
    setSubmitting(true);
    try {
      await productService.addReview(id, { rating: reviewRating, comment: reviewText });
      toast.success('Review submitted!');
      dispatch(fetchProduct(id));
      setReviewText('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const placeholderImg = 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&q=80';
  const displayImages = images?.length > 0 ? images : [{ url: placeholderImg }];

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-dark-500 mb-8">
          <button onClick={() => navigate('/')} className="hover:text-gold-400 transition-colors">Home</button>
          <span>/</span>
          <button onClick={() => navigate('/shop')} className="hover:text-gold-400 transition-colors">Shop</button>
          <span>/</span>
          <span className="text-dark-400">{name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
          {/* Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-dark-800 group">
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImg}
                  src={displayImages[activeImg]?.url || placeholderImg}
                  alt={name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="w-full h-full object-cover"
                />
              </AnimatePresence>
              {displayImages.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImg((p) => (p === 0 ? displayImages.length - 1 : p - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 glass rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20"
                  >
                    <FiChevronLeft />
                  </button>
                  <button
                    onClick={() => setActiveImg((p) => (p === displayImages.length - 1 ? 0 : p + 1))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 glass rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20"
                  >
                    <FiChevronRight />
                  </button>
                </>
              )}
            </div>
            {/* Thumbnails */}
            {displayImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {displayImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                      activeImg === i ? 'border-gold-500' : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-5"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="badge badge-gold">{material}</span>
                <span className="badge bg-dark-700 text-dark-300 border border-white/10">{type}</span>
                {stock === 0 && <span className="badge badge-red">Out of Stock</span>}
                {stock > 0 && stock <= 5 && <span className="badge badge-gold">Only {stock} left!</span>}
              </div>
              <h1 className="font-display text-3xl md:text-4xl text-white font-medium leading-tight">{name}</h1>
            </div>

            {/* Rating */}
            {numReviews > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex">
                  {generateStars(averageRating).map((type, i) => (
                    <FiStar key={i} size={15} className={type === 'filled' ? 'fill-gold-400 text-gold-400' : 'text-dark-600'} />
                  ))}
                </div>
                <span className="text-gold-400 text-sm font-medium">{averageRating}</span>
                <span className="text-dark-500 text-sm">({numReviews} reviews)</span>
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold text-gold-500">
                {formatPrice(discountedPrice || price)}
              </span>
              {discountedPrice && (
                <>
                  <span className="text-dark-400 text-lg line-through">{formatPrice(price)}</span>
                  <span className="badge badge-red">Save {formatPrice(price - discountedPrice)}</span>
                </>
              )}
            </div>

            {/* Description */}
            <p className="text-dark-300 text-sm leading-relaxed">{description}</p>

            {/* Quantity */}
            {stock > 0 && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-dark-400">Quantity</span>
                <div className="flex items-center gap-2 bg-dark-800 rounded-xl border border-white/10 p-1">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 rounded-lg hover:bg-dark-700 flex items-center justify-center text-dark-400 hover:text-white transition-colors"
                  >
                    <FiMinus size={14} />
                  </button>
                  <span className="w-8 text-center text-white font-medium">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(stock, quantity + 1))}
                    className="w-8 h-8 rounded-lg hover:bg-dark-700 flex items-center justify-center text-dark-400 hover:text-white transition-colors"
                  >
                    <FiPlus size={14} />
                  </button>
                </div>
                <span className="text-xs text-dark-500">{stock} available</span>
              </div>
            )}

            {/* Add to Cart */}
            <div className="flex gap-3">
              <button
                id="add-to-cart-detail-btn"
                onClick={handleAddToCart}
                disabled={stock === 0}
                className="flex-1 btn-gold py-4 text-sm gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiShoppingBag size={16} />
                {stock === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success('Link copied!');
                }}
                className="p-4 rounded-xl bg-dark-800 border border-white/10 text-dark-400 hover:text-white transition-colors"
              >
                <FiShare2 size={16} />
              </button>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="glass-gold rounded-xl p-3 flex items-center gap-2">
                <FiShield size={16} className="text-gold-500 flex-shrink-0" />
                <p className="text-xs text-dark-300">Certified Authentic</p>
              </div>
              <div className="glass-gold rounded-xl p-3 flex items-center gap-2">
                <FiPackage size={16} className="text-gold-500 flex-shrink-0" />
                <p className="text-xs text-dark-300">Premium Packaging</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Reviews Section */}
        <div className="max-w-3xl">
          <h2 className="font-display text-2xl text-white mb-6">
            Customer Reviews <span className="text-dark-500 text-base font-sans">({numReviews})</span>
          </h2>

          {/* Write a review */}
          <div className="card p-5 mb-6">
            <h3 className="text-white font-medium mb-4">Write a Review</h3>
            <form onSubmit={handleSubmitReview} className="space-y-3">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button type="button" key={star} onClick={() => setReviewRating(star)}>
                    <FiStar size={20} className={star <= reviewRating ? 'fill-gold-400 text-gold-400' : 'text-dark-600 hover:text-gold-400'} />
                  </button>
                ))}
              </div>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder={isAuthenticated ? 'Share your experience...' : 'Login to write a review'}
                disabled={!isAuthenticated}
                rows={3}
                className="input-dark resize-none text-sm"
              />
              {isAuthenticated && (
                <button type="submit" disabled={submitting} className="btn-gold text-sm py-2.5">
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </button>
              )}
            </form>
          </div>

          {/* Review list */}
          {ratings?.length > 0 ? (
            <div className="space-y-4">
              {ratings.map((review, i) => (
                <div key={i} className="card p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gold-gradient flex items-center justify-center text-dark-900 text-sm font-bold">
                      {review.user?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{review.user?.name || 'Anonymous'}</p>
                      <p className="text-dark-500 text-xs">{formatDate(review.createdAt)}</p>
                    </div>
                    <div className="ml-auto flex">
                      {Array.from({ length: review.rating }).map((_, j) => (
                        <FiStar key={j} size={12} className="fill-gold-400 text-gold-400" />
                      ))}
                    </div>
                  </div>
                  {review.comment && <p className="text-dark-400 text-sm">{review.comment}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-dark-400 text-sm text-center py-8">No reviews yet. Be the first to review!</p>
          )}
        </div>
      </div>
    </div>
  );
}
