import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import imgPendant from '../assets/pendant.png';
import imgRing from '../assets/ring.png';
import imgEarring from '../assets/earing.png';
import imgNecklace from '../assets/necklage.png';
import imgKundanSet from '../assets/necklace.webp';
import { useDispatch, useSelector } from 'react-redux';
import {
  motion, AnimatePresence, useScroll, useTransform, useSpring, useMotionValueEvent, useReducedMotion,
} from 'framer-motion';
import { FiArrowRight, FiStar, FiShield, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { GiCutDiamond } from 'react-icons/gi';
import { fetchFeaturedProducts, selectFeaturedProducts } from '../store/productSlice';
import { categoryService } from '../services/services';
// import { reviewService } from '../services/services'; // DB fetch: reviewService.getFeatured()
import ProductCard from '../components/shop/ProductCard';
import { ProductCardSkeleton } from '../components/common/Skeletons';

/* ────────────────────────────────────────────────────────────────────────────
 * Home — calm, product-first layout with one clear scroll story (UI only).
 * ────────────────────────────────────────────────────────────────────────── */

const SERIF  = "font-['Cormorant_Garamond',Georgia,serif]";
const SCRIPT = { fontFamily: "'Allura', 'Great Vibes', cursive" };
const EASE   = [0.22, 1, 0.36, 1];

function useScriptFont() {
  useEffect(() => {
    const id = 'about-allura-font';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Allura&display=swap';
    document.head.appendChild(link);
  }, []);
}

// ─── Content ──────────────────────────────────────────────────────────────────
const trust = [
  { icon: FiShield,     label: 'Certified Authentic' },
  { icon: GiCutDiamond, label: 'Fine Artistry' },
  { icon: FiStar,       label: 'Premium Quality' },
];

const story = [
  {
    key: 'gold', image: imgRing, alt: 'Model wearing a gold necklace and ring',
    eyebrow: 'Pure Gold', title: 'BIS-Hallmarked, Every Time',
    text: 'Our 22K and 18K gold is certified for purity before it is ever shaped — so the piece you wear is exactly what we promise.',
    cta: 'Shop Gold', to: '/shop?material=Gold',
  },
  {
    key: 'diamond', image: imgEarring, alt: 'Model wearing diamond earrings',
    eyebrow: 'Brilliance', title: 'Diamonds Chosen for Their Fire',
    text: 'Certified diamonds, hand-selected for clarity and sparkle, set by artisans who check every stone by eye.',
    cta: 'Discover Diamonds', to: '/diamond-coming-soon',
  },
  {
    key: 'heritage', image: imgKundanSet, alt: 'Kundan necklace set with emeralds',
    eyebrow: 'Craftsmanship', title: 'Heirlooms, Finished by Hand',
    text: 'From kundan sets to everyday chains, each design is polished, set and inspected by hand in our workshop.',
    cta: 'Shop Necklaces', keyword: 'Necklace',
  },
  {
    key: 'family', image: imgPendant, alt: 'Young girl wearing a gold pendant',
    eyebrow: 'For Every Generation', title: 'Made for Your Moments',
    text: 'First jewellery, wedding sets, or a design that is only yours — tell us what you imagine and we will craft it.',
    cta: 'Design Custom Jewellery', to: '/custom-order',
  },
];

const testimonials = [
  { name: 'Priya Sharma', rating: 5, text: 'Absolutely gorgeous ring! The craftsmanship is impeccable and arrived beautifully packaged.', location: 'Mumbai' },
  { name: 'Anita Reddy',  rating: 5, text: 'I bought a necklace for my wedding — everyone kept asking where it was from. Truly luxury!', location: 'Hyderabad' },
  { name: 'Kavita Nair',  rating: 5, text: 'Exceptional quality and the customer service was outstanding. My go-to jewelry store now.', location: 'Kochi' },
];

const collections = [
  { name: 'Rings',     keyword: 'Ring',     image: imgRing },
  { name: 'Necklaces', keyword: 'Necklace', image: imgNecklace },
  { name: 'Earrings',  keyword: 'Earring',  image: imgEarring },
  { name: 'Pendants',  keyword: 'Pendant',  image: imgPendant },
];

/**
 * Shop link for a jewellery type. The shop filters by category id (not by "type"),
 * so match a category by name/slug when one exists; otherwise fall back to a text search.
 */
function shopLinkFor(keyword, categories) {
  const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/s$/, '');
  const k = norm(keyword);
  const cat = categories.find((c) => norm(c.name) === k || norm(c.slug) === k);
  return cat ? `/shop?category=${cat._id}` : `/shop?search=${encodeURIComponent(keyword)}`;
}

// ─── Small building blocks ────────────────────────────────────────────────────
function Eyebrow({ children, className = '' }) {
  return (
    <p className={`font-jakarta text-[11px] font-semibold tracking-[0.32em] text-gold-500 uppercase ${className}`}>{children}</p>
  );
}
Eyebrow.propTypes = { children: PropTypes.node.isRequired, className: PropTypes.string };

function SectionHeading({ eyebrow, title, sub, align = 'center' }) {
  const center = align === 'center';
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.8, ease: EASE }}
      className={center ? 'text-center' : ''}
    >
      <Eyebrow className="mb-3">{eyebrow}</Eyebrow>
      <h2 className={`${SERIF} text-white text-4xl sm:text-5xl font-medium leading-tight pt-0`}>{title}</h2>
      <div className={`h-px w-16 bg-gradient-to-r from-gold-600 to-gold-300 mt-5 ${center ? 'mx-auto' : ''}`} />
      {sub && <p className={`font-jakarta text-dark-400 mt-5 max-w-xl ${center ? 'mx-auto' : ''}`}>{sub}</p>}
    </motion.div>
  );
}
SectionHeading.propTypes = { eyebrow: PropTypes.string.isRequired, title: PropTypes.node.isRequired, sub: PropTypes.string, align: PropTypes.string };

// ─── 1. Hero — calm, one message, one image ──────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden">
      {/* soft light only — no busy backgrounds */}
      <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_72%_45%,rgba(212,175,55,0.12),transparent_70%)]" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-dark-900 to-transparent" aria-hidden="true" />

      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
        {/* copy */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: EASE }} className="text-center lg:text-left">
          <Eyebrow className="mb-6">The Art of Fine Jewelry</Eyebrow>
          <h1 className={`${SERIF} text-white font-medium leading-[1.05] pt-0 text-5xl sm:text-6xl lg:text-7xl`}>
            Timeless{' '}
            <span style={SCRIPT} className="text-gradient-gold font-normal text-[1.25em] leading-[1.1] inline-block px-1 align-baseline">Elegance</span>
            <br />Redefined
          </h1>
          <p className="font-jakarta text-dark-300 text-base sm:text-lg max-w-xl mx-auto lg:mx-0 mt-6 leading-relaxed">
            Discover our curated collection of handcrafted gold, diamond, and precious stone jewelry —
            each piece a statement of lasting beauty.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mt-10">
            <Link to="/shop" id="hero-shop-btn" className="btn-gold text-base py-4 px-8">
              Explore Collection <FiArrowRight size={18} />
            </Link>
            <Link to="/about" className="btn-outline-gold text-base py-4 px-8">
              Our Story
            </Link>
          </div>

          {/* trust row */}
          <ul className="mt-12 flex flex-wrap justify-center lg:justify-start gap-x-8 gap-y-3">
            {trust.map((t) => {
              const TIcon = t.icon;
              return (
                <li key={t.label} className="flex items-center gap-2 font-jakarta text-sm text-dark-300">
                  <TIcon size={16} className="text-gold-500" />
                  {t.label}
                </li>
              );
            })}
          </ul>
        </motion.div>

        {/* image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, delay: 0.15, ease: EASE }}
          className="relative mx-auto w-full max-w-[420px] lg:max-w-[min(420px,calc((100vh_-_10rem)*0.8))]"
        >
          <div className="absolute -inset-3 rounded-t-full rounded-b-[36px] border border-gold-500/25" aria-hidden="true" />
          <div className="relative aspect-[4/5] rounded-t-full rounded-b-[30px] overflow-hidden bg-dark-800 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
            <img src={imgNecklace} alt="Model wearing a handcrafted gold necklace" className="w-full h-full object-cover object-top" />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-dark-900/70 to-transparent" />
          </div>
          {/* single quiet badge */}
          <div className="absolute -left-4 sm:-left-10 bottom-10 rounded-2xl border border-gold-500/30 bg-dark-900/90 backdrop-blur-md px-5 py-3.5 shadow-xl">
            <p className="font-jakarta text-[10px] uppercase tracking-[0.25em] text-gold-500">Since 2010</p>
            <p className={`${SERIF} text-white text-xl font-semibold leading-tight mt-0.5`}>Handcrafted with care</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── 2. One clear scroll story — sticky image, steps on the right ────────────
function StoryStep({ step, index, active, categories }) {
  return (
    <div className="lg:min-h-[70vh] flex flex-col justify-center py-10 lg:py-0">
      {/* mobile image */}
      <div className="lg:hidden mb-6 rounded-3xl overflow-hidden aspect-[4/5] max-w-sm mx-auto w-full border border-gold-500/15">
        <img src={step.image} alt={step.alt} loading="lazy" className="w-full h-full object-cover object-top" />
      </div>
      <div className={`max-w-md transition-opacity duration-500 ${active ? 'lg:opacity-100' : 'lg:opacity-30'}`}>
        <div className="flex items-center gap-3 mb-4">
          <span className="font-jakarta text-xs font-semibold text-gold-500 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
          <span className="h-px w-8 bg-gold-500/50" />
          <Eyebrow>{step.eyebrow}</Eyebrow>
        </div>
        <h3 className={`${SERIF} text-white text-3xl sm:text-4xl font-semibold leading-tight`}>{step.title}</h3>
        <p className="font-jakarta text-dark-300 text-base sm:text-lg leading-relaxed mt-4">{step.text}</p>
        <Link to={step.keyword ? shopLinkFor(step.keyword, categories) : step.to} className="group inline-flex items-center gap-2 mt-6 font-jakarta text-sm font-semibold text-gold-400 hover:text-gold-300">
          {step.cta}
          <FiArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
StoryStep.propTypes = { step: PropTypes.object.isRequired, index: PropTypes.number.isRequired, active: PropTypes.bool.isRequired, categories: PropTypes.array.isRequired };

function StorySection({ categories }) {
  const ref = useRef(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start center', 'end center'] });
  const fill = useTransform(scrollYProgress, [0, 1], [0, 1]);
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setActive(Math.min(story.length - 1, Math.max(0, Math.floor(v * story.length))));
  });
  const current = story[active];

  return (
    <section className="relative py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Why M.B. Jewellers" title="Crafted to be Cherished" />

        <div ref={ref} className="mt-16 lg:mt-20 grid lg:grid-cols-2 gap-10 lg:gap-20">
          {/* sticky image (desktop) */}
          <div className="hidden lg:block">
            <div className="sticky top-28">
              <div className="relative mx-auto w-full max-w-[calc((100vh_-_9rem)*0.8)] aspect-[4/5] rounded-[32px] overflow-hidden border border-gold-500/20 bg-dark-800 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
                <AnimatePresence mode="sync">
                  <motion.img
                    key={current.key}
                    src={current.image}
                    alt={current.alt}
                    initial={{ opacity: 0, scale: 1.04 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7, ease: EASE }}
                    className="absolute inset-0 w-full h-full object-cover object-top"
                  />
                </AnimatePresence>
                <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-dark-900/80 to-transparent" />
                <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between">
                  <span className={`${SERIF} text-white text-xl font-semibold`}>{current.eyebrow}</span>
                  <span className="font-jakarta text-xs text-gold-300 tabular-nums">{String(active + 1).padStart(2, '0')} / {String(story.length).padStart(2, '0')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* steps */}
          <div className="relative lg:pl-10">
            <div className="hidden lg:block absolute left-0 top-[15vh] bottom-[15vh] w-px bg-white/10" aria-hidden="true">
              <motion.div style={{ scaleY: fill }} className="origin-top w-px h-full bg-gold-500" />
            </div>
            {story.map((s, i) => <StoryStep key={s.key} step={s} index={i} active={i === active} categories={categories} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
StorySection.propTypes = { categories: PropTypes.array.isRequired };

// ─── 3. Collections ───────────────────────────────────────────────────────────
function CollectionsSection({ categories }) {
  return (
    <section className="relative py-24 md:py-28 bg-dark-950 border-y border-white/5 scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Browse By" title="Our Collections" />
        <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {collections.map(({ name, keyword, image }, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.8, delay: i * 0.08, ease: EASE }}
            >
              <Link
                to={shopLinkFor(keyword, categories)}
                id={`collection-${name.toLowerCase()}`}
                className="group block relative rounded-3xl overflow-hidden aspect-[3/4] border border-white/5 hover:border-gold-500/40 transition-colors duration-500"
              >
                <img
                  src={image} alt={name} loading="lazy"
                  className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-dark-950/90 via-dark-950/10 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 p-5 sm:p-6">
                  <h3 className={`${SERIF} text-white text-2xl sm:text-3xl font-semibold`}>{name}</h3>
                  <p className="font-jakarta text-sm text-gold-400 mt-1 flex items-center gap-2">
                    Explore
                    <FiArrowRight size={13} className="transition-transform duration-300 group-hover:translate-x-1" />
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
CollectionsSection.propTypes = { categories: PropTypes.array.isRequired };

// ─── 4. Featured products — the main showcase ────────────────────────────────
function FeaturedShowcase({ featured, loading, railRef, scrollRail, pauseRail }) {
  return (
    <section className="relative py-24 md:py-32 scroll-mt-24">
      <div className="absolute left-1/2 top-10 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(212,175,55,0.07),transparent_70%)] pointer-events-none" aria-hidden="true" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <SectionHeading eyebrow="Handpicked For You" title="Featured Pieces" align="left" />
          <div className="flex items-center gap-3">
            <button onClick={() => scrollRail(-1)} aria-label="Previous" className="w-11 h-11 rounded-full flex items-center justify-center border border-gold-500/30 text-gold-400 hover:bg-gold-500 hover:text-dark-900 transition-all duration-300">
              <FiChevronLeft size={20} />
            </button>
            <button onClick={() => scrollRail(1)} aria-label="Next" className="w-11 h-11 rounded-full flex items-center justify-center border border-gold-500/30 text-gold-400 hover:bg-gold-500 hover:text-dark-900 transition-all duration-300">
              <FiChevronRight size={20} />
            </button>
            <Link to="/shop" className="btn-outline-gold text-sm ml-2">
              View All <FiArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div
          ref={railRef}
          onMouseEnter={() => pauseRail(true)}
          onMouseLeave={() => pauseRail(false)}
          onFocus={() => pauseRail(true)}
          onBlur={() => pauseRail(false)}
          onTouchStart={() => pauseRail(true)}
          onTouchEnd={() => pauseRail(false)}
          className="flex items-stretch gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-px-4 sm:scroll-px-0 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {loading
            ? Array.from({ length: 4 }, (_, n) => n).map((n) => (
                <div key={n} data-card className="snap-start shrink-0 w-[240px] sm:w-[270px] lg:w-[285px]">
                  <ProductCardSkeleton />
                </div>
              ))
            : featured.map((product) => (
                <div key={product._id} data-card className="snap-start shrink-0 w-[240px] sm:w-[270px] lg:w-[285px]">
                  <ProductCard product={product} />
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
FeaturedShowcase.propTypes = {
  featured: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  railRef: PropTypes.object.isRequired,
  scrollRail: PropTypes.func.isRequired,
  pauseRail: PropTypes.func.isRequired,
};

// ─── 5. Heritage — a ring is crafted as you scroll ──────────────────────────
const SWING_CSS = `
@keyframes mbSwing { 0%, 100% { transform: rotate(-3.5deg); } 50% { transform: rotate(3.5deg); } }
@keyframes mbTwinkle { 0%, 100% { opacity: .25; transform: scale(.6); } 50% { opacity: 1; transform: scale(1); } }
`;

function JewelDefs() {
  return (
    <defs>
      <linearGradient id="mbGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FBEFC4" />
        <stop offset="38%" stopColor="#E5AB28" />
        <stop offset="68%" stopColor="#D4AF37" />
        <stop offset="100%" stopColor="#8A6018" />
      </linearGradient>
      <linearGradient id="mbIce" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
        <stop offset="55%" stopColor="#DCE9FA" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#9DB4D6" stopOpacity="0.35" />
      </linearGradient>
      <radialGradient id="mbGlow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.28" />
        <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

function Twinkle({ x, y, size = 9, delay = 0, style }) {
  const reduce = useReducedMotion();
  return (
    <motion.g style={style}>
      <path
        d={`M${x} ${y - size} L${x + size * 0.22} ${y - size * 0.22} L${x + size} ${y} L${x + size * 0.22} ${y + size * 0.22} L${x} ${y + size} L${x - size * 0.22} ${y + size * 0.22} L${x - size} ${y} L${x - size * 0.22} ${y - size * 0.22} Z`}
        fill="#FBEFC4"
        style={reduce ? undefined : { transformBox: 'fill-box', transformOrigin: 'center', animation: `mbTwinkle 3.2s ease-in-out ${delay}s infinite` }}
      />
    </motion.g>
  );
}
Twinkle.propTypes = { x: PropTypes.number.isRequired, y: PropTypes.number.isRequired, size: PropTypes.number, delay: PropTypes.number, style: PropTypes.object };

function RingCrafting() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const p      = useSpring(scrollYProgress, { stiffness: 80, damping: 24, mass: 0.4, restDelta: 0.0005 });
  const band   = useTransform(p, [0.05, 0.6], [0, 1]);
  const prongs = useTransform(p, [0.45, 0.7], [0, 1]);
  const gemY   = useTransform(p, [0.55, 0.92], [-80, 0]);
  const gemO   = useTransform(p, [0.55, 0.8], [0, 1]);
  const shine  = useTransform(p, [0.8, 1], [0, 1]);
  const orbit  = useTransform(p, [0, 1], [-70, 0]);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[400px] aspect-square" aria-hidden="true">
      <svg viewBox="0 0 400 400" className="w-full h-full pointer-events-none">
        <style>{SWING_CSS}</style>
        <JewelDefs />
        <circle cx="200" cy="200" r="196" fill="url(#mbGlow)" />
        {/* orbit frame — turns into place */}
        <motion.g style={{ rotate: orbit, transformOrigin: '200px 200px', transformBox: 'view-box' }}>
          <circle cx="200" cy="200" r="186" fill="none" stroke="#D4AF37" strokeOpacity="0.28" strokeWidth="1" strokeDasharray="2 8" />
          {[[200, 14], [386, 200], [200, 386], [14, 200]].map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x - 4} y={y - 4} width="8" height="8" fill="#D4AF37" transform={`rotate(45 ${x} ${y})`} />
          ))}
        </motion.g>
        <circle cx="200" cy="200" r="160" fill="none" stroke="#D4AF37" strokeOpacity="0.1" strokeWidth="1" />

        {/* light behind the stone */}
        <motion.g style={{ opacity: shine }} stroke="#FBEFC4" strokeOpacity="0.28" strokeWidth="1">
          {Array.from({ length: 10 }, (_, k) => k * 36).map((deg) => (
            <line key={deg} x1="200" y1="112" x2={200 + 120 * Math.cos((deg * Math.PI) / 180)} y2={112 + 120 * Math.sin((deg * Math.PI) / 180)} />
          ))}
        </motion.g>

        {/* band — drawn by scroll */}
        <motion.circle cx="200" cy="245" r="92" fill="none" stroke="url(#mbGold)" strokeWidth="16" strokeLinecap="round"
          transform="rotate(-90 200 245)" style={{ pathLength: band }} />
        <motion.circle cx="200" cy="245" r="82" fill="none" stroke="#FBEFC4" strokeOpacity="0.35" strokeWidth="1"
          transform="rotate(-90 200 245)" style={{ pathLength: band }} />
        <motion.path d="M140 302 A92 92 0 0 0 260 302" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" style={{ opacity: shine }} />

        {/* setting */}
        <motion.path d="M176 160 L184 134 M224 160 L216 134 M182 156 Q200 145 218 156" fill="none" stroke="url(#mbGold)" strokeWidth="5" strokeLinecap="round" style={{ pathLength: prongs }} />

        {/* diamond — lowers into the setting */}
        <motion.g style={{ y: gemY, opacity: gemO }}>
          <polygon points="180,86 220,86 240,106 160,106" fill="url(#mbIce)" stroke="#FFFFFF" strokeWidth="1.3" />
          <polygon points="160,106 240,106 200,146" fill="url(#mbIce)" stroke="#FFFFFF" strokeWidth="1.3" />
          <path d="M180 86 L190 106 L200 86 L210 106 L220 86 M190 106 L200 146 L210 106 M160 106 L200 146 L240 106" fill="none" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="0.9" />
        </motion.g>

        <Twinkle x={262} y={78} size={11} style={{ opacity: shine }} />
        <Twinkle x={136} y={96} size={7} delay={1.1} style={{ opacity: shine }} />
        <Twinkle x={278} y={150} size={6} delay={2} style={{ opacity: shine }} />
      </svg>
    </div>
  );
}

function HeritageBanner() {
  return (
    <section className="relative py-24 md:py-28 bg-dark-950 border-y border-white/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-12 items-center">
        <RingCrafting />
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.9, delay: 0.1, ease: EASE }}>
          <Eyebrow className="mb-4">Our Heritage</Eyebrow>
          <h2 className={`${SERIF} text-white text-4xl sm:text-5xl font-medium leading-tight pt-0`}>
            15 Years of Crafting Masterpieces
          </h2>
          <p className="font-jakarta text-dark-300 leading-relaxed mt-5 mb-8 max-w-lg">
            From our family workshop to the finest boutiques, every M.B. JEWELLERS piece is hand-crafted
            with generations of goldsmithing expertise and an uncompromising eye for detail.
          </p>
          <Link to="/about" className="btn-gold text-sm">
            Discover Our Story <FiArrowRight size={14} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

// ─── 6. Testimonials ─────────────────────────────────────────────────────────
function Testimonials() {
  return (
    <section className="relative py-24 md:py-28 scroll-mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Customer Love" title="What They Say" />
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map(({ name, rating, text, location }, i) => (
            <motion.figure
              key={name}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ delay: i * 0.1, duration: 0.8, ease: EASE }}
              className="rounded-3xl border border-white/[0.06] bg-dark-800 p-8"
            >
              <div className="flex gap-1 mb-5">
                {Array.from({ length: rating }).map((_, j) => (
                  <FiStar key={`star-${name}-${j}`} size={14} className="fill-gold-400 text-gold-400" />
                ))}
              </div>
              <blockquote className={`${SERIF} italic text-white/90 text-xl leading-relaxed`}>&ldquo;{text}&rdquo;</blockquote>
              <figcaption className="flex items-center gap-3 mt-7 pt-5 border-t border-white/5">
                <div className="w-10 h-10 rounded-full bg-gold-gradient flex items-center justify-center text-dark-900 font-bold text-sm">{name.charAt(0)}</div>
                <div>
                  <p className="font-jakarta text-white text-sm font-semibold">{name}</p>
                  <p className="font-jakarta text-dark-500 text-xs">{location}</p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 7. Closing — a necklace drapes across the page ─────────────────────────
function NecklaceFinale() {
  const reduce = useReducedMotion();
  const draw = (delay) => ({
    hidden: { pathLength: 0, opacity: 0 },
    show:   { pathLength: 1, opacity: 1, transition: { duration: 2.2, delay, ease: EASE } },
  });
  const fade = (delay) => ({
    hidden: { opacity: 0 },
    show:   { opacity: 1, transition: { duration: 1.2, delay, ease: EASE } },
  });
  return (
    <section className="relative pt-8 pb-20 md:pb-24 overflow-hidden">
      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[900px] h-[420px] bg-[radial-gradient(50%_55%_at_50%_70%,rgba(212,175,55,0.10),transparent_70%)] pointer-events-none" aria-hidden="true" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.9, ease: EASE }}>
          <Eyebrow className="mb-4">M.B. Jewellers · Since 2010</Eyebrow>
          <h2 className={`${SERIF} text-white text-4xl sm:text-5xl font-medium leading-tight pt-0`}>
            Jewellery that Tells{' '}
            <span style={SCRIPT} className="text-gradient-gold font-normal text-[1.3em] px-1 inline-block whitespace-nowrap">Your Story</span>
          </h2>
        </motion.div>

        <motion.svg
          viewBox="0 0 1200 320" className="w-full h-auto mt-2 pointer-events-none" aria-hidden="true"
          initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.35 }}
        >
          <style>{SWING_CSS}</style>
          <JewelDefs />
          {/* chains */}
          <motion.path d="M20 12 Q600 340 1180 12" fill="none" stroke="url(#mbGold)" strokeWidth="2.6" variants={draw(0)} />
          <motion.path d="M70 12 Q600 300 1130 12" fill="none" stroke="url(#mbGold)" strokeWidth="1.2" strokeOpacity="0.55" variants={draw(0.25)} />
          <motion.path d="M20 12 Q600 340 1180 12" fill="none" stroke="#FBEFC4" strokeWidth="6" strokeLinecap="round" strokeDasharray="0.1 18" variants={fade(1.4)} />

          {/* pendant — swings gently */}
          <motion.g variants={fade(1.7)}>
            <g style={reduce ? undefined : { transformBox: 'view-box', transformOrigin: '600px 176px', animation: 'mbSwing 6s ease-in-out infinite' }}>
              <circle cx="600" cy="184" r="7" fill="none" stroke="url(#mbGold)" strokeWidth="3" />
              <path d="M600 194 C574 222 574 266 600 288 C626 266 626 222 600 194 Z" fill="url(#mbIce)" stroke="url(#mbGold)" strokeWidth="3.5" />
              <path d="M600 194 L600 288 M584 230 L600 288 L616 230 M584 230 L600 194 L616 230 M584 230 L616 230" fill="none" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="0.9" />
              <circle cx="600" cy="300" r="2.4" fill="#FBEFC4" />
            </g>
          </motion.g>

          <motion.g variants={fade(2.1)}>
            <Twinkle x={648} y={218} size={10} />
            <Twinkle x={552} y={250} size={7} delay={1.3} />
            <Twinkle x={430} y={150} size={5} delay={0.6} />
            <Twinkle x={770} y={150} size={5} delay={2.2} />
          </motion.g>
        </motion.svg>

        <motion.p
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.8 }} transition={{ duration: 1, delay: 0.4 }}
          className={`${SERIF} italic text-dark-300 text-lg sm:text-xl -mt-2`}
        >
          Crafted in gold. Worn for a lifetime.
        </motion.p>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  useScriptFont();
  const dispatch = useDispatch();
  const featured = useSelector(selectFeaturedProducts);
  const loading = featured.length === 0;
  const railRef = useRef(null);
  const railPausedRef = useRef(false);
  const lastRailActionRef = useRef(0);
  const reduceMotion = useReducedMotion();
  const [categories, setCategories] = useState([]);

  // Categories let the collection tiles link to a real shop filter
  useEffect(() => {
    let alive = true;
    categoryService.getCategories()
      .then((res) => { if (alive) setCategories(res.data?.categories || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Pause while hovered/focused/touched; resume after a short grace period
  const pauseRail = (paused) => {
    railPausedRef.current = paused;
    lastRailActionRef.current = Date.now();
  };

  const railStep = (rail) => {
    const card = rail.querySelector('[data-card]');
    const gap = Number.parseFloat(getComputedStyle(rail).columnGap) || 24;
    return card ? card.offsetWidth + gap : rail.clientWidth;
  };

  // Auto-advance the featured rail sideways every 5s; loop back at the end.
  useEffect(() => {
    if (loading || reduceMotion) return undefined;
    const rail = railRef.current;
    if (!rail) return undefined;
    const id = setInterval(() => {
      if (railPausedRef.current || document.hidden) return;
      if (Date.now() - lastRailActionRef.current < 5000) return; // shopper just interacted
      const maxScroll = rail.scrollWidth - rail.clientWidth;
      if (rail.scrollLeft >= maxScroll - 4) {
        rail.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        rail.scrollBy({ left: railStep(rail), behavior: 'smooth' });
      }
    }, 5000);
    return () => clearInterval(id);
  }, [loading, featured.length, reduceMotion]);

  // Manual prev/next — one card per click; wraps around at either end
  const scrollRail = (dir) => {
    const rail = railRef.current;
    if (!rail) return;
    lastRailActionRef.current = Date.now();
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    if (dir > 0 && rail.scrollLeft >= maxScroll - 4) {
      rail.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (dir < 0 && rail.scrollLeft <= 4) {
      rail.scrollTo({ left: maxScroll, behavior: 'smooth' });
    } else {
      rail.scrollBy({ left: dir * railStep(rail), behavior: 'smooth' });
    }
  };

  useEffect(() => {
    document.title = 'M.B. JEWELLERS — Luxury Fine Jewelry';
    dispatch(fetchFeaturedProducts());
    // To fetch from DB instead of static data:
    // reviewService.getFeatured().then(res => { if (res.data.success) setTestimonials(res.data.reviews); }).catch(() => {});
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-dark-900 overflow-x-clip">
      <Hero />
      <StorySection categories={categories} />
      <CollectionsSection categories={categories} />
      <FeaturedShowcase featured={featured} loading={loading} railRef={railRef} scrollRail={scrollRail} pauseRail={pauseRail} />
      <HeritageBanner />
      <Testimonials />
      <NecklaceFinale />
    </div>
  );
}
