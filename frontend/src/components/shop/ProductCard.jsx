import { Link } from 'react-router-dom';
import jewelryImg from '../../assets/necklace.webp';
import { motion } from 'framer-motion';
import { FiShoppingBag, FiStar, FiHeart } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart, openCart } from '../../store/cartSlice';
import { formatPrice, discountPercent, resolveImageUrl } from '../../utils/helpers';
import { selectIsAuthenticated, selectUser, setCredentials } from '../../store/authSlice';
import { userService } from '../../services/services';
import toast from 'react-hot-toast';
import PropTypes from 'prop-types';

export default function ProductCard({ product, view = 'grid' }) {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  
  const wishlist = user?.wishlist || [];
  const isWishlisted = wishlist.some(item => {
    const itemId = typeof item === 'object' && item !== null ? item._id : item;
    return itemId === product._id;
  });

  const [wishlisted, setWishlisted] = useState(isWishlisted);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setWishlisted(isWishlisted);
  }, [isWishlisted]);

  const { _id, name, price, discountedPrice, images, material, type, averageRating, numReviews, stock } = product;

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
    setWishlisted(newValue);
    
    try {
      const res = await userService.toggleWishlist(_id);
      dispatch(setCredentials({ user: res.data.user, accessToken: localStorage.getItem('mb_access_token') }));
      toast.success(newValue ? 'Added to wishlist' : 'Removed from wishlist');
    } catch {
      setWishlisted(!newValue); // Revert
      toast.error('Failed to update wishlist');
    }
  };

  const isList = view === 'list';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -4 }}
      className={`card-hover group cursor-pointer ${isList ? 'p-3' : ''}`}
    >
      <Link to={`/products/${_id}`} id={`product-${_id}`} className={isList ? 'flex flex-row items-center gap-5 sm:gap-6' : 'block'}>
        {/* Image */}
        <div className={`relative overflow-hidden ${isList ? 'w-32 h-32 sm:w-48 sm:h-48 rounded-xl shrink-0' : 'product-img-wrapper'}`}>
          {/* Discount badge */}
          {discountedPrice && (
            <div className={`absolute z-10 badge badge-red text-[10px] sm:text-xs font-bold ${isList ? 'top-2 left-2 sm:top-3 sm:left-3' : 'top-3 left-3'}`}>
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
            className={`absolute z-10 w-8 h-8 rounded-full bg-dark-900/80 backdrop-blur-sm flex items-center justify-center text-dark-400 hover:text-velvet-400 transition-all duration-200 opacity-0 group-hover:opacity-100 ${isList ? 'top-2 right-2 sm:top-3 sm:right-3' : 'top-3 right-3'}`}
            aria-label="Add to wishlist"
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
        <div className={`flex flex-col flex-1 ${isList ? 'py-1 sm:py-3 pr-2 sm:pr-4 h-32 sm:h-48' : 'p-4'}`}>
          <p className="text-dark-400 text-[10px] sm:text-xs mb-1 uppercase tracking-wider">{material} · {type}</p>
          <h3 className={`text-white font-medium line-clamp-2 leading-snug group-hover:text-gold-400 transition-colors ${isList ? 'text-sm sm:text-lg mb-1 sm:mb-2' : 'text-sm mb-1'}`}>
            {name}
          </h3>

          {/* Rating */}
          {numReviews > 0 && (
            <div className={`flex items-center gap-1 ${isList ? 'mb-1 sm:mb-2' : 'mb-2'}`}>
              <FiStar size={11} className="fill-gold-400 text-gold-400" />
              <span className="text-gold-400 text-xs">{averageRating}</span>
              <span className="text-dark-500 text-xs">({numReviews})</span>
            </div>
          )}

          <div className={isList ? 'mt-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3' : ''}>
            {/* Price */}
            <div className={`flex items-center gap-2 ${isList ? '' : 'mb-3'}`}>
              <span className="price-tag text-sm sm:text-base">
                {formatPrice(discountedPrice || price)}
              </span>
              {discountedPrice && (
                <span className="price-original text-xs sm:text-sm">{formatPrice(price)}</span>
              )}
            </div>

            {/* Add to Cart */}
            <button
              id={`add-to-cart-${_id}`}
              onClick={handleAddToCart}
              disabled={stock === 0}
              className={`flex items-center justify-center gap-2 rounded-xl text-xs sm:text-sm font-medium bg-dark-700 text-dark-300 hover:bg-gold-500 hover:text-dark-900 border border-white/10 hover:border-transparent transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed ${isList ? 'px-4 sm:px-6 py-2 sm:py-2.5 w-max' : 'w-full py-2.5'}`}
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
    type: PropTypes.string,
    averageRating: PropTypes.number,
    numReviews: PropTypes.number,
    stock: PropTypes.number.isRequired,
  }).isRequired,
  view: PropTypes.string,
};
