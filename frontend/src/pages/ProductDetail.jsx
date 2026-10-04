import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiShoppingBag, FiStar, FiShare2, FiChevronLeft, FiChevronRight,
  FiMinus, FiPlus, FiPackage, FiShield, FiCheckCircle, FiX, FiMessageSquare,
  FiHeart, FiZap, FiLock, FiTruck, FiMapPin, FiAward, FiArrowRight,
} from 'react-icons/fi';
import { fetchProduct, selectCurrentProduct } from '../store/productSlice';
import { addToCart, openCart } from '../store/cartSlice';
import { selectIsAuthenticated, selectUser, setUser } from '../store/authSlice';
import { formatPrice, formatDate, resolveImageUrl } from '../utils/helpers';
import { productService, orderService, userService } from '../services/services';
import { ProductDetailSkeleton, ProductCardSkeleton } from '../components/common/Skeletons';
import ProductCard from '../components/shop/ProductCard';
import toast from 'react-hot-toast';
import PropTypes from 'prop-types';

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

StarRow.propTypes = {
  rating:      PropTypes.number.isRequired,
  size:        PropTypes.number,
  interactive: PropTypes.bool,
  hoverRating: PropTypes.number,
  onHover:     PropTypes.func,
  onClick:     PropTypes.func,
};

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

ReviewCard.propTypes = {
  review: PropTypes.shape({
    user: PropTypes.shape({
      name: PropTypes.string,
    }),
    isVerifiedPurchase: PropTypes.bool,
    createdAt:          PropTypes.string,
    rating:             PropTypes.number,
    title:              PropTypes.string,
    comment:            PropTypes.string,
  }).isRequired,
};

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
              <h3 className="font-serif text-lg text-white font-semibold pt-0">All Reviews</h3>
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

AllReviewsModal.propTypes = {
  reviews:       PropTypes.arrayOf(PropTypes.object).isRequired,
  onClose:       PropTypes.func.isRequired,
  productName:   PropTypes.string,
  averageRating: PropTypes.number,
  numReviews:    PropTypes.number,
};

// ── Related Products Slider ───────────────────────────────────────────────────
function RelatedProducts({ categoryId, categoryName, material, currentProductId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [edges, setEdges]       = useState({ start: true, end: false });
  const trackRef                = useRef(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        let list = [];
        if (categoryId) {
          const res = await productService.getProducts({ category: categoryId, limit: 12 });
          list = (res.data?.products || []).filter((p) => p._id !== currentProductId);
        }
        // Too few in this category → top up with pieces of the same metal
        if (list.length < 4 && material) {
          const res = await productService.getProducts({ material, limit: 12 });
          const seen = new Set(list.map((p) => p._id));
          list = list.concat((res.data?.products || []).filter((p) => p._id !== currentProductId && !seen.has(p._id)));
        }
        if (alive) setProducts(list.slice(0, 12));
      } catch {
        if (alive) setProducts([]);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [categoryId, material, currentProductId]);

  const updateEdges = useCallback(() => {
    const t = trackRef.current;
    if (!t) return;
    setEdges({ start: t.scrollLeft <= 4, end: t.scrollLeft + t.clientWidth >= t.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [products, updateEdges]);

  const scroll = (dir) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector('[data-card]');
    const step = card ? card.offsetWidth + 16 : 260;
    track.scrollBy({ left: dir * step * (window.innerWidth >= 1024 ? 2 : 1), behavior: 'smooth' });
  };

  if (!loading && products.length === 0) return null;

  const arrowCls = 'w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-300 disabled:opacity-30 disabled:pointer-events-none border-gold-500/30 text-gold-400 hover:bg-gold-500 hover:text-dark-900 hover:border-gold-500';

  return (
    <section className="relative pt-12 sm:pt-14">
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[640px] max-w-full h-[260px] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(212,175,55,0.06),transparent_70%)]" aria-hidden="true" />
      <div className="relative flex items-end justify-between gap-4 mb-6">
        <div>
          <p className="font-jakarta text-[11px] font-semibold tracking-[0.3em] text-gold-500 uppercase mb-2">Discover more</p>
          <h2 className="font-serif text-2xl sm:text-3xl text-white font-semibold leading-tight pt-0">You may also like</h2>
          <div className="h-px w-14 bg-gradient-to-r from-gold-600 to-gold-300 mt-3" />
        </div>
        <div className="flex items-center gap-2">
          {categoryId && (
            <Link
              to={`/shop?category=${categoryId}`}
              className="hidden sm:inline-flex items-center gap-1.5 mr-2 font-jakarta text-xs font-semibold text-dark-300 hover:text-gold-400 transition-colors"
            >
              View all {categoryName || ''} <FiArrowRight size={12} />
            </Link>
          )}
          <button type="button" onClick={() => scroll(-1)} disabled={edges.start} aria-label="Previous" className={arrowCls}>
            <FiChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => scroll(1)} disabled={edges.end} aria-label="Next" className={arrowCls}>
            <FiChevronRight size={18} />
          </button>
        </div>
      </div>

      <motion.div
        className="relative -mx-4 sm:mx-0"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.5 }}
      >
        {/* edge fades hint there is more to scroll */}
        <span className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-dark-900 to-transparent transition-opacity duration-300 ${edges.start ? 'opacity-0' : 'opacity-100'}`} aria-hidden="true" />
        <span className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-dark-900 to-transparent transition-opacity duration-300 ${edges.end ? 'opacity-0' : 'opacity-100'}`} aria-hidden="true" />
        <div
          ref={trackRef}
          onScroll={updateEdges}
          className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain scrollbar-hide snap-x snap-proximity scroll-px-4 sm:scroll-px-0 px-4 sm:px-0 pt-2 pb-4"
        >
          {loading
            ? Array.from({ length: 4 }, (_, n) => n).map((n) => (
                <div key={n} className="snap-start shrink-0 w-[46vw] sm:w-60 lg:w-[248px]"><ProductCardSkeleton /></div>
              ))
            : products.map((p) => (
                <div key={p._id} data-card className="snap-start shrink-0 w-[46vw] sm:w-60 lg:w-[248px]">
                  <ProductCard product={p} view="grid" />
                </div>
              ))}
        </div>
      </motion.div>
    </section>
  );
}

RelatedProducts.propTypes = {
  categoryId:       PropTypes.string,
  categoryName:     PropTypes.string,
  material:         PropTypes.string,
  currentProductId: PropTypes.string,
};

// ── Delivery PIN checker (server shipping zones) ──────────────────────────────
function DeliveryCheck() {
  const [zones, setZones] = useState(null);
  const [pin, setPin]     = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    orderService.getShippingZones().then((r) => setZones(r.data?.zones || [])).catch(() => setZones([]));
  }, []);

  const check = (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) { setResult({ ok: false, msg: 'Enter a valid 6-digit PIN code' }); return; }
    const z = (zones || []).find((x) => x.pincode === pin);
    setResult(z
      ? { ok: true, msg: `Delivers to ${z.area} · shipping ${formatPrice(z.charge)}` }
      : { ok: false, msg: `Sorry, we don't deliver to ${pin} yet` });
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-dark-900/40 p-3.5">
      <form onSubmit={check} className="flex items-center gap-2">
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gold-500/10 text-gold-400 flex items-center justify-center"><FiTruck size={14} /></span>
        <div className="relative flex-1 min-w-0">
          <input
            value={pin}
            onChange={(e) => { setPin(e.target.value.replaceAll(/\D/g, '').slice(0, 6)); setResult(null); }}
            inputMode="numeric"
            placeholder="Check delivery — enter PIN code"
            aria-label="Delivery PIN code"
            className="w-full bg-transparent font-jakarta text-sm text-white placeholder:text-dark-500 focus:outline-none py-1.5"
          />
        </div>
        <button type="submit" disabled={zones === null} className="flex-shrink-0 font-jakarta text-xs font-semibold text-gold-400 hover:text-gold-300 px-2 py-1.5 disabled:opacity-40">
          Check
        </button>
      </form>
      <AnimatePresence>
        {result && (
          <motion.p
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className={`font-jakarta text-xs mt-2 pl-10 flex items-center gap-1.5 ${result.ok ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {result.ok ? <FiCheckCircle size={12} /> : <FiMapPin size={12} />} {result.msg}
          </motion.p>
        )}
      </AnimatePresence>
      {zones?.length > 0 && !result && (
        <p className="font-jakarta text-[11px] text-dark-500 mt-1.5 pl-10">
          We deliver to {zones.map((z) => z.area).join(', ')}
        </p>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
// Keyed by product id so gallery, quantity and review form reset when moving to another product.
export default function ProductDetail() {
  const { id } = useParams();
  return <ProductDetailView key={id} id={id} />;
}

function ProductDetailView({ id }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const product = useSelector(selectCurrentProduct);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);

  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [reviewText, setReviewText] = useState('');
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [pendingWish, setPendingWish] = useState(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const ctaRef = useRef(null);

  // Mobile: show a sticky "Add to cart" bar once the main button scrolls out of view
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setShowStickyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [loading, product?._id]);

  useEffect(() => {
    let alive = true;
    dispatch(fetchProduct(id)).finally(() => { if (alive) setLoading(false); });
    window.scrollTo(0, 0);
    return () => { alive = false; };
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

  // Buy now → add to cart and go straight to checkout (login first if needed)
  const handleBuyNow = () => {
    if (stock === 0) return;
    dispatch(addToCart({ ...product, quantity }));
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/checkout' } } });
      return;
    }
    navigate('/checkout');
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: name, url }); return; } catch { /* cancelled → fall back to copy */ }
    }
    try { await navigator.clipboard.writeText(url); toast.success('Link copied!'); } catch { toast.error('Could not copy link'); }
  };

  const wishlistIds = (user?.wishlist || []).map((w) => (typeof w === 'object' && w !== null ? w._id : w));
  const wishlisted = pendingWish ?? wishlistIds.includes(product._id);
  const handleWishlist = async () => {
    if (!isAuthenticated) { toast.error('Please login to save items'); return; }
    const next = !wishlisted;
    setPendingWish(next);
    try {
      const res = await userService.toggleWishlist(product._id);
      dispatch(setUser(res.data.user)); // keep the in-memory access token
      toast.success(next ? 'Saved to wishlist' : 'Removed from wishlist');
    } catch {
      toast.error('Failed to update wishlist');
    } finally {
      setPendingWish(null);
    }
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

  const goImg = (dir) => setActiveImg((p) => (p + dir + displayImages.length) % displayImages.length);
  const discountPct = discountedPrice ? Math.round(((price - discountedPrice) / price) * 100) : 0;

  const renderImageGallery = () => (
    <div className="space-y-3 lg:sticky lg:top-24">
      <div
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-dark-800 to-dark-950 border border-white/[0.06] group shadow-[0_30px_80px_rgba(0,0,0,0.5)] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/40"
        style={{ aspectRatio: '1 / 1' }}
        tabIndex={0}
        aria-label={`${name} images`}
        onKeyDown={(e) => {
          if (displayImages.length < 2) return;
          if (e.key === 'ArrowLeft') goImg(-1);
          if (e.key === 'ArrowRight') goImg(1);
        }}
      >
        {/* swipe between images on touch screens */}
        <motion.div
          className="absolute inset-0"
          drag={displayImages.length > 1 ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          onDragEnd={(_, info) => {
            if (info.offset.x < -60) goImg(1);
            else if (info.offset.x > 60) goImg(-1);
          }}
        >
          <div className="absolute inset-0">
            <AnimatePresence mode="wait">
              <motion.img
                key={activeImg}
                src={displayImages[activeImg]?.url ? resolveImageUrl(displayImages[activeImg].url) : placeholderImg}
                alt={name}
                draggable={false}
                initial={{ opacity: 0, scale: 1.03 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full object-cover select-none"
              />
            </AnimatePresence>
          </div>
        </motion.div>

        {/* top-left: discount; top-right: wishlist */}
        {discountPct > 0 && (
          <span className="absolute top-4 left-4 z-10 rounded-full bg-velvet-600/90 px-2.5 py-1 font-jakarta text-xs font-bold text-white shadow-lg">-{discountPct}%</span>
        )}
        <button
          type="button"
          onClick={handleWishlist}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
          aria-pressed={wishlisted}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-dark-900/75 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:text-velvet-400 hover:scale-110 transition-all"
        >
          <FiHeart size={16} className={wishlisted ? 'fill-velvet-400 text-velvet-400' : ''} />
        </button>

        {stock === 0 && (
          <div className="absolute inset-0 z-10 bg-dark-900/60 flex items-center justify-center pointer-events-none">
            <span className="badge badge-red text-sm px-4 py-2">Out of Stock</span>
          </div>
        )}
        {displayImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => goImg(-1)}
              aria-label="Previous image"
              className="absolute z-10 left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-dark-900/70 backdrop-blur-md border border-white/10 flex items-center justify-center text-white sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:bg-gold-500 hover:text-dark-900"
            >
              <FiChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => goImg(1)}
              aria-label="Next image"
              className="absolute z-10 right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-dark-900/70 backdrop-blur-md border border-white/10 flex items-center justify-center text-white sm:opacity-0 sm:group-hover:opacity-100 transition-all hover:bg-gold-500 hover:text-dark-900"
            >
              <FiChevronRight size={18} />
            </button>
            {/* dots */}
            <div className="absolute z-10 bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-dark-900/60 backdrop-blur-md px-2.5 py-1.5">
              {displayImages.map((img, i) => (
                <button
                  key={img._id || img.url || i}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  aria-label={`Image ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === activeImg ? 'w-5 bg-gold-400' : 'w-1.5 bg-white/40 hover:bg-white/70'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {displayImages.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-1">
          {displayImages.map((img, i) => (
            <button
              key={img._id || img.url || img}
              type="button"
              onClick={() => setActiveImg(i)}
              aria-label={`Show image ${i + 1}`}
              className={`relative flex-shrink-0 w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-xl overflow-hidden transition-all duration-300 ${
                activeImg === i ? 'ring-2 ring-gold-500 ring-offset-2 ring-offset-dark-900' : 'opacity-60 hover:opacity-100 ring-1 ring-white/10'
              }`}
            >
              <img src={resolveImageUrl(img.url)} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderReviewsSection = () => (
    <div id="reviews-section" className="border-t border-white/[0.06] mt-14 pt-12 scroll-mt-24">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="font-jakarta text-[11px] font-semibold tracking-[0.3em] text-gold-500 uppercase mb-2">What customers say</p>
          <h2 className="font-serif text-2xl sm:text-3xl text-white font-semibold leading-tight pt-0">
            Reviews{' '}<span className="text-dark-500 text-base font-jakarta font-normal ml-1">({numReviews})</span>
          </h2>
        </div>
        {numReviews > 3 && (
          <button onClick={() => setShowAllReviews(true)} className="btn-outline-gold text-sm py-2 px-4">
            View All {numReviews}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
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
                  <div className="h-full bg-gold-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-dark-600 text-xs w-4 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <FiMessageSquare size={15} className="text-gold-500" />
              <h3 className="text-white font-medium text-sm">Write a Review</h3>
            </div>
            {!isAuthenticated ? (
              <p className="text-dark-400 text-sm">
                <button onClick={() => navigate('/login')} className="text-gold-400 hover:underline">Log in</button>
                {' '}to leave a review.
              </p>
            ) : (
              <form onSubmit={handleSubmitReview} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-dark-400 text-xs">Your rating</span>
                  <StarRow rating={reviewRating} size={22} interactive hoverRating={hoverRating} onHover={setHoverRating} onClick={setReviewRating} />
                  <span className="text-gold-400 text-xs font-medium">{hoverRating || reviewRating}/5</span>
                </div>
                <input type="text" value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} placeholder="Review title (optional)" className="input-dark text-sm py-2.5" maxLength={100} />
                <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Share your experience... (min. 10 characters)" rows={3} className="input-dark resize-none text-sm" maxLength={1000} />
                <div className="flex items-center justify-between">
                  <p className="text-dark-600 text-[10px]">Only verified purchasers can post reviews</p>
                  <button type="submit" disabled={submitting} className="btn-gold text-sm py-2 px-5 disabled:opacity-60">
                    {submitting ? 'Submitting…' : 'Submit'}
                  </button>
                </div>
              </form>
            )}
          </div>
          {ratings?.length > 0 ? (
            <>
              {ratings.slice(0, 3).map((review, i) => (
                <ReviewCard key={review._id || i} review={review} />
              ))}
              {numReviews > 3 && (
                <button onClick={() => setShowAllReviews(true)} className="w-full py-3 rounded-2xl border border-white/10 text-dark-400 hover:text-white hover:border-white/25 text-sm transition-all">
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
  );

  const specs = [
    material && { icon: FiAward, label: 'Material', value: material },
    purity && { icon: FiShield, label: 'Purity', value: purity },
    weightValue && { icon: FiPackage, label: 'Weight', value: `${weightValue}${unit === 'kg' ? ' kg' : ' g'}` },
    category?.name && { icon: FiStar, label: 'Category', value: category.name },
  ].filter(Boolean);

  return (
    <div className="relative min-h-screen pt-24 pb-24 lg:pb-16 overflow-x-clip">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_70%_0%,rgba(212,175,55,0.08),transparent_70%)]" aria-hidden="true" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 font-jakarta text-xs text-dark-500 mb-5 min-w-0">
          <Link to="/" className="hover:text-gold-400 transition-colors">Home</Link>
          <FiChevronRight size={11} className="text-dark-600 flex-shrink-0" />
          <Link to="/shop" className="hover:text-gold-400 transition-colors">Shop</Link>
          {category?.name && (
            <>
              <FiChevronRight size={11} className="text-dark-600 flex-shrink-0" />
              <Link to={`/shop?category=${category._id}`} className="hover:text-gold-400 transition-colors">{category.name}</Link>
            </>
          )}
          <FiChevronRight size={11} className="text-dark-600 flex-shrink-0" />
          <span className="text-dark-300 truncate">{name}</span>
        </nav>

        {/* Product Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">

          {/* ── Image Gallery ── */}
          {renderImageGallery()}

          {/* ── Product Info ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="flex flex-col gap-4"
          >
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="badge badge-gold">{material}</span>
              {purity && <span className="badge badge-blue">{purity}</span>}
              {stock === 0 && <span className="badge badge-red">Out of Stock</span>}
              {stock > 0 && stock <= 5 && (
                <span className="badge badge-gold inline-flex items-center gap-1.5">
                  <span className="relative flex w-1.5 h-1.5"><span className="absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-70 animate-ping" /><span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-gold-400" /></span>
                  Only {stock} left
                </span>
              )}
            </div>

            {/* Name */}
            <h1 className="font-serif text-3xl md:text-[2.5rem] text-white font-semibold leading-[1.15] pt-0 tracking-tight">
              {name}
            </h1>

            {/* Rating row */}
            <div className="flex items-center gap-2 -mt-1">
              {numReviews > 0 ? (
                <>
                  <StarRow rating={averageRating} size={13} />
                  <span className="text-gold-400 text-xs font-semibold font-jakarta">{averageRating}</span>
                  <button
                    type="button"
                    onClick={() => document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' })}
                    className="font-jakarta text-dark-400 text-xs hover:text-gold-400 underline-offset-2 hover:underline transition-colors"
                  >
                    {numReviews} {numReviews === 1 ? 'review' : 'reviews'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' })}
                  className="font-jakarta text-dark-500 text-xs hover:text-gold-400 transition-colors"
                >
                  No reviews yet · be the first
                </button>
              )}
            </div>

            {/* Price */}
            <div className="border-y border-white/[0.06] py-3">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="text-xl md:text-2xl font-semibold text-gold-400 font-jakarta">
                  {displayPrice > 0 ? formatPrice(displayPrice) : 'Price on request'}
                </span>
                {discountedPrice && (
                  <>
                    <span className="text-dark-500 text-sm line-through font-jakarta">{formatPrice(price)}</span>
                    <span className="badge badge-green">Save {formatPrice(savings)}</span>
                  </>
                )}
              </div>
              <p className="font-jakarta text-[11px] text-dark-400 mt-1">+ {product.gst ?? 3}% GST · shipping calculated at checkout from your PIN code</p>
            </div>

            {/* Description */}
            {description && (
              <p className="font-jakarta text-dark-300 text-sm leading-relaxed">{description}</p>
            )}

            {/* Specs */}
            {specs.length > 0 && (
              <div className={`grid gap-2 ${specs.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
                {specs.map((sp) => {
                  const SIcon = sp.icon;
                  return (
                    <div key={sp.label} className="group rounded-xl border border-white/[0.06] bg-dark-800/50 px-3 py-2.5 transition-colors hover:border-gold-500/30">
                      <p className="flex items-center gap-1.5 font-jakarta text-[10px] text-dark-500 uppercase tracking-[0.14em] mb-0.5">
                        <SIcon size={10} className="text-gold-600" /> {sp.label}
                      </p>
                      <p className="font-jakarta text-white text-sm font-semibold truncate">{sp.value}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quantity */}
            {stock > 0 && (
              <div className="flex items-center gap-3">
                <span className="font-jakarta text-xs text-dark-400">Quantity</span>
                <div className="flex items-center bg-dark-800 rounded-full border border-white/10 p-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                    className="w-8 h-8 rounded-full hover:bg-dark-700 flex items-center justify-center text-dark-300 hover:text-white transition-colors disabled:opacity-30"
                  >
                    <FiMinus size={13} />
                  </button>
                  <span className="w-9 text-center text-white text-sm font-semibold font-jakarta tabular-nums" aria-live="polite">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(stock, quantity + 1))}
                    disabled={quantity >= stock}
                    aria-label="Increase quantity"
                    className="w-8 h-8 rounded-full hover:bg-dark-700 flex items-center justify-center text-dark-300 hover:text-white transition-colors disabled:opacity-30"
                  >
                    <FiPlus size={13} />
                  </button>
                </div>
                <span className={`font-jakarta text-xs ${stock <= 5 ? 'text-amber-400' : 'text-dark-500'}`}>{stock} in stock</span>
              </div>
            )}

            {/* CTA */}
            <div ref={ctaRef} className="flex gap-2.5">
              <button
                id="add-to-cart-detail-btn"
                type="button"
                onClick={handleAddToCart}
                disabled={stock === 0}
                className="flex-1 btn-gold py-3.5 text-sm gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiShoppingBag size={15} />
                {stock === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
              {stock > 0 && (
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="flex-1 btn-outline-gold py-3.5 text-sm gap-2"
                >
                  <FiZap size={15} /> Buy Now
                </button>
              )}
              <button
                type="button"
                onClick={handleShare}
                aria-label="Share"
                className="w-12 flex-shrink-0 rounded-xl bg-dark-800 border border-white/10 text-dark-300 hover:text-gold-400 hover:border-gold-500/40 transition-colors flex items-center justify-center"
                title="Share"
              >
                <FiShare2 size={16} />
              </button>
            </div>

            {/* Delivery check */}
            <DeliveryCheck />

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: FiShield, label: 'Certified authentic' },
                { icon: FiLock, label: 'Secure payment' },
                { icon: FiPackage, label: 'Premium packaging' },
              ].map((t) => {
                const TIcon = t.icon;
                return (
                  <div key={t.label} className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 rounded-xl border border-gold-500/10 bg-gold-500/[0.04] px-2 py-2.5 text-center sm:text-left">
                    <TIcon size={14} className="text-gold-500 flex-shrink-0" />
                    <p className="font-jakarta text-[11px] sm:text-xs text-dark-300 leading-tight">{t.label}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* ── Related Products ── */}
        <div className="mt-14 sm:mt-16 border-t border-white/[0.06]">
          <RelatedProducts categoryId={category?._id} categoryName={category?.name} material={material} currentProductId={id} />
        </div>

        {/* ── Reviews Section ── */}
        {renderReviewsSection()}
      </div>

      {/* Mobile sticky buy bar */}
      <AnimatePresence>
        {showStickyBar && stock > 0 && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-white/10 bg-dark-900/95 backdrop-blur-md px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3"
          >
            <img src={displayImages[0]?.url ? resolveImageUrl(displayImages[0].url) : placeholderImg} alt="" className="w-11 h-11 rounded-lg object-cover border border-white/10" />
            <div className="flex-1 min-w-0">
              <p className="font-jakarta text-white text-xs font-medium truncate">{name}</p>
              <p className="font-jakarta text-gold-400 text-sm font-bold">{displayPrice > 0 ? formatPrice(displayPrice) : 'Price on request'}</p>
            </div>
            <button type="button" onClick={handleAddToCart} className="btn-gold py-2.5 px-4 text-sm gap-1.5">
              <FiShoppingBag size={14} /> Add
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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

ProductDetailView.propTypes = { id: PropTypes.string.isRequired };
