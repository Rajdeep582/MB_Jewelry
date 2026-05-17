import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import imgPendant from '../assets/pendant.png';
import imgRing from '../assets/ring.png';
import imgEarring from '../assets/earing.png';
import imgNecklace from '../assets/necklage.png';
import imgCraftsman from '../assets/craftmen logo.png';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { FiArrowRight, FiStar, FiShield, FiTruck, FiRefreshCw } from 'react-icons/fi';
import { fetchFeaturedProducts, selectFeaturedProducts } from '../store/productSlice';
// import { reviewService } from '../services/services'; // DB fetch: reviewService.getFeatured()
import ProductCard from '../components/shop/ProductCard';
import { ProductCardSkeleton } from '../components/common/Skeletons';
import ScrollReveal from '../components/common/ScrollReveal';

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
  Pendants: 'Pendant',
};

const collections = [
  { name: 'Rings', image: imgRing, count: '48 pieces' },
  { name: 'Necklaces', image: imgNecklace, count: '62 pieces' },
  { name: 'Earrings', image: imgEarring, count: '34 pieces' },
  { name: 'Pendants', image: imgPendant, count: '29 pieces' },
];

export default function Home() {
  const dispatch = useDispatch();
  const featured = useSelector(selectFeaturedProducts);
  const loading = featured.length === 0;

  useEffect(() => {
    document.title = 'M.B. JEWELLERS — Luxury Fine Jewelry';
    dispatch(fetchFeaturedProducts());
    // To fetch from DB instead of static data:
    // reviewService.getFeatured().then(res => { if (res.data.success) setTestimonials(res.data.reviews); }).catch(() => {});
  }, [dispatch]);

  return (
    <div className="min-h-screen">
      {/* ─── Hero Section ───────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center">
        {/* overflow-hidden scoped to decorative layer only — keeps rings clipped without clipping text ascenders */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 hero-gradient" />
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1920&q=80')" }}
          />
          {/* Decorative rings */}
          <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full border border-gold-500/10 animate-spin-slow" />
          <div className="absolute top-1/3 right-1/3 w-64 h-64 rounded-full border border-gold-500/5" />
        </div>

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="section-subtitle mb-6">The Art of Fine Jewelry</p>
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light text-white leading-tight pt-2 mb-6">
              Timeless{' '}
              <span className="text-gradient-gold italic" style={{ display: 'inline-block', paddingTop: '0.6em', marginTop: '-0.6em', paddingRight: '0.5em', paddingBottom: '0.15em' }}>Elegance</span>
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
          <ScrollReveal variant="up" className="text-center mb-12">
            <p className="section-subtitle mb-3">Browse By</p>
            <h2 className="section-title">Our Collections</h2>
            <div className="gold-divider mt-4" />
          </ScrollReveal>

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
          <ScrollReveal variant="up" className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <p className="section-subtitle mb-3">Handpicked For You</p>
              <h2 className="section-title">Featured Pieces</h2>
              <div className="gold-divider mt-4 mx-0" />
            </div>
            <Link to="/shop" className="btn-outline-gold text-sm self-start md:self-auto">
              View All <FiArrowRight size={14} />
            </Link>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading
              ? Array.from({ length: 8 }, (_, n) => n).map((n) => <ProductCardSkeleton key={n} />)
              : featured.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
          </div>
        </div>
      </section>

      {/* ─── Brand Story Banner ──────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal variant="fade">
          <div className="relative rounded-3xl overflow-hidden">
            {/* Goldsmith craftsman image */}
            <div className="w-full h-80 md:h-96 bg-dark-900 flex items-center justify-center md:justify-end md:pr-16">
              <img
                src={imgCraftsman}
                alt="Goldsmith craftsman"
                className="h-full w-auto object-contain"
                style={{ mixBlendMode: 'lighten' }}
              />
              {false && <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" className="h-full w-auto" style={{opacity:0.82}}>
                <defs>
                  <linearGradient id="hg1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F5E6A3"/>
                    <stop offset="45%" stopColor="#D4AF37"/>
                    <stop offset="100%" stopColor="#8B6914"/>
                  </linearGradient>
                  <linearGradient id="hg2" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#F2C94C"/>
                    <stop offset="100%" stopColor="#9A6B00"/>
                  </linearGradient>
                  <linearGradient id="hgem" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#D0EEFF"/>
                    <stop offset="100%" stopColor="#4A80C4"/>
                  </linearGradient>
                  <linearGradient id="hruby" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFAAAA"/>
                    <stop offset="100%" stopColor="#B03030"/>
                  </linearGradient>
                  <linearGradient id="hemerl" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#88EFC0"/>
                    <stop offset="100%" stopColor="#1A8050"/>
                  </linearGradient>
                  <radialGradient id="hglow" cx="50%" cy="50%">
                    <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.2"/>
                    <stop offset="65%" stopColor="#D4AF37" stopOpacity="0.05"/>
                    <stop offset="100%" stopColor="#D4AF37" stopOpacity="0"/>
                  </radialGradient>
                </defs>

                {/* Ambient radial glow */}
                <circle cx="200" cy="200" r="200" fill="url(#hglow)"/>

                {/* ── ORNAMENTAL FRAME ── */}
                <circle cx="200" cy="200" r="178" fill="none" stroke="#D4AF37" strokeWidth="0.4" opacity="0.35"/>
                <circle cx="200" cy="200" r="172" fill="none" stroke="#D4AF37" strokeWidth="1.6" opacity="0.5"/>
                <circle cx="200" cy="200" r="165" fill="none" stroke="#F2C94C" strokeWidth="0.4" opacity="0.35"/>

                {/* 8 ornamental diamonds on main ring r=172 */}
                <polygon points="200,24 204,28 200,32 196,28" fill="#F2C94C" opacity="0.95"/>
                <polygon points="322,78 326,82 322,86 318,82" fill="#D4AF37" opacity="0.7"/>
                <polygon points="368,196 372,200 368,204 364,200" fill="#F2C94C" opacity="0.95"/>
                <polygon points="322,314 326,318 322,322 318,318" fill="#D4AF37" opacity="0.7"/>
                <polygon points="200,368 204,372 200,376 196,372" fill="#F2C94C" opacity="0.95"/>
                <polygon points="78,314 82,318 78,322 74,318" fill="#D4AF37" opacity="0.7"/>
                <polygon points="28,196 32,200 28,204 24,200" fill="#F2C94C" opacity="0.95"/>
                <polygon points="78,78 82,82 78,86 74,82" fill="#D4AF37" opacity="0.7"/>

                {/* Art deco corner accents at 45° positions */}
                <line x1="316" y1="76" x2="326" y2="88" stroke="#D4AF37" strokeWidth="0.8" opacity="0.4"/>
                <line x1="326" y1="76" x2="316" y2="88" stroke="#D4AF37" strokeWidth="0.8" opacity="0.4"/>
                <line x1="316" y1="312" x2="326" y2="324" stroke="#D4AF37" strokeWidth="0.8" opacity="0.4"/>
                <line x1="326" y1="312" x2="316" y2="324" stroke="#D4AF37" strokeWidth="0.8" opacity="0.4"/>
                <line x1="74" y1="76" x2="84" y2="88" stroke="#D4AF37" strokeWidth="0.8" opacity="0.4"/>
                <line x1="84" y1="76" x2="74" y2="88" stroke="#D4AF37" strokeWidth="0.8" opacity="0.4"/>
                <line x1="74" y1="312" x2="84" y2="324" stroke="#D4AF37" strokeWidth="0.8" opacity="0.4"/>
                <line x1="84" y1="312" x2="74" y2="324" stroke="#D4AF37" strokeWidth="0.8" opacity="0.4"/>

                {/* Cardinal arc flourishes */}
                <path d="M172,36 Q200,50 228,36" fill="none" stroke="#D4AF37" strokeWidth="1" opacity="0.45"/>
                <path d="M354,172 Q340,200 354,228" fill="none" stroke="#D4AF37" strokeWidth="1" opacity="0.45"/>
                <path d="M172,364 Q200,350 228,364" fill="none" stroke="#D4AF37" strokeWidth="1" opacity="0.45"/>
                <path d="M46,172 Q60,200 46,228" fill="none" stroke="#D4AF37" strokeWidth="1" opacity="0.45"/>

                {/* ── SUNBURST (16 lines from r=80 to r=155) ── */}
                <line x1="280" y1="200" x2="355" y2="200" stroke="#D4AF37" strokeWidth="0.4" opacity="0.18"/>
                <line x1="120" y1="200" x2="45" y2="200" stroke="#D4AF37" strokeWidth="0.4" opacity="0.18"/>
                <line x1="200" y1="120" x2="200" y2="45" stroke="#D4AF37" strokeWidth="0.4" opacity="0.18"/>
                <line x1="200" y1="280" x2="200" y2="355" stroke="#D4AF37" strokeWidth="0.4" opacity="0.18"/>
                <line x1="257" y1="143" x2="310" y2="90" stroke="#D4AF37" strokeWidth="0.4" opacity="0.14"/>
                <line x1="143" y1="257" x2="90" y2="310" stroke="#D4AF37" strokeWidth="0.4" opacity="0.14"/>
                <line x1="143" y1="143" x2="90" y2="90" stroke="#D4AF37" strokeWidth="0.4" opacity="0.14"/>
                <line x1="257" y1="257" x2="310" y2="310" stroke="#D4AF37" strokeWidth="0.4" opacity="0.14"/>
                <line x1="268" y1="168" x2="335" y2="120" stroke="#D4AF37" strokeWidth="0.3" opacity="0.1"/>
                <line x1="132" y1="232" x2="65" y2="280" stroke="#D4AF37" strokeWidth="0.3" opacity="0.1"/>
                <line x1="232" y1="132" x2="280" y2="65" stroke="#D4AF37" strokeWidth="0.3" opacity="0.1"/>
                <line x1="168" y1="268" x2="120" y2="335" stroke="#D4AF37" strokeWidth="0.3" opacity="0.1"/>
                <line x1="168" y1="132" x2="120" y2="65" stroke="#D4AF37" strokeWidth="0.3" opacity="0.1"/>
                <line x1="232" y1="268" x2="280" y2="335" stroke="#D4AF37" strokeWidth="0.3" opacity="0.1"/>
                <line x1="268" y1="232" x2="335" y2="280" stroke="#D4AF37" strokeWidth="0.3" opacity="0.1"/>
                <line x1="132" y1="168" x2="65" y2="120" stroke="#D4AF37" strokeWidth="0.3" opacity="0.1"/>

                {/* Inner accent circle */}
                <circle cx="200" cy="200" r="80" fill="none" stroke="#D4AF37" strokeWidth="0.6" opacity="0.3"/>
                {/* Tiny dots on inner ring */}
                <circle cx="200" cy="120" r="2" fill="#D4AF37" opacity="0.45"/>
                <circle cx="280" cy="200" r="2" fill="#D4AF37" opacity="0.45"/>
                <circle cx="200" cy="280" r="2" fill="#D4AF37" opacity="0.45"/>
                <circle cx="120" cy="200" r="2" fill="#D4AF37" opacity="0.45"/>
                <circle cx="257" cy="143" r="1.5" fill="#D4AF37" opacity="0.35"/>
                <circle cx="143" cy="143" r="1.5" fill="#D4AF37" opacity="0.35"/>
                <circle cx="257" cy="257" r="1.5" fill="#D4AF37" opacity="0.35"/>
                <circle cx="143" cy="257" r="1.5" fill="#D4AF37" opacity="0.35"/>

                {/* ── ELEGANT HANDS ── */}
                {/* Left hand — palm */}
                <ellipse cx="148" cy="272" rx="28" ry="18" fill="url(#hg2)" opacity="0.85" transform="rotate(-20 148 272)"/>
                {/* Left fingers */}
                <path d="M162,258 Q182,238 196,218 Q200,210 198,205" stroke="url(#hg2)" strokeWidth="13" strokeLinecap="round" fill="none" opacity="0.85"/>
                <path d="M158,252 Q176,232 188,212 Q192,203 190,198" stroke="url(#hg2)" strokeWidth="12" strokeLinecap="round" fill="none" opacity="0.85"/>
                <path d="M152,250 Q168,234 178,218 Q182,210 180,205" stroke="url(#hg2)" strokeWidth="11" strokeLinecap="round" fill="none" opacity="0.85"/>
                <path d="M143,254 Q155,242 163,232 Q167,224 165,220" stroke="url(#hg2)" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.85"/>
                <path d="M134,260 Q138,245 144,236" stroke="url(#hg2)" strokeWidth="13" strokeLinecap="round" fill="none" opacity="0.85"/>
                {/* Right hand — palm */}
                <ellipse cx="252" cy="272" rx="28" ry="18" fill="url(#hg1)" opacity="0.85" transform="rotate(20 252 272)"/>
                {/* Right fingers */}
                <path d="M238,258 Q218,238 204,218 Q200,210 202,205" stroke="url(#hg1)" strokeWidth="13" strokeLinecap="round" fill="none" opacity="0.85"/>
                <path d="M242,252 Q224,232 212,212 Q208,203 210,198" stroke="url(#hg1)" strokeWidth="12" strokeLinecap="round" fill="none" opacity="0.85"/>
                <path d="M248,250 Q232,234 222,218 Q218,210 220,205" stroke="url(#hg1)" strokeWidth="11" strokeLinecap="round" fill="none" opacity="0.85"/>
                <path d="M257,254 Q245,242 237,232 Q233,224 235,220" stroke="url(#hg1)" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.85"/>
                <path d="M266,260 Q262,245 256,236" stroke="url(#hg1)" strokeWidth="13" strokeLinecap="round" fill="none" opacity="0.85"/>

                {/* ── THE RING (center hero) ── */}
                {/* Ring band — bottom arc (shadow side) */}
                <path d="M163,205 Q200,228 237,205" stroke="#8B6914" strokeWidth="14" strokeLinecap="round" fill="none" opacity="0.7"/>
                {/* Ring band — main */}
                <path d="M163,202 Q200,224 237,202" stroke="url(#hg1)" strokeWidth="11" strokeLinecap="round" fill="none" opacity="0.95"/>
                {/* Ring band — top arc */}
                <path d="M163,202 Q200,182 237,202" stroke="url(#hg2)" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.9"/>
                {/* Ring band inner shadow */}
                <path d="M170,202 Q200,192 230,202 Q200,212 170,202Z" fill="#050505" opacity="0.55"/>
                {/* Highlight line on top of band */}
                <path d="M168,199 Q200,186 232,199" stroke="#F5E6A3" strokeWidth="1.2" fill="none" opacity="0.55"/>
                {/* Ring shoulders (side detail) */}
                <ellipse cx="168" cy="202" rx="7" ry="12" fill="url(#hg2)" opacity="0.9"/>
                <ellipse cx="232" cy="202" rx="7" ry="12" fill="url(#hg2)" opacity="0.9"/>
                {/* Shoulder engraving lines */}
                <line x1="162" y1="196" x2="174" y2="196" stroke="#F5E6A3" strokeWidth="0.8" opacity="0.45"/>
                <line x1="162" y1="202" x2="174" y2="202" stroke="#F5E6A3" strokeWidth="0.8" opacity="0.45"/>
                <line x1="162" y1="208" x2="174" y2="208" stroke="#F5E6A3" strokeWidth="0.8" opacity="0.45"/>
                <line x1="226" y1="196" x2="238" y2="196" stroke="#F5E6A3" strokeWidth="0.8" opacity="0.45"/>
                <line x1="226" y1="202" x2="238" y2="202" stroke="#F5E6A3" strokeWidth="0.8" opacity="0.45"/>
                <line x1="226" y1="208" x2="238" y2="208" stroke="#F5E6A3" strokeWidth="0.8" opacity="0.45"/>

                {/* Setting base + prongs */}
                <rect x="193" y="170" width="14" height="24" rx="2" fill="url(#hg2)" opacity="0.98"/>
                <rect x="191" y="168" width="18" height="6" rx="2" fill="url(#hg1)" opacity="0.9"/>
                {/* 4 prongs */}
                <line x1="195" y1="170" x2="193" y2="160" stroke="#F2C94C" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="205" y1="170" x2="207" y2="160" stroke="#F2C94C" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="195" y1="175" x2="192" y2="165" stroke="#F5E6A3" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
                <line x1="205" y1="175" x2="208" y2="165" stroke="#F5E6A3" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>

                {/* ── DIAMOND GEM ── */}
                {/* Table — top flat face */}
                <polygon points="200,138 212,145 212,155 200,160 188,155 188,145" fill="url(#hgem)" opacity="0.92"/>
                {/* Girdle highlight */}
                <polygon points="200,138 212,145 200,160 188,145" fill="#B8DEFF" opacity="0.55"/>
                {/* Crown left */}
                <polygon points="188,145 200,138 192,130" fill="#E8F6FF" opacity="0.75"/>
                {/* Crown right */}
                <polygon points="212,145 200,138 208,130" fill="#D0ECFF" opacity="0.7"/>
                {/* Crown top */}
                <polygon points="192,130 200,138 208,130 200,126" fill="#F0FAFF" opacity="0.8"/>
                {/* Pavilion left */}
                <polygon points="188,145 188,155 178,150" fill="#3A70B4" opacity="0.6"/>
                {/* Pavilion right */}
                <polygon points="212,145 212,155 222,150" fill="#5A90CC" opacity="0.6"/>
                {/* Pavilion bottom-left */}
                <polygon points="188,155 200,160 200,170 184,158" fill="#2A5898" opacity="0.65"/>
                {/* Pavilion bottom-right */}
                <polygon points="212,155 200,160 200,170 216,158" fill="#4A78B0" opacity="0.65"/>
                {/* Culet */}
                <polygon points="184,158 200,170 216,158 200,160" fill="#1A3878" opacity="0.5"/>
                {/* Table highlight */}
                <polygon points="198,142 202,142 203,148 200,150 197,148" fill="white" opacity="0.4"/>
                {/* Crown sparkle */}
                <polygon points="200,123 201.5,128 200,133 198.5,128" fill="white" opacity="0.9"/>
                <polygon points="196.5,128 200,126.5 203.5,128 200,129.5" fill="white" opacity="0.75"/>

                {/* ── FLOATING GEMS ── */}
                {/* Top-left ruby */}
                <g transform="translate(108,138)">
                  <polygon points="0,-11 8,-4 8,4 0,11 -8,4 -8,-4" fill="url(#hruby)" opacity="0.88"/>
                  <polygon points="0,-11 8,-4 0,0 -8,-4" fill="#FF8080" opacity="0.5"/>
                  <polygon points="0,-3 2,-1 2,1 0,3 -2,1 -2,-1" fill="white" opacity="0.55"/>
                </g>
                {/* Top-right emerald */}
                <g transform="translate(292,142)">
                  <polygon points="0,-10 7,-3 7,4 0,10 -7,4 -7,-3" fill="url(#hemerl)" opacity="0.88"/>
                  <polygon points="0,-10 7,-3 0,0 -7,-3" fill="#66EFA0" opacity="0.5"/>
                  <polygon points="0,-3 2,-1 2,1 0,3 -2,1 -2,-1" fill="white" opacity="0.5"/>
                </g>
                {/* Top gold gem */}
                <g transform="translate(200,98)">
                  <polygon points="0,-9 6,-3 6,3 0,9 -6,3 -6,-3" fill="url(#hg1)" opacity="0.92"/>
                  <polygon points="0,-3 2,-1 2,1 0,3 -2,1 -2,-1" fill="#F5E6A3" opacity="0.7"/>
                </g>
                {/* Bottom sapphire left */}
                <g transform="translate(140,318)" opacity="0.75">
                  <polygon points="0,-8 6,-3 6,3 0,8 -6,3 -6,-3" fill="#4A8ED9" opacity="0.9"/>
                  <polygon points="0,-3 2,-1 2,1 0,3 -2,1 -2,-1" fill="#AAD4FF" opacity="0.6"/>
                </g>
                {/* Bottom ruby right */}
                <g transform="translate(260,316)" opacity="0.75">
                  <polygon points="0,-8 6,-3 6,3 0,8 -6,3 -6,-3" fill="url(#hruby)" opacity="0.9"/>
                  <polygon points="0,-3 2,-1 2,1 0,3 -2,1 -2,-1" fill="#FFC0C0" opacity="0.6"/>
                </g>

                {/* ── SPARKLE STARS (4-pointed) ── */}
                <g transform="translate(248,118)" fill="#F5E6A3" opacity="0.92">
                  <polygon points="0,-11 1.6,-1.6 11,0 1.6,1.6 0,11 -1.6,1.6 -11,0 -1.6,-1.6"/>
                </g>
                <g transform="translate(152,122)" fill="#F2C94C" opacity="0.75">
                  <polygon points="0,-8 1.1,-1.1 8,0 1.1,1.1 0,8 -1.1,1.1 -8,0 -1.1,-1.1"/>
                </g>
                <g transform="translate(88,195)" fill="#F5E6A3" opacity="0.65">
                  <polygon points="0,-7 1,-1 7,0 1,1 0,7 -1,1 -7,0 -1,-1"/>
                </g>
                <g transform="translate(314,194)" fill="#F5E6A3" opacity="0.65">
                  <polygon points="0,-7 1,-1 7,0 1,1 0,7 -1,1 -7,0 -1,-1"/>
                </g>
                <g transform="translate(340,258)" fill="#D4AF37" opacity="0.5">
                  <polygon points="0,-6 0.8,-0.8 6,0 0.8,0.8 0,6 -0.8,0.8 -6,0 -0.8,-0.8"/>
                </g>
                <g transform="translate(62,258)" fill="#D4AF37" opacity="0.5">
                  <polygon points="0,-6 0.8,-0.8 6,0 0.8,0.8 0,6 -0.8,0.8 -6,0 -0.8,-0.8"/>
                </g>
                <g transform="translate(200,62)" fill="#D4AF37" opacity="0.55">
                  <polygon points="0,-6 0.8,-0.8 6,0 0.8,0.8 0,6 -0.8,0.8 -6,0 -0.8,-0.8"/>
                </g>

                {/* Fine filigree curls near top of ring */}
                <path d="M130,126 Q148,112 168,120 Q152,132 130,126Z" fill="none" stroke="#D4AF37" strokeWidth="0.7" opacity="0.38"/>
                <path d="M270,126 Q252,112 232,120 Q248,132 270,126Z" fill="none" stroke="#D4AF37" strokeWidth="0.7" opacity="0.38"/>
                <path d="M126,130 Q138,122 150,126" fill="none" stroke="#D4AF37" strokeWidth="0.5" opacity="0.28"/>
                <path d="M274,130 Q262,122 250,126" fill="none" stroke="#D4AF37" strokeWidth="0.5" opacity="0.28"/>

                {/* Base ornamental line */}
                <path d="M148,348 Q200,357 252,348" fill="none" stroke="#D4AF37" strokeWidth="0.9" opacity="0.42"/>
                <path d="M160,353 Q200,360 240,353" fill="none" stroke="#D4AF37" strokeWidth="0.5" opacity="0.3"/>
                <circle cx="200" cy="359" r="3" fill="#D4AF37" opacity="0.5"/>
                <circle cx="162" cy="351" r="1.5" fill="#D4AF37" opacity="0.38"/>
                <circle cx="238" cy="351" r="1.5" fill="#D4AF37" opacity="0.38"/>
              </svg>}
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-dark-900/95 via-dark-900/80 to-transparent" />
            <div className="absolute inset-0 flex items-center">
              <div className="p-8 md:p-16 max-w-lg">
                <p className="section-subtitle mb-3">Our Heritage</p>
                <h2 className="section-title text-3xl md:text-4xl mb-4">
                  15 Years of Crafting <span className="text-gradient-gold">Masterpieces</span>
                </h2>
                <p className="text-dark-300 leading-relaxed mb-6">
                  From our family workshop to the finest boutiques, every M.B. JEWELLERS piece is hand-crafted 
                  with generations of goldsmithing expertise and an uncompromising eye for detail.
                </p>
                <Link to="/about" className="btn-gold text-sm">
                  Discover Our Story <FiArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
          </ScrollReveal>
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
                    <FiStar key={`star-${name}-${j}`} size={14} className="fill-gold-400 text-gold-400" />
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
