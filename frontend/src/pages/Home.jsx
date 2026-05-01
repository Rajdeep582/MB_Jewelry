import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { FiArrowRight, FiStar, FiShield, FiTruck, FiRefreshCw } from 'react-icons/fi';
import { fetchFeaturedProducts, selectFeaturedProducts } from '../store/productSlice';
import ProductCard from '../components/shop/ProductCard';
import { ProductCardSkeleton } from '../components/common/Skeletons';

const features = [
  { icon: FiShield, title: 'Certified Authentic', desc: 'All jewelry certified by independent gemologists' },
  { icon: FiTruck, title: 'Free Shipping', desc: 'Complimentary shipping on orders above ₹999' },
  { icon: FiRefreshCw, title: '30-Day Returns', desc: 'Hassle-free returns within 30 days' },
  { icon: FiStar, title: 'Premium Quality', desc: 'Crafted with the finest materials worldwide' },
];

const testimonials = [
  { name: 'Priya Sharma', rating: 5, text: 'Absolutely gorgeous ring! The craftsmanship is impeccable and arrived beautifully packaged.', location: 'Mumbai' },
  { name: 'Anita Reddy', rating: 5, text: 'I bought a necklace for my wedding — everyone kept asking where it was from. Truly luxury!', location: 'Hyderabad' },
  { name: 'Kavita Nair', rating: 5, text: 'Exceptional quality and the customer service was outstanding. My go-to jewelry store now.', location: 'Kochi' },
];

const collectionTypeMap = {
  Rings: 'Ring',
  Necklaces: 'Necklace',
  Earrings: 'Earrings',
  Bracelets: 'Bracelet',
};

const collections = [
  { name: 'Rings', image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&q=80', count: '48 pieces' },
  { name: 'Necklaces', image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&q=80', count: '62 pieces' },
  { name: 'Earrings', image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&q=80', count: '34 pieces' },
  { name: 'Bracelets', image: 'https://images.unsplash.com/photo-1573408301185-9519f94816b5?w=600&q=80', count: '29 pieces' },
];

export default function Home() {
  const dispatch = useDispatch();
  const featured = useSelector(selectFeaturedProducts);
  const loading = featured.length === 0;

  useEffect(() => {
    document.title = 'M&B Jewelry — Luxury Fine Jewelry';
    dispatch(fetchFeaturedProducts());
  }, [dispatch]);

  return (
    <div className="min-h-screen">
      {/* ─── Hero Section ───────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 hero-gradient" />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1920&q=80')" }}
        />
        {/* Decorative rings */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full border border-gold-500/10 animate-spin-slow" />
        <div className="absolute top-1/3 right-1/3 w-64 h-64 rounded-full border border-gold-500/5" />

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="section-subtitle mb-6">The Art of Fine Jewelry</p>
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light text-white leading-none mb-6">
              Timeless{' '}
              <span className="text-gradient-gold italic">Elegance</span>
              <br />Redefined
            </h1>
            <p className="text-dark-300 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
              Discover our curated collection of handcrafted gold, diamond, and precious stone jewelry — 
              each piece a statement of lasting beauty.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/shop" id="hero-shop-btn" className="btn-gold text-base py-4 px-8">
                Explore Collection <FiArrowRight size={18} />
              </Link>
              <Link to="/about" className="btn-outline-gold text-base py-4 px-8">
                Our Story
              </Link>
            </div>
          </motion.div>


        </div>
      </section>

      {/* ─── Features ───────────────────────────────────────────── */}
      <section className="py-16 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((item, i) => {
               
              const SIcon = item.icon;
              return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center text-center gap-3 p-4"
              >
                <div className="w-12 h-12 rounded-full glass-gold flex items-center justify-center">
                  <SIcon size={20} className="text-gold-500" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{item.title}</p>
                  <p className="text-dark-400 text-xs leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            )})}
          </div>
        </div>
      </section>

      {/* ─── Collections ────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="section-subtitle mb-3">Browse By</p>
            <h2 className="section-title">Our Collections</h2>
            <div className="gold-divider mt-4" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {collections.map(({ name, image, count }, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.02 }}
              >
                <Link
                  to={`/shop?type=${collectionTypeMap[name]}`}
                  id={`collection-${name.toLowerCase()}`}
                  className="block relative rounded-2xl overflow-hidden aspect-[3/4] group"
                >
                  <img
                    src={image}
                    alt={name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 via-dark-900/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-display text-white text-xl">{name}</h3>
                    <p className="text-gold-400 text-sm">{count}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Featured Products ───────────────────────────────────── */}
      <section className="py-20 bg-dark-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <p className="section-subtitle mb-3">Handpicked For You</p>
              <h2 className="section-title">Featured Pieces</h2>
              <div className="gold-divider mt-4 mx-0" />
            </div>
            <Link to="/shop" className="btn-outline-gold text-sm self-start md:self-auto">
              View All <FiArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : featured.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
          </div>
        </div>
      </section>

      {/* ─── Brand Story Banner ──────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1620843045823-5f4e028b25e9?w=1400&q=80"
              alt="Jewelry craftsmanship"
              className="w-full h-80 md:h-96 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-dark-900/95 via-dark-900/80 to-transparent" />
            <div className="absolute inset-0 flex items-center">
              <div className="p-8 md:p-16 max-w-lg">
                <p className="section-subtitle mb-3">Our Heritage</p>
                <h2 className="section-title text-3xl md:text-4xl mb-4">
                  15 Years of Crafting <span className="text-gradient-gold">Masterpieces</span>
                </h2>
                <p className="text-dark-300 leading-relaxed mb-6">
                  From our family workshop to the finest boutiques, every M&B piece is hand-crafted 
                  with generations of goldsmithing expertise and an uncompromising eye for detail.
                </p>
                <Link to="/about" className="btn-gold text-sm">
                  Discover Our Story <FiArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Testimonials ───────────────────────────────────────── */}
      <section className="py-20 bg-dark-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="section-subtitle mb-3">Customer Love</p>
            <h2 className="section-title">What They Say</h2>
            <div className="gold-divider mt-4" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map(({ name, rating, text, location }, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="card p-6"
              >
                <div className="flex mb-3">
                  {Array.from({ length: rating }).map((_, j) => (
                    <FiStar key={j} size={14} className="fill-gold-400 text-gold-400" />
                  ))}
                </div>
                <p className="text-dark-300 text-sm leading-relaxed mb-4">"{text}"</p>
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-gold-gradient flex items-center justify-center text-dark-900 font-bold text-sm">
                    {name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{name}</p>
                    <p className="text-dark-500 text-xs">{location}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
