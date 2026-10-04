import { Link } from 'react-router-dom';
import jewelryImg from '../../assets/necklace.webp';
import { motion } from 'framer-motion';
import { FiShoppingBag, FiStar, FiHeart } from 'react-icons/fi';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart, openCart } from '../../store/cartSlice';
import { formatPrice, discountPercent, resolveImageUrl } from '../../utils/helpers';
import { selectIsAuthenticated, selectUser, setUser } from '../../store/authSlice';
import { userService } from '../../services/services';
import toast from 'react-hot-toast';
import PropTypes from 'prop-types';

function resolveWishlistItemId(item) {
  if (typeof item === 'object' && item !== null) return item._id;
  return item;
}

function getImageWrapperClass(isList) {
  if (isList) return 'relative overflow-hidden w-32 h-32 sm:w-48 sm:h-48 rounded-xl shrink-0';
  return 'relative overflow-hidden product-img-wrapper';
}

function getDiscountBadgeClass(isList) {
  if (isList) return 'absolute z-10 badge badge-red text-[10px] sm:text-xs font-bold top-2 left-2 sm:top-3 sm:left-3';
  return 'absolute z-10 badge badge-red text-[10px] sm:text-xs font-bold top-3 left-3';
}

// Wishlist heart: always visible on touch screens (no hover there) and once saved;
// on desktop it fades in on hover.
function getWishlistBtnClass(isList, saved) {
  const pos = isList ? 'top-2 right-2 sm:top-3 sm:right-3' : 'top-2.5 right-2.5 sm:top-3 sm:right-3';
  const vis = saved ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100';
  return `absolute z-10 w-8 h-8 rounded-full bg-dark-900/80 backdrop-blur-sm border border-white/10 flex items-center justify-center text-dark-300 hover:text-velvet-400 hover:scale-110 transition-all duration-200 ${vis} ${pos}`;
}

function getInfoClass(isList) {
  if (isList) return 'flex flex-col flex-1 py-1 sm:py-3 pr-2 sm:pr-4 h-32 sm:h-48';
  return 'flex flex-col flex-1 p-3 sm:p-4';
}

function getNameClass(isList) {
  if (isList) return 'font-jakarta text-white font-medium line-clamp-2 leading-snug group-hover:text-gold-300 transition-colors text-sm sm:text-lg mb-1 sm:mb-2';
  return 'font-jakarta text-white font-medium line-clamp-2 leading-snug group-hover:text-gold-300 transition-colors text-[13px] sm:text-sm min-h-[2.4rem] sm:min-h-[2.5rem]';
}

function getCartBtnClass(isList) {
  const size = isList ? 'px-4 sm:px-6 py-2 sm:py-2.5 w-max' : 'w-full py-2 sm:py-2.5';
  return `flex items-center justify-center gap-2 rounded-xl font-jakarta text-xs sm:text-sm font-semibold bg-white/[0.04] text-gold-300 border border-gold-500/25 hover:bg-gold-500 hover:text-dark-900 hover:border-transparent active:scale-[0.98] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:text-dark-400 disabled:border-white/10 disabled:hover:bg-white/[0.04] ${size}`;
}

export default function ProductCard({ product, view = 'grid' }) {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);

  const wishlist = user?.wishlist || [];
  const isWishlisted = wishlist.some(item => resolveWishlistItemId(item) === product._id);

  // Optimistic value while the wishlist request is in flight; otherwise follow the store
  const [pendingWish, setPendingWish] = useState(null);
  const wishlisted = pendingWish ?? isWishlisted;
  const [imgError, setImgError] = useState(false);

  const { _id, name, price, discountedPrice, images, material, purity, averageRating, numReviews, stock } = product;
  const shownPrice = discountedPrice || price;
  const meta = [material, purity && purity !== 'Normal' ? purity : null].filter(Boolean).join(' · ');

  const mainImage = images?.[0]?.url ? resolveImageUrl(images[0].url) : null;
  const hoverImage = images?.[1]?.url ? resolveImageUrl(images[1].url) : null;

  const handleAddToCart = (e) => {
    e.preventDefault();
    if (stock === 0) return;
    dispatch(addToCart({ ...product, quantity: 1 }));
    dispatch(openCart());
    toast.success(`${name} added to cart!`, { icon: '💎' });
  };

  const handleWishlist = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please login to save items');
      return;
    }
    
    // Optimistic update
    const newValue = !wishlisted;
    setPendingWish(newValue);

    try {
      const res = await userService.toggleWishlist(_id);
      dispatch(setUser(res.data.user)); // keep the in-memory access token
      toast.success(newValue ? 'Added to wishlist' : 'Removed from wishlist');
    } catch {
      toast.error('Failed to update wishlist'); // store unchanged → reverts
    } finally {
      setPendingWish(null);
    }
  };

  const isList = view === 'list';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -4 }}
      className={`card-hover group cursor-pointer ${isList ? 'p-3' : 'flex flex-col h-full'}`}
    >
      <Link to={`/products/${_id}`} id={`product-${_id}`} className={isList ? 'flex flex-row items-center gap-5 sm:gap-6' : 'flex flex-col flex-1'}>
        {/* Image */}
        <div className={getImageWrapperClass(isList)}>
          {/* Discount badge */}
          {discountedPrice && (
            <div className={getDiscountBadgeClass(isList)}>
              -{discountPercent(price, discountedPrice)}%
            </div>
          )}

          {/* Stock badge */}
          {stock === 0 && (
            <div className="absolute inset-0 z-10 bg-dark-900/70 flex items-center justify-center">
              <span className="badge bg-dark-800 text-dark-300 border border-white/20">Sold Out</span>
            </div>
          )}

          {/* Wishlist */}
          <button
            onClick={handleWishlist}
            className={getWishlistBtnClass(isList, wishlisted)}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-pressed={wishlisted}
          >
            <FiHeart size={14} className={wishlisted ? 'fill-velvet-400 text-velvet-400' : ''} />
          </button>

          {/* Main image */}
          <img
            src={imgError || !mainImage ? jewelryImg : mainImage}
            alt={name}
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-opacity duration-500 ${hoverImage ? 'group-hover:opacity-0' : ''}`}
            loading="lazy"
          />
          {/* Hover image */}
          {hoverImage && (
            <img
              src={hoverImage}
              alt={`${name} alternate`}
              className="w-full h-full object-cover absolute inset-0 transition-opacity duration-500 opacity-0 group-hover:opacity-100"
              loading="lazy"
            />
          )}
        </div>

        {/* Info */}
        <div className={getInfoClass(isList)}>
          <p className="font-jakarta text-gold-500/80 text-[10px] sm:text-[11px] font-semibold mb-1 uppercase tracking-[0.16em] truncate">{meta}</p>
          <h3 className={getNameClass(isList)}>
            {name}
          </h3>

          <div className={isList ? 'mt-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3' : 'mt-auto pt-2'}>
            {/* Price + rating */}
            <div className={`flex items-end justify-between gap-2 ${isList ? '' : 'mb-2.5 sm:mb-3'}`}>
              <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
                {shownPrice > 0 ? (
                  <>
                    <span className="price-tag text-sm sm:text-base">{formatPrice(shownPrice)}</span>
                    {discountedPrice && (
                      <span className="price-original text-[11px] sm:text-xs">{formatPrice(price)}</span>
                    )}
                  </>
                ) : (
                  <span className="font-jakarta text-dark-300 text-xs sm:text-sm">Price on request</span>
                )}
              </div>
              {numReviews > 0 && (
                <span className="flex items-center gap-1 flex-shrink-0 font-jakarta text-[11px] text-dark-400">
                  <FiStar size={11} className="fill-gold-400 text-gold-400" />
                  <span className="text-gold-300">{averageRating}</span>
                  <span className="hidden sm:inline">({numReviews})</span>
                </span>
              )}
            </div>

            {/* Add to Cart */}
            <button
              id={`add-to-cart-${_id}`}
              onClick={handleAddToCart}
              disabled={stock === 0}
              className={getCartBtnClass(isList)}
            >
              <FiShoppingBag size={14} />
              {stock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

ProductCard.propTypes = {
  product: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    discountedPrice: PropTypes.number,
    images: PropTypes.arrayOf(
      PropTypes.shape({
        url: PropTypes.string,
      })
    ),
    material: PropTypes.string,
    purity: PropTypes.string,
    averageRating: PropTypes.number,
    numReviews: PropTypes.number,
    stock: PropTypes.number.isRequired,
  }).isRequired,
  view: PropTypes.string,
};
