import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  motion, AnimatePresence, useScroll, useTransform, useMotionValueEvent,
  useInView, useReducedMotion, animate,
} from 'framer-motion';
import { FiAward, FiHeart, FiGlobe, FiUsers, FiArrowRight } from 'react-icons/fi';

/* ────────────────────────────────────────────────────────────────────────────
 * About — scrollytelling page (UI only)
 * All illustrations are decorative SVG (aria-hidden, pointer-events-none).
 * ────────────────────────────────────────────────────────────────────────── */

const SERIF  = "font-['Cormorant_Garamond',Georgia,serif]";
const SCRIPT = { fontFamily: "'Allura', 'Great Vibes', cursive" };
const EASE   = [0.22, 1, 0.36, 1];

// Load the hero script font once (About page only)
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
const stats = [
  { to: 15,  suffix: '+',  label: 'Years of Excellence' },
  { to: 10,  suffix: 'K+', label: 'Happy Customers' },
  { to: 500, suffix: '+',  label: 'Unique Designs' },
  { to: 4.9, suffix: '★',  label: 'Average Rating', decimals: 1 },
];

const values = [
  { icon: FiAward, title: 'Craftsmanship',    desc: 'Every piece is hand-finished by master artisans with decades of goldsmithing experience.' },
  { icon: FiHeart, title: 'Love For Detail',  desc: 'We obsess over every facet, every curve, every shine — because perfection is in the details.' },
  { icon: FiGlobe, title: 'Ethical Sourcing', desc: 'All our diamonds and gemstones are ethically sourced with full traceability.' },
  { icon: FiUsers, title: 'Family Heritage',  desc: 'Founded by a family of jewelers, M.B. JEWELLERS carries forward three generations of artisanal tradition.' },
];

const chapters = [
  {
    key: 'heritage', numeral: 'I', eyebrow: 'Since 2010', title: 'Two Lineages, One Legacy',
    text: 'M.B. JEWELLERS was born from a passion for creating pieces that transcend time. Founded by the Mehta and Bose families — two lineages of master jewelers from Rajasthan and Bengal — we combined our heritages to create something truly unique.',
    art: 'bangles', caption: 'Two bangles, intertwined — like the families behind every piece.',
  },
  {
    key: 'gold', numeral: 'II', eyebrow: 'The Metal', title: 'Pure, Hallmarked Gold',
    text: 'Every piece begins with BIS-hallmarked gold — weighed, assayed and certified before a single design is drawn. Purity is not a promise we make; it is a standard we stamp.',
    art: 'ingot', caption: 'Certified purity — the foundation of every creation.',
  },
  {
    key: 'brilliance', numeral: 'III', eyebrow: 'The Brilliance', title: 'Diamonds that Hold the Light',
    text: 'We work with GIA-certified diamonds and hand-selected gemstones, ethically sourced with full traceability — each one chosen for the way it catches and returns the light.',
    art: 'diamond', caption: 'Fifty-seven facets, one perfect sparkle.',
  },
  {
    key: 'artisans', numeral: 'IV', eyebrow: 'The Atelier', title: 'Shaped by Master Hands',
    text: 'Our workshop employs over 50 skilled craftspeople who bring our designs to life — setting, engraving and polishing by hand, with meticulous attention to every detail.',
    art: 'necklace', caption: 'Line by line, link by link — a necklace takes shape.',
  },
  {
    key: 'today', numeral: 'V', eyebrow: 'Today', title: 'A Piece of Forever',
    text: 'Today, M.B. JEWELLERS serves customers across India and internationally — a seamless blend of traditional craftsmanship and contemporary design. Each purchase comes with a certificate of authenticity and a lifetime warranty on craftsmanship.',
    art: 'ring', caption: 'Made to be worn for a lifetime — and handed down after.',
  },
];

// ─── Decorative primitives ────────────────────────────────────────────────────
function Sparkle({ size = 16, className = '', delay = 0 }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      viewBox="-12 -12 24 24" width={size} height={size} aria-hidden="true"
      className={`pointer-events-none ${className}`}
      animate={reduce ? undefined : { scale: [0.6, 1.1, 0.6], opacity: [0.35, 1, 0.35], rotate: [0, 45, 0] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      <path d="M0 -11 L2.4 -2.4 L11 0 L2.4 2.4 L0 11 L-2.4 2.4 L-11 0 L-2.4 -2.4 Z" fill="currentColor" />
    </motion.svg>
  );
}
Sparkle.propTypes = { size: PropTypes.number, className: PropTypes.string, delay: PropTypes.number };

function GoldDefs({ id }) {
  return (
    <defs>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#F9E7A5" />
        <stop offset="35%" stopColor="#E5AB28" />
        <stop offset="65%" stopColor="#D4AF37" />
        <stop offset="100%" stopColor="#8A6018" />
      </linearGradient>
      <linearGradient id={`${id}-goldsoft`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F3DA8A" />
        <stop offset="100%" stopColor="#A87820" />
      </linearGradient>
      <linearGradient id={`${id}-ice`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
        <stop offset="50%" stopColor="#DCEBFF" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#9FB7D9" stopOpacity="0.35" />
      </linearGradient>
      <radialGradient id={`${id}-ruby`} cx="0.4" cy="0.35" r="0.7">
        <stop offset="0%" stopColor="#FF8FA3" />
        <stop offset="45%" stopColor="#C2183B" />
        <stop offset="100%" stopColor="#5A0A1C" />
      </radialGradient>
      <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}
GoldDefs.propTypes = { id: PropTypes.string.isRequired };

const draw = (delay = 0) => ({
  initial: { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1 },
  transition: { duration: 1.6, delay, ease: EASE },
});

// ─── Jewellery illustrations ──────────────────────────────────────────────────
function RingArt({ className = '' }) {
  const id = useId().replaceAll(':', '');
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <GoldDefs id={id} />
      <circle cx="100" cy="110" r="90" fill={`url(#${id}-glow)`} />
      {/* band */}
      <motion.circle cx="100" cy="128" r="46" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="11" {...draw(0)} />
      <motion.circle cx="100" cy="128" r="39" fill="none" stroke="#F9E7A5" strokeOpacity="0.35" strokeWidth="1" {...draw(0.3)} />
      {/* prongs / setting */}
      <motion.path d="M84 84 L90 64 M116 84 L110 64 M92 84 Q100 76 108 84" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="4" strokeLinecap="round" {...draw(0.5)} />
      {/* diamond */}
      <motion.g initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.9, ease: EASE }}>
        <polygon points="86,38 114,38 128,52 72,52" fill={`url(#${id}-ice)`} stroke="#FFFFFF" strokeOpacity="0.9" strokeWidth="1.2" />
        <polygon points="72,52 128,52 100,82" fill={`url(#${id}-ice)`} stroke="#FFFFFF" strokeOpacity="0.9" strokeWidth="1.2" />
        <path d="M86 38 L93 52 L100 38 L107 52 L114 38 M86 52 L100 82 L114 52 M93 52 L100 82 L107 52" fill="none" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="0.8" />
      </motion.g>
    </svg>
  );
}
RingArt.propTypes = { className: PropTypes.string };

function NecklaceArt({ className = '' }) {
  const id = useId().replaceAll(':', '');
  return (
    <svg viewBox="0 0 240 200" className={className} aria-hidden="true">
      <GoldDefs id={id} />
      <circle cx="120" cy="110" r="95" fill={`url(#${id}-glow)`} />
      {/* outer beaded strand */}
      <motion.path d="M18 26 Q120 176 222 26" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="5" strokeLinecap="round" strokeDasharray="0.1 9" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2, delay: 0.6 }} />
      {/* inner fine chain */}
      <motion.path d="M30 26 Q120 150 210 26" fill="none" stroke={`url(#${id}-goldsoft)`} strokeWidth="1.6" {...draw(0.3)} />
      <motion.path d="M42 26 Q120 128 198 26" fill="none" stroke={`url(#${id}-goldsoft)`} strokeWidth="1" strokeOpacity="0.6" {...draw(0.5)} />
      {/* pendant */}
      <motion.g initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, delay: 1.1, ease: EASE }} style={{ transformOrigin: '120px 120px' }}>
        <circle cx="120" cy="103" r="4.5" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="2.2" />
        <path d="M120 110 C106 124 106 146 120 156 C134 146 134 124 120 110 Z" fill={`url(#${id}-ruby)`} stroke={`url(#${id}-gold)`} strokeWidth="3" />
        <path d="M114 128 Q118 120 123 118" fill="none" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}
NecklaceArt.propTypes = { className: PropTypes.string };

function BanglesArt({ className = '' }) {
  const id = useId().replaceAll(':', '');
  const reduce = useReducedMotion();
  const studs = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  return (
    <svg viewBox="0 0 220 200" className={className} aria-hidden="true">
      <GoldDefs id={id} />
      <circle cx="110" cy="100" r="95" fill={`url(#${id}-glow)`} />
      <motion.g animate={reduce ? undefined : { rotate: [0, 4, 0, -4, 0] }} transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '110px 100px' }}>
        <motion.circle cx="82" cy="100" r="52" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="10" {...draw(0)} />
        <motion.circle cx="82" cy="100" r="52" fill="none" stroke="#3A2A08" strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="1 5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1 }} />
        <motion.circle cx="138" cy="100" r="52" fill="none" stroke={`url(#${id}-goldsoft)`} strokeWidth="10" {...draw(0.25)} />
        {studs.map((deg) => {
          const r = (deg * Math.PI) / 180;
          return (
            <motion.circle
              key={deg} cx={138 + 52 * Math.cos(r)} cy={100 + 52 * Math.sin(r)} r="2.6" fill="#FFFFFF"
              initial={{ opacity: 0 }} animate={{ opacity: 0.95 }} transition={{ delay: 1 + deg / 600 }}
            />
          );
        })}
      </motion.g>
    </svg>
  );
}
BanglesArt.propTypes = { className: PropTypes.string };

function DiamondArt({ className = '' }) {
  const id = useId().replaceAll(':', '');
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <GoldDefs id={id} />
      <circle cx="100" cy="105" r="92" fill={`url(#${id}-glow)`} />
      {/* light rays */}
      <motion.g
        stroke="#F9E7A5" strokeOpacity="0.35" strokeWidth="1"
        animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '100px 105px' }}
      >
        {Array.from({ length: 12 }, (_, i) => i * 30).map((deg) => (
          <line key={deg} x1="100" y1="105" x2={100 + 92 * Math.cos((deg * Math.PI) / 180)} y2={105 + 92 * Math.sin((deg * Math.PI) / 180)} />
        ))}
      </motion.g>
      <motion.g initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, ease: EASE }} style={{ transformOrigin: '100px 105px' }}>
        <polygon points="70,58 130,58 160,84 40,84" fill={`url(#${id}-ice)`} stroke="#FFFFFF" strokeWidth="1.4" />
        <polygon points="40,84 160,84 100,166" fill={`url(#${id}-ice)`} stroke="#FFFFFF" strokeWidth="1.4" />
        <motion.path
          d="M70 58 L85 84 L100 58 L115 84 L130 58 M55 71 L70 58 M145 71 L130 58 M40 84 L100 166 L160 84 M70 84 L100 166 L130 84 M85 84 L100 166 L115 84"
          fill="none" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="0.9" {...draw(0.4)}
        />
      </motion.g>
    </svg>
  );
}
DiamondArt.propTypes = { className: PropTypes.string };

function IngotArt({ className = '' }) {
  const id = useId().replaceAll(':', '');
  return (
    <svg viewBox="0 0 220 200" className={className} aria-hidden="true">
      <GoldDefs id={id} />
      <circle cx="110" cy="105" r="95" fill={`url(#${id}-glow)`} />
      {/* back ingot */}
      <motion.g initial={{ opacity: 0, y: -12 }} animate={{ opacity: 0.75, y: 0 }} transition={{ duration: 0.9, ease: EASE }}>
        <polygon points="92,52 168,52 180,72 80,72" fill={`url(#${id}-goldsoft)`} />
        <polygon points="80,72 180,72 190,98 70,98" fill="#8A6018" />
      </motion.g>
      {/* front ingot */}
      <motion.g initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.25, ease: EASE }}>
        <polygon points="62,86 156,86 172,110 46,110" fill={`url(#${id}-gold)`} />
        <polygon points="46,110 172,110 184,146 34,146" fill={`url(#${id}-goldsoft)`} />
        <polygon points="46,110 172,110 184,146 34,146" fill="#000" fillOpacity="0.18" />
        <text x="109" y="104" textAnchor="middle" fontSize="11" fontWeight="700" fill="#5A3E0A" letterSpacing="2">999.9</text>
        <text x="109" y="132" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#3A2A08" fillOpacity="0.75" letterSpacing="3">FINE GOLD</text>
        <path d="M66 89 L152 89" stroke="#FFF7D6" strokeOpacity="0.8" strokeWidth="1.2" />
      </motion.g>
    </svg>
  );
}
IngotArt.propTypes = { className: PropTypes.string };

const ART = { ring: RingArt, necklace: NecklaceArt, bangles: BanglesArt, diamond: DiamondArt, ingot: IngotArt };

function ArtFrame({ art, numeral }) {
  const Art = ART[art];
  const reduce = useReducedMotion();
  return (
    <div className="relative aspect-square w-full max-w-[420px] mx-auto">
      {/* orbit rings */}
      <motion.div
        className="absolute inset-0 rounded-full border border-dashed border-gold-500/25"
        animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
      />
      <div className="absolute inset-6 rounded-full border border-gold-500/10" />
      <div className="absolute inset-12 rounded-full bg-[radial-gradient(circle_at_50%_40%,rgba(212,175,55,0.14),rgba(13,13,13,0)_70%)]" />
      {/* compass dots */}
      <span className="absolute left-1/2 top-0 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-gold-400" aria-hidden="true" />
      <span className="absolute left-1/2 bottom-0 w-2 h-2 -translate-x-1/2 translate-y-1/2 rotate-45 bg-gold-400" aria-hidden="true" />
      <span className="absolute top-1/2 left-0 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-gold-400/60" aria-hidden="true" />
      <span className="absolute top-1/2 right-0 w-2 h-2 translate-x-1/2 -translate-y-1/2 rotate-45 bg-gold-400/60" aria-hidden="true" />
      <span className={`absolute top-4 left-1/2 -translate-x-1/2 ${SERIF} text-gold-500/70 text-lg tracking-[0.3em]`}>{numeral}</span>
      <AnimatePresence mode="wait">
        <motion.div
          key={art}
          className="absolute inset-[14%]"
          initial={{ opacity: 0, scale: 0.85, rotate: -6, filter: 'blur(6px)' }}
          animate={{ opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 1.08, rotate: 6, filter: 'blur(6px)' }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <Art className="w-full h-full drop-shadow-[0_10px_40px_rgba(212,175,55,0.25)]" />
        </motion.div>
      </AnimatePresence>
      <Sparkle size={18} className="absolute top-[18%] right-[16%] text-gold-200" />
      <Sparkle size={12} className="absolute bottom-[22%] left-[14%] text-white" delay={1.1} />
      <Sparkle size={10} className="absolute top-[42%] left-[8%] text-gold-300" delay={2} />
    </div>
  );
}
ArtFrame.propTypes = { art: PropTypes.string.isRequired, numeral: PropTypes.string.isRequired };

function Ornament({ className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-gold-500/80" />
      <span className="w-1.5 h-1.5 rotate-45 bg-gold-400/60" />
      <span className="w-2.5 h-2.5 rotate-45 border border-gold-400 bg-gold-500/20 shadow-[0_0_12px_rgba(212,175,55,0.6)]" />
      <span className="w-1.5 h-1.5 rotate-45 bg-gold-400/60" />
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-gold-500/80" />
    </div>
  );
}
Ornament.propTypes = { className: PropTypes.string };

function FloatingDust() {
  const reduce = useReducedMotion();
  const dots = [
    { l: '8%', t: '22%', s: 3, d: 0 }, { l: '18%', t: '68%', s: 2, d: 1.2 }, { l: '30%', t: '12%', s: 2, d: 2.1 },
    { l: '72%', t: '18%', s: 3, d: 0.6 }, { l: '86%', t: '58%', s: 2, d: 1.8 }, { l: '62%', t: '80%', s: 3, d: 2.6 },
    { l: '46%', t: '35%', s: 2, d: 3.1 }, { l: '92%', t: '30%', s: 2, d: 0.3 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {dots.map((p) => (
        <motion.span
          key={p.l + p.t}
          className="absolute rounded-full bg-gold-300 shadow-[0_0_8px_rgba(242,201,76,0.9)]"
          style={{ left: p.l, top: p.t, width: p.s, height: p.s }}
          animate={reduce ? undefined : { y: [0, -18, 0], opacity: [0.2, 0.9, 0.2] }}
          transition={{ duration: 6, delay: p.d, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

function CountUp({ to, suffix = '', decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return undefined;
    const controls = animate(0, to, { duration: 1.8, ease: EASE, onUpdate: (v) => setVal(v) });
    return () => controls.stop();
  }, [inView, to]);
  return <span ref={ref}>{val.toFixed(decimals)}{suffix}</span>;
}
CountUp.propTypes = { to: PropTypes.number.isRequired, suffix: PropTypes.string, decimals: PropTypes.number };

// ─── Sections ─────────────────────────────────────────────────────────────────
function Hero() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y       = useTransform(scrollY, [0, 700], [0, 160]);
  const opacity = useTransform(scrollY, [0, 500], [1, 0]);
  const ringY   = useTransform(scrollY, [0, 700], [0, -90]);
  const neckY   = useTransform(scrollY, [0, 700], [0, -40]);

  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden">
      {/* backdrop */}
      <div className="absolute inset-0 bg-hero-gradient" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(40%_35%_at_50%_45%,rgba(212,175,55,0.16),transparent_70%)]" aria-hidden="true" />
      <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(#D4AF37_1px,transparent_1px)] [background-size:28px_28px]" aria-hidden="true" />
      <FloatingDust />

      {/* floating jewellery */}
      <motion.div style={{ y: ringY }} className="pointer-events-none absolute -left-10 top-[14%] w-36 md:w-64 opacity-25 md:opacity-80" aria-hidden="true">
        <motion.div animate={reduce ? undefined : { rotate: [-8, 4, -8], y: [0, -12, 0] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}>
          <RingArt className="w-full h-auto" />
        </motion.div>
      </motion.div>
      <motion.div style={{ y: neckY }} className="pointer-events-none absolute -right-8 bottom-[8%] w-44 md:w-80 opacity-25 md:opacity-75" aria-hidden="true">
        <motion.div animate={reduce ? undefined : { rotate: [4, -3, 4], y: [0, 10, 0] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}>
          <NecklaceArt className="w-full h-auto" />
        </motion.div>
      </motion.div>
      <div className="pointer-events-none absolute right-[14%] top-[16%] hidden md:block w-24 opacity-70" aria-hidden="true">
        <DiamondArt className="w-full h-auto" />
      </div>

      <motion.div style={{ y, opacity }} className="relative z-10 text-center px-4 max-w-3xl">
        <motion.p
          initial={{ opacity: 0, letterSpacing: '0.1em' }} animate={{ opacity: 1, letterSpacing: '0.45em' }} transition={{ duration: 1.4, ease: EASE }}
          className="font-jakarta text-[11px] sm:text-xs font-semibold text-gold-500 uppercase mb-6"
        >
          Our Heritage · Est. 2010
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 1.2, delay: 0.2, ease: EASE }}
          style={SCRIPT}
          className="text-gradient-gold text-[4.2rem] sm:text-[6rem] md:text-[7.5rem] leading-[1.1] pt-2 pb-3 font-normal"
        >
          Our Golden Story
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.6, ease: EASE }}
          className={`${SERIF} text-white/90 text-2xl sm:text-3xl tracking-[0.18em] uppercase`}
        >
          M.B. Jewellers
        </motion.p>
        <motion.div initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ duration: 1, delay: 0.9, ease: EASE }}>
          <Ornament className="mt-6" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.1 }}
          className={`${SERIF} italic text-dark-300 text-lg sm:text-xl mt-6 max-w-xl mx-auto leading-relaxed`}
        >
          Two families. Three generations of craft. One promise — jewellery that outlives the moment.
        </motion.p>
      </motion.div>

      {/* scroll cue */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-dark-400"
        aria-hidden="true"
      >
        <span className="font-jakarta text-[10px] uppercase tracking-[0.35em]">Scroll the story</span>
        <span className="relative w-px h-12 bg-white/10 overflow-hidden">
          <motion.span
            className="absolute left-0 top-0 w-px h-5 bg-gold-400"
            animate={reduce ? undefined : { y: [-20, 48] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
        </span>
      </motion.div>
    </section>
  );
}

function MarqueeBand() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const x1 = useTransform(scrollYProgress, [0, 1], ['0%', '-25%']);
  const x2 = useTransform(scrollYProgress, [0, 1], ['-25%', '0%']);
  const words = ['Gold', 'Diamond', 'Heritage', 'Bangles', 'Necklaces', 'Rings', 'Craft', 'Silver'];
  const row = [...words, ...words, ...words];
  return (
    <section ref={ref} className="relative py-10 sm:py-14 overflow-hidden border-y border-gold-500/10 bg-dark-950" aria-hidden="true">
      <motion.div style={{ x: x1 }} className={`flex gap-10 whitespace-nowrap ${SERIF} text-4xl sm:text-6xl font-semibold`}>
        {row.map((w, i) => (
          <span key={`a${i}`} className="flex items-center gap-10">
            <span className={i % 2 ? 'text-white/[0.08]' : 'text-gradient-gold opacity-70'}>{w}</span>
            <span className="w-2 h-2 rotate-45 bg-gold-500/40" />
          </span>
        ))}
      </motion.div>
      <motion.div style={{ x: x2 }} className="flex gap-10 whitespace-nowrap mt-4 text-3xl sm:text-5xl" >
        {row.map((w, i) => (
          <span key={`b${i}`} style={SCRIPT} className="text-gold-500/25">{w} ✦</span>
        ))}
      </motion.div>
    </section>
  );
}

function StoryScroller() {
  const ref = useRef(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start center', 'end center'] });
  const railScale = useTransform(scrollYProgress, [0, 1], [0, 1]);
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const idx = Math.min(chapters.length - 1, Math.max(0, Math.floor(v * chapters.length)));
    setActive(idx);
  });
  const ch = chapters[active];

  return (
    <section ref={ref} className="relative py-24 sm:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(50%_40%_at_25%_50%,rgba(212,175,55,0.06),transparent_70%)]" aria-hidden="true" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 sm:mb-24">
          <p className="font-jakarta text-[11px] font-semibold tracking-[0.4em] text-gold-500 uppercase mb-4">The Journey</p>
          <h2 className={`${SERIF} text-white text-4xl sm:text-6xl font-semibold leading-tight pt-0`}>
            From Gold to <span style={SCRIPT} className="text-gradient-gold font-normal text-5xl sm:text-7xl px-1">Heirloom</span>
          </h2>
          <Ornament className="mt-6" />
        </div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-20">
          {/* Sticky visual (desktop) */}
          <div className="hidden lg:block">
            <div className="sticky top-28">
              <ArtFrame art={ch.art} numeral={ch.numeral} />
              <AnimatePresence mode="wait">
                <motion.p
                  key={ch.key}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4 }}
                  className={`${SERIF} italic text-center text-dark-300 text-lg mt-6`}
                >
                  {ch.caption}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* Chapters */}
          <div className="relative">
            {/* progress rail */}
            <div className="absolute left-0 top-2 bottom-2 w-px bg-white/10 hidden sm:block" aria-hidden="true">
              <motion.div style={{ scaleY: railScale }} className="origin-top w-px h-full bg-gradient-to-b from-gold-300 via-gold-500 to-gold-700" />
            </div>
            {chapters.map((c, i) => (
              <motion.article
                key={c.key}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false, margin: '-30% 0px -30% 0px' }}
                transition={{ duration: 0.8, ease: EASE }}
                className="relative sm:pl-12 lg:min-h-[78vh] flex flex-col justify-center py-10 lg:py-0"
              >
                {/* rail node */}
                <span
                  className={`hidden sm:flex absolute -left-[9px] top-1/2 -translate-y-1/2 w-[19px] h-[19px] rotate-45 items-center justify-center border transition-all duration-500 ${
                    i <= active ? 'border-gold-400 bg-gold-500/30 shadow-[0_0_14px_rgba(212,175,55,0.7)]' : 'border-white/20 bg-dark-900'
                  }`}
                  aria-hidden="true"
                >
                  <span className={`w-1.5 h-1.5 ${i <= active ? 'bg-gold-300' : 'bg-white/20'}`} />
                </span>

                {/* mobile illustration */}
                <div className="lg:hidden w-56 sm:w-64 mx-auto mb-8">
                  <ArtFrame art={c.art} numeral={c.numeral} />
                </div>

                <div className="flex items-baseline gap-4 mb-4">
                  <span className={`${SERIF} text-6xl sm:text-7xl font-semibold text-gold-500/15 leading-none`}>{c.numeral}</span>
                  <span className="font-jakarta text-[11px] font-semibold tracking-[0.35em] text-gold-500 uppercase">{c.eyebrow}</span>
                </div>
                <h3 className={`${SERIF} text-white text-3xl sm:text-5xl font-semibold leading-[1.1] mb-6`}>{c.title}</h3>
                <p className="font-jakarta text-dark-300 text-base sm:text-lg leading-relaxed max-w-xl">{c.text}</p>
                <p className={`${SERIF} italic text-gold-400/80 text-lg mt-5 lg:hidden`}>{c.caption}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  return (
    <section className="relative py-20 sm:py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-dark-950 via-[#120d05] to-dark-950" aria-hidden="true" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] opacity-[0.06] pointer-events-none" aria-hidden="true">
        <BanglesArt className="w-full h-full" />
      </div>
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 0.7, ease: EASE }}
              className="relative text-center px-4 py-8 sm:py-10 rounded-[28px] border border-gold-500/15 bg-gradient-to-b from-gold-500/[0.06] to-transparent"
            >
              <span className="absolute top-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 bg-gold-400/70" aria-hidden="true" />
              <p className={`${SERIF} text-gradient-gold text-5xl sm:text-6xl font-semibold leading-none`}>
                <CountUp to={s.to} suffix={s.suffix} decimals={s.decimals || 0} />
              </p>
              <p className="font-jakarta text-dark-300 text-[11px] sm:text-xs uppercase tracking-[0.22em] mt-4">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CollectionShowcase() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y1 = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const y2 = useTransform(scrollYProgress, [0, 1], [-40, 40]);
  const items = [
    { art: RingArt,     name: 'Rings',     note: 'Solitaires & bands',   y: y1 },
    { art: NecklaceArt, name: 'Necklaces', note: 'Heritage & modern',    y: y2 },
    { art: BanglesArt,  name: 'Bangles',   note: 'Gold, hand-engraved',  y: y1 },
    { art: DiamondArt,  name: 'Diamonds',  note: 'Certified brilliance', y: y2 },
  ];
  return (
    <section ref={ref} className="relative py-24 sm:py-32 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14 sm:mb-20">
          <p className="font-jakarta text-[11px] font-semibold tracking-[0.4em] text-gold-500 uppercase mb-4">What We Create</p>
          <h2 className={`${SERIF} text-white text-4xl sm:text-6xl font-semibold leading-tight pt-0`}>
            Made to be <span style={SCRIPT} className="text-gradient-gold font-normal text-5xl sm:text-7xl px-1">Treasured</span>
          </h2>
          <Ornament className="mt-6" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {items.map((item, i) => {
            const { name, note, y } = item;
            const ItemArt = item.art;
            return (
            <motion.div key={name} style={{ y }} className="relative">
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.8, delay: i * 0.1, ease: EASE }}
                className="relative overflow-hidden rounded-t-[999px] rounded-b-3xl border border-gold-500/15 bg-gradient-to-b from-[#1a140a] via-dark-800 to-dark-900 px-5 pt-10 pb-7 text-center"
              >
                <span className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" aria-hidden="true" />
                <div className="aspect-square w-full max-w-[180px] mx-auto">
                  <ItemArt className="w-full h-full drop-shadow-[0_10px_30px_rgba(212,175,55,0.25)]" />
                </div>
                <h3 className={`${SERIF} text-white text-2xl sm:text-3xl font-semibold mt-4`}>{name}</h3>
                <p className="font-jakarta text-dark-400 text-xs uppercase tracking-[0.2em] mt-1.5">{note}</p>
              </motion.div>
            </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ValuesSection() {
  return (
    <section className="relative py-24 sm:py-28 bg-dark-950 border-y border-gold-500/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="font-jakarta text-[11px] font-semibold tracking-[0.4em] text-gold-500 uppercase mb-4">What Drives Us</p>
          <h2 className={`${SERIF} text-white text-4xl sm:text-5xl font-semibold leading-tight pt-0`}>Our Values</h2>
          <Ornament className="mt-6" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {values.map((v, i) => {
            const VIcon = v.icon;
            return (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12, duration: 0.7, ease: EASE }}
                className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-dark-800 to-dark-900 p-7 text-center"
              >
                <span className={`absolute -right-3 -top-6 ${SERIF} text-[7rem] leading-none font-semibold text-gold-500/[0.05]`} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <div className="relative mx-auto mb-6 w-14 h-14 rotate-45 rounded-xl border border-gold-500/40 bg-gold-500/[0.08] flex items-center justify-center shadow-[0_0_24px_rgba(212,175,55,0.15)]">
                  <VIcon size={20} className="-rotate-45 text-gold-400" />
                </div>
                <h3 className={`${SERIF} text-white text-2xl font-semibold mb-3`}>{v.title}</h3>
                <p className="font-jakarta text-dark-400 text-sm leading-relaxed">{v.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PromiseQuote() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.9, 1, 0.95]);
  const rotate = useTransform(scrollYProgress, [0, 1], [-20, 20]);
  return (
    <section ref={ref} className="relative py-28 sm:py-36 overflow-hidden">
      <motion.div style={{ rotate }} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] sm:w-[640px] opacity-[0.08]" aria-hidden="true">
        <RingArt className="w-full h-auto" />
      </motion.div>
      <motion.div style={{ scale }} className="relative max-w-4xl mx-auto px-4 text-center">
        <span className={`${SERIF} block text-gold-500/40 text-8xl leading-none h-12`} aria-hidden="true">&ldquo;</span>
        <p style={SCRIPT} className="text-gradient-gold text-5xl sm:text-7xl leading-[1.25] py-2">
          Jewellery is a story you wear — we simply help you tell it.
        </p>
        <Ornament className="mt-8" />
        <p className="font-jakarta text-dark-400 text-xs uppercase tracking-[0.35em] mt-6">Our Promise</p>
      </motion.div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="relative pb-28 pt-6">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE }}
          className="relative overflow-hidden rounded-[36px] border border-gold-500/20 bg-gradient-to-br from-[#1d160a] via-dark-800 to-dark-900 px-6 sm:px-14 py-14 sm:py-16 text-center"
        >
          <div className="pointer-events-none absolute -left-10 -bottom-10 w-48 opacity-30" aria-hidden="true"><BanglesArt className="w-full h-auto" /></div>
          <div className="pointer-events-none absolute -right-6 -top-8 w-40 opacity-30" aria-hidden="true"><DiamondArt className="w-full h-auto" /></div>
          <span className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" aria-hidden="true" />
          <p className="relative font-jakarta text-[11px] font-semibold tracking-[0.4em] text-gold-500 uppercase mb-4">Begin Your Chapter</p>
          <h2 className={`relative ${SERIF} text-white text-4xl sm:text-5xl font-semibold leading-tight pt-0`}>
            Ready to Find Your <span style={SCRIPT} className="text-gradient-gold font-normal text-5xl sm:text-6xl px-1">Perfect Piece?</span>
          </h2>
          <p className="relative font-jakarta text-dark-300 mt-4 mb-9 max-w-lg mx-auto">Explore our curated collection of fine jewelry — or design something that is yours alone.</p>
          <div className="relative flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/shop" className="btn-gold text-base py-3.5 px-8 inline-flex items-center gap-2">
              Shop Our Collection <FiArrowRight size={16} />
            </Link>
            <Link to="/custom-order" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full border border-gold-500/40 text-gold-300 hover:bg-gold-500/10 transition-colors font-jakarta text-base">
              Design Custom Jewellery
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function About() {
  useScriptFont();
  useEffect(() => { document.title = 'About Us — M.B. JEWELLERS'; }, []);

  return (
    <div className="min-h-screen pt-16 bg-dark-900 overflow-x-clip">
      <Hero />
      <MarqueeBand />
      <StoryScroller />
      <StatsSection />
      <CollectionShowcase />
      <ValuesSection />
      <PromiseQuote />
      <ClosingCta />
    </div>
  );
}
