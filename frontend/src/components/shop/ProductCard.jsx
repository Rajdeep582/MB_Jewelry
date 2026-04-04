import { Link } from 'react-router-dom';
import jewelryImg from '../../assets/necklace.webp';
import { motion } from 'framer-motion';
import { FiShoppingBag, FiStar, FiHeart } from 'react-icons/fi';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart, openCart } from '../../store/cartSlice';
import { formatPrice, discountPercent, resolveImageUrl } from '../../utils/helpers';
import { selectIsAuthenticated } from '../../store/authSlice';
import toast from 'react-hot-toast';
import { useState } from 'react';

export default function ProductCard({ product }) {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const [wishlisted, setWishlisted] = useState(false);
  const [imgError, setImgError] = useState(false);

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

  const handleWishlist = (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please login to save items');
      return;
    }
    setWishlisted(!wishlisted);
    toast.success(wishlisted ? 'Removed from wishlist' : 'Added to wishlist');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -4 }}
      className="card-hover group cursor-pointer"
    >
      <Link to={`/products/${_id}`} id={`product-${_id}`} className="block">
        {/* Image */}
        <div className="product-img-wrapper relative">
          {/* Discount badge */}
          {discountedPrice && (
            <div className="absolute top-3 left-3 z-10 badge badge-red text-xs font-bold">
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
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-dark-900/80 backdrop-blur-sm flex items-center justify-center text-dark-400 hover:text-velvet-400 transition-all duration-200 opacity-0 group-hover:opacity-100"
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
        <div className="p-4">
          <p className="text-dark-400 text-xs mb-1 uppercase tracking-wider">{material} · {type}</p>
          <h3 className="text-white font-medium text-sm mb-1 line-clamp-2 leading-snug group-hover:text-gold-400 transition-colors">
            {name}
          </h3>

          {/* Rating */}
          {numReviews > 0 && (
            <div className="flex items-center gap-1 mb-2">
              <FiStar size={11} className="fill-gold-400 text-gold-400" />
              <span className="text-gold-400 text-xs">{averageRating}</span>
              <span className="text-dark-500 text-xs">({numReviews})</span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-center gap-2 mb-3">
            <span className="price-tag text-base">
              {formatPrice(discountedPrice || price)}
            </span>
            {discountedPrice && (
              <span className="price-original">{formatPrice(price)}</span>
            )}
          </div>

          {/* Add to Cart */}
          <button
            id={`add-to-cart-${_id}`}
            onClick={handleAddToCart}
            disabled={stock === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-dark-700 text-dark-300 hover:bg-gold-500 hover:text-dark-900 border border-white/10 hover:border-transparent transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FiShoppingBag size={14} />
            {stock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </Link>
    </motion.div>
  );
}
