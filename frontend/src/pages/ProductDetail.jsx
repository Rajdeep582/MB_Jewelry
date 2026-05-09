import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiShoppingBag, FiStar, FiShare2, FiChevronLeft, FiChevronRight,
  FiMinus, FiPlus, FiPackage, FiShield, FiCheckCircle, FiX, FiMessageSquare,
} from 'react-icons/fi';
import { fetchProduct, selectCurrentProduct } from '../store/productSlice';
import { addToCart, openCart } from '../store/cartSlice';
import { selectIsAuthenticated } from '../store/authSlice';
import { formatPrice, generateStars, formatDate, resolveImageUrl } from '../utils/helpers';
import { productService } from '../services/services';
import { ProductDetailSkeleton } from '../components/common/Skeletons';
import ProductCard from '../components/shop/ProductCard';
import toast from 'react-hot-toast';

// ── Star Row ──────────────────────────────────────────────────────────────────
function StarRow({ rating, size = 14, interactive = false, hoverRating = 0, onHover, onClick }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = interactive ? s <= (hoverRating || rating) : s <= Math.round(rating);
        return (
          <button
            key={s}
            type={interactive ? 'button' : undefined}
            onClick={interactive ? () => onClick(s) : undefined}
            onMouseEnter={interactive ? () => onHover(s) : undefined}
            onMouseLeave={interactive ? () => onHover(0) : undefined}
            className={interactive ? 'cursor-pointer transition-transform hover:scale-110' : 'cursor-default pointer-events-none'}
          >
            <FiStar
              size={size}
              className={filled ? 'fill-gold-400 text-gold-400' : 'text-dark-600'}
            />
          </button>
        );
      })}
    </div>
  );
}

// ── Review Card ───────────────────────────────────────────────────────────────
function ReviewCard({ review }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-800/60 border border-white/6 rounded-2xl p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-gold-gradient flex items-center justify-center text-dark-900 text-sm font-bold flex-shrink-0">
          {review.user?.name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-white text-sm font-semibold">{review.user?.name || 'Anonymous'}</span>
            {review.isVerifiedPurchase && (
              <span className="flex items-center gap-0.5 text-emerald-400 text-[10px] font-medium">
                <FiCheckCircle size={11} />
                Verified Purchase
              </span>
            )}
            <span className="text-dark-600 text-xs ml-auto flex-shrink-0">{formatDate(review.createdAt)}</span>
          </div>
          <StarRow rating={review.rating} size={12} />
          {review.title && (
            <p className="text-white text-sm font-medium mt-1.5">{review.title}</p>
          )}
          {review.comment && (
            <p className="text-dark-400 text-sm mt-1 leading-relaxed">{review.comment}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── All Reviews Modal ─────────────────────────────────────────────────────────
function AllReviewsModal({ reviews, onClose, productName, averageRating, numReviews }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full sm:max-w-2xl max-h-[90vh] bg-dark-900 border border-white/10 rounded-t-3xl sm:rounded-2xl flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/8 flex-shrink-0">
            <div>
              <h3 className="font-display text-lg text-white">All Reviews</h3>
              <p className="text-dark-400 text-xs mt-0.5">{productName}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-gold-400 font-jakarta text-2xl font-semibold leading-none">{averageRating}</p>
                <div className="flex mt-0.5">
                  <StarRow rating={averageRating} size={11} />
                </div>
                <p className="text-dark-500 text-[10px] mt-0.5">{numReviews} reviews</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-dark-800 flex items-center justify-center text-dark-400 hover:text-white transition-colors"
              >
                <FiX size={16} />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="overflow-y-auto flex-1 p-5 space-y-3">
            {reviews.length === 0 ? (
              <p className="text-dark-400 text-sm text-center py-12">No reviews yet.</p>
            ) : (
              reviews.map((review, i) => <ReviewCard key={review._id || i} review={review} />)
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Related Products Slider ───────────────────────────────────────────────────
function RelatedProducts({ categoryId, currentProductId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const trackRef                = useRef(null);
  const navigate                = useNavigate();

  useEffect(() => {
    if (!categoryId) { setLoading(false); return; }
    setLoading(true);
    productService.getProducts({ category: categoryId, limit: 12 })
      .then(res => {
        const all = res.data?.products || [];
        setProducts(all.filter(p => p._id !== currentProductId));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [categoryId, currentProductId]);

  const scroll = (dir) => {
    const track = trackRef.current;
    if (!track) return;
    const cardW = track.querySelector('[data-card]')?.offsetWidth || 260;
    track.scrollBy({ left: dir * (cardW + 16), behavior: 'smooth' });
  };

  if (!loading && products.length === 0) return null;

  return (
    <section className="border-t border-white/8 pt-12 pb-2">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="section-subtitle mb-1">Discover More</p>
          <h2 className="font-display text-2xl text-white">You May Also Like</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll(-1)}
            className="w-9 h-9 rounded-full border border-white/10 bg-dark-800 flex items-center justify-center text-dark-400 hover:text-white hover:border-gold-500/40 transition-all"
          >
            <FiChevronLeft size={16} />
          </button>
          <button
            onClick={() => scroll(1)}
            className="w-9 h-9 rounded-full border border-white/10 bg-dark-800 flex items-center justify-center text-dark-400 hover:text-white hover:border-gold-500/40 transition-all"
          >
            <FiChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-56 h-72 rounded-2xl bg-dark-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div
          ref={trackRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {products.map(p => (
            <div
              key={p._id}
              data-card
              className="flex-shrink-0 w-56 sm:w-64"
              style={{ scrollSnapAlign: 'start' }}
            >
              <ProductCard product={p} view="grid" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
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
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    setLoading(true);
    dispatch(fetchProduct(id)).finally(() => setLoading(false));
    window.scrollTo(0, 0);
  }, [id, dispatch]);

  useEffect(() => {
    if (product) document.title = `${product.name} — M.B. JEWELLERS`;
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

  const { name, description, price, discountedPrice, images, material, purity, stock,
    averageRating, numReviews, ratings, category, weightValue, unit } = product;

  const handleAddToCart = () => {
    if (stock === 0) return;
    dispatch(addToCart({ ...product, quantity }));
    dispatch(openCart());
    toast.success(`${name} added to cart! 💎`);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) { toast.error('Please login to review'); return; }
    if (reviewText.trim().length < 10) { toast.error('Review must be at least 10 characters'); return; }
    setSubmitting(true);
    try {
      await productService.addReview(id, { rating: reviewRating, comment: reviewText, title: reviewTitle });
      toast.success('Review submitted!');
      dispatch(fetchProduct(id));
      setReviewText('');
      setReviewTitle('');
      setReviewRating(5);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const placeholderImg = 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&q=80';
  const displayImages = images?.length > 0 ? images : [{ url: placeholderImg }];

  // Star distribution
  const starDist = [5, 4, 3, 2, 1].map((s) => {
    const count = ratings?.filter((r) => r.rating === s).length || 0;
    return { star: s, count, pct: ratings?.length ? (count / ratings.length) * 100 : 0 };
  });

  const savings = discountedPrice ? price - discountedPrice : 0;
  const displayPrice = discountedPrice || price;

  return (
    <div className="min-h-screen pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-dark-500 mb-4">
          <button onClick={() => navigate('/')} className="hover:text-gold-400 transition-colors">Home</button>
          <span>/</span>
          <button onClick={() => navigate('/shop')} className="hover:text-gold-400 transition-colors">Shop</button>
          {category?.name && (
            <>
              <span>/</span>
              <button
                onClick={() => navigate(`/shop?category=${category._id}`)}
                className="hover:text-gold-400 transition-colors"
              >{category.name}</button>
            </>
          )}
          <span>/</span>
          <span className="text-dark-400 truncate max-w-[160px]">{name}</span>
        </nav>

        {/* Product Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-20 items-start">

          {/* ── Image Gallery ── */}
          <div className="space-y-2.5">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-dark-900 to-dark-950 border border-white/6 group shadow-xl"
              style={{ aspectRatio: '6/5' }}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImg}
                  src={displayImages[activeImg]?.url ? resolveImageUrl(displayImages[activeImg].url) : placeholderImg}
                  alt={name}
                  initial={{ opacity: 0, scale: 1.02 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="w-full h-full object-cover"
                />
              </AnimatePresence>

              {/* Stock badge overlay */}
              {stock === 0 && (
                <div className="absolute inset-0 bg-dark-900/60 flex items-center justify-center">
                  <span className="badge badge-red text-sm px-4 py-2">Out of Stock</span>
                </div>
              )}

              {/* Nav arrows */}
              {displayImages.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImg((p) => (p === 0 ? displayImages.length - 1 : p - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 glass rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20"
                  >
                    <FiChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setActiveImg((p) => (p === displayImages.length - 1 ? 0 : p + 1))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 glass rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20"
                  >
                    <FiChevronRight size={16} />
                  </button>
                </>
              )}

              {/* Image counter */}
              {displayImages.length > 1 && (
                <div className="absolute bottom-3 right-3 glass px-2.5 py-1 rounded-full text-xs text-white/70">
                  {activeImg + 1} / {displayImages.length}
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {displayImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {displayImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    className={`flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                      activeImg === i ? 'border-gold-500 shadow-gold' : 'border-white/8 hover:border-white/25'
                    }`}
                  >
                    <img src={resolveImageUrl(img.url)} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Product Info ── */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-3.5"
          >
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="badge badge-gold">{material}</span>
              {purity && <span className="badge badge-blue">{purity}</span>}
              {stock === 0 && <span className="badge badge-red">Out of Stock</span>}
              {stock > 0 && stock <= 5 && <span className="badge badge-gold">Only {stock} left</span>}
            </div>

            {/* Name */}
            <h1 className="font-display text-2xl md:text-3xl text-white font-medium leading-tight tracking-tight">
              {name}
            </h1>

            {/* Rating row */}
            <div className="flex items-center gap-2">
              {numReviews > 0 ? (
                <>
                  <StarRow rating={averageRating} size={13} />
                  <span className="text-gold-400 text-xs font-semibold font-jakarta">{averageRating}</span>
                  <button
                    onClick={() => document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' })}
                    className="text-dark-500 text-xs hover:text-dark-300 transition-colors"
                  >
                    ({numReviews} {numReviews === 1 ? 'review' : 'reviews'})
                  </button>
                </>
              ) : (
                <span className="text-dark-600 text-xs">No reviews yet</span>
              )}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-2xl md:text-3xl font-bold text-gold-500 font-jakarta">
                {formatPrice(displayPrice)}
              </span>
              {discountedPrice && (
                <>
                  <span className="text-dark-500 text-base line-through font-jakarta">{formatPrice(price)}</span>
                  <span className="badge badge-green">Save {formatPrice(savings)}</span>
                </>
              )}
            </div>

            {/* Description */}
            <p className="text-dark-400 text-sm leading-relaxed border-t border-white/6 pt-3">
              {description}
            </p>

            {/* Specs row */}
            {(weightValue || purity || material) && (
              <div className="grid grid-cols-3 gap-2">
                {material && (
                  <div className="bg-dark-800/50 rounded-xl p-2.5 text-center border border-white/5">
                    <p className="text-[9px] text-dark-500 uppercase tracking-wider mb-0.5">Material</p>
                    <p className="text-white text-sm font-medium">{material}</p>
                  </div>
                )}
                {purity && (
                  <div className="bg-dark-800/50 rounded-xl p-2.5 text-center border border-white/5">
                    <p className="text-[9px] text-dark-500 uppercase tracking-wider mb-0.5">Purity</p>
                    <p className="text-white text-sm font-medium">{purity}</p>
                  </div>
                )}
                {weightValue && (
                  <div className="bg-dark-800/50 rounded-xl p-2.5 text-center border border-white/5">
                    <p className="text-[9px] text-dark-500 uppercase tracking-wider mb-0.5">Weight</p>
                    <p className="text-white text-sm font-medium">{weightValue}{unit || 'g'}</p>
                  </div>
                )}
              </div>
            )}

            {/* Quantity */}
            {stock > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-dark-400">Qty</span>
                <div className="flex items-center bg-dark-800 rounded-xl border border-white/10 p-1">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-7 h-7 rounded-lg hover:bg-dark-700 flex items-center justify-center text-dark-400 hover:text-white transition-colors"
                  >
                    <FiMinus size={12} />
                  </button>
                  <span className="w-8 text-center text-white text-sm font-semibold">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(stock, quantity + 1))}
                    className="w-7 h-7 rounded-lg hover:bg-dark-700 flex items-center justify-center text-dark-400 hover:text-white transition-colors"
                  >
                    <FiPlus size={12} />
                  </button>
                </div>
                <span className="text-xs text-dark-600">{stock} in stock</span>
              </div>
            )}

            {/* CTA */}
            <div className="flex gap-2.5">
              <button
                id="add-to-cart-detail-btn"
                onClick={handleAddToCart}
                disabled={stock === 0}
                className="flex-1 btn-gold py-3 text-sm gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiShoppingBag size={15} />
                {stock === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!'); }}
                className="p-3 rounded-xl bg-dark-800 border border-white/10 text-dark-400 hover:text-white transition-colors"
                title="Share"
              >
                <FiShare2 size={15} />
              </button>
            </div>

            {/* Trust badges */}
            <div className="flex gap-2">
              <div className="glass-gold rounded-xl p-2.5 flex items-center gap-2 flex-1">
                <FiShield size={13} className="text-gold-500 flex-shrink-0" />
                <p className="text-xs text-dark-300">Certified Authentic</p>
              </div>
              <div className="glass-gold rounded-xl p-2.5 flex items-center gap-2 flex-1">
                <FiPackage size={13} className="text-gold-500 flex-shrink-0" />
                <p className="text-xs text-dark-300">Premium Packaging</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Related Products ── */}
        <div className="mt-20">
          <RelatedProducts categoryId={category?._id} currentProductId={id} />
        </div>

        {/* ── Reviews Section ── */}
        <div id="reviews-section" className="border-t border-white/8 mt-20 pt-16">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="section-subtitle mb-1">What Customers Say</p>
              <h2 className="font-display text-2xl text-white">
                Reviews
                <span className="text-dark-500 text-base font-sans font-normal ml-2">({numReviews})</span>
              </h2>
            </div>
            {numReviews > 3 && (
              <button
                onClick={() => setShowAllReviews(true)}
                className="btn-outline-gold text-sm py-2 px-4"
              >
                View All {numReviews}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
            {/* Rating Summary */}
            <div className="card p-5 h-fit">
              <div className="text-center pb-4 mb-4 border-b border-white/8">
                <p className="font-jakarta text-5xl text-gold-400 font-semibold leading-none mb-2">
                  {numReviews > 0 ? averageRating : '—'}
                </p>
                <StarRow rating={averageRating} size={16} />
                <p className="text-dark-500 text-xs mt-2">{numReviews} {numReviews === 1 ? 'review' : 'reviews'}</p>
              </div>
              <div className="space-y-2">
                {starDist.map(({ star, count, pct }) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-dark-500 text-xs w-3">{star}</span>
                    <FiStar size={10} className="text-dark-600 flex-shrink-0" />
                    <div className="flex-1 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-dark-600 text-xs w-4 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews + Write Form */}
            <div className="space-y-4">
              {/* Write Review */}
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FiMessageSquare size={15} className="text-gold-500" />
                  <h3 className="text-white font-medium text-sm">Write a Review</h3>
                </div>

                {!isAuthenticated ? (
                  <p className="text-dark-400 text-sm">
                    <button onClick={() => navigate('/auth?type=login')} className="text-gold-400 hover:underline">Log in</button>
                    {' '}to leave a review.
                  </p>
                ) : (
                  <form onSubmit={handleSubmitReview} className="space-y-3">
                    {/* Star Picker */}
                    <div className="flex items-center gap-3">
                      <span className="text-dark-400 text-xs">Your rating</span>
                      <StarRow
                        rating={reviewRating}
                        size={22}
                        interactive
                        hoverRating={hoverRating}
                        onHover={setHoverRating}
                        onClick={setReviewRating}
                      />
                      <span className="text-gold-400 text-xs font-medium">{hoverRating || reviewRating}/5</span>
                    </div>

                    <input
                      type="text"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      placeholder="Review title (optional)"
                      className="input-dark text-sm py-2.5"
                      maxLength={100}
                    />
                    <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Share your experience... (min. 10 characters)"
                      rows={3}
                      className="input-dark resize-none text-sm"
                      maxLength={1000}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-dark-600 text-[10px]">Only verified purchasers can post reviews</p>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="btn-gold text-sm py-2 px-5 disabled:opacity-60"
                      >
                        {submitting ? 'Submitting…' : 'Submit'}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Latest 3 Reviews */}
              {ratings?.length > 0 ? (
                <>
                  {ratings.slice(0, 3).map((review, i) => (
                    <ReviewCard key={review._id || i} review={review} />
                  ))}
                  {numReviews > 3 && (
                    <button
                      onClick={() => setShowAllReviews(true)}
                      className="w-full py-3 rounded-2xl border border-white/10 text-dark-400 hover:text-white hover:border-white/25 text-sm transition-all"
                    >
                      View all {numReviews} reviews →
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-10 text-dark-500 text-sm">
                  No reviews yet. Purchase this product to be the first to review!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* All Reviews Modal */}
      {showAllReviews && (
        <AllReviewsModal
          reviews={ratings || []}
          onClose={() => setShowAllReviews(false)}
          productName={name}
          averageRating={averageRating}
          numReviews={numReviews}
        />
      )}
    </div>
  );
}
