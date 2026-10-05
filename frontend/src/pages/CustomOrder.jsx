import { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUpload, FiX, FiChevronRight, FiChevronLeft,
  FiMapPin, FiCheckCircle, FiInfo, FiCheck, FiEdit3, FiImage, FiSend,
  FiClock, FiCreditCard, FiPackage, FiFileText, FiTruck, FiPlus, FiShield, FiFeather,
} from 'react-icons/fi';
import { selectUser } from '../store/authSlice';
import { customOrderService, userService, orderService } from '../services/services';
import { formatDate, BLANK_ADDRESS, REQUIRED_ADDR_FIELDS } from '../utils/helpers';
import toast from 'react-hot-toast';
import AddressSelector from '../components/common/AddressSelector';

// ─── Config ───────────────────────────────────────────────────────────────────
const JEWELRY_TYPES = ['Ring', 'Necklace', 'Earrings', 'Bracelet', 'Pendant', 'Anklet', 'Bangle', 'Bala'];
const MATERIALS     = ['Gold', 'Silver', 'Diamond'];
// ── Diamond disabled: hide from customer material picker until certification is obtained ──
const CUSTOMER_MATERIALS = MATERIALS.filter(m => m !== 'Diamond');
const PURITY_MAP    = {
  Gold:    ['22K', '18K'],
  Silver:  ['Hallmark', 'Normal'],
  Diamond: ['22K', '18K', '14K'],
};

// Metal swatch for the material tiles (visual only)
const METAL_SWATCH = {
  Gold:   'bg-gold-gradient',
  Silver: 'bg-[linear-gradient(135deg,#f4f4f5_0%,#a1a1aa_45%,#e4e4e7_70%,#71717a_100%)]',
};

// Things worth mentioning in the description (display-only tips)
const DESCRIPTION_TIPS = ['Occasion', 'Style & shape', 'Engraving', 'Stones', 'Finish (matte / polished)', 'Who it is for'];

// What happens after the request is sent
const JOURNEY = [
  { icon: FiSend,       title: 'Send your request',   text: 'No payment is taken today' },
  { icon: FiFileText,   title: 'Receive your quote',  text: 'Within 24–48 hours — price, GST & shipping for your PIN' },
  { icon: FiCreditCard, title: 'Accept & pay advance', text: 'Our artisans begin crafting your piece' },
  { icon: FiPackage,    title: 'Crafted & delivered', text: 'Follow every stage on your Custom Orders page' },
];

// ─── Ornament ─────────────────────────────────────────────────────────────────
function GoldOrnament({ className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-gold-500/70" />
      <span className="w-1.5 h-1.5 rotate-45 bg-gold-400 shadow-[0_0_10px_rgba(212,175,55,0.7)]" />
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-gold-500/70" />
    </div>
  );
}

GoldOrnament.propTypes = { className: PropTypes.string };

// ─── Line-art glyph per jewellery type ────────────────────────────────────────
const GLYPHS = {
  ring: (
    <>
      <circle cx="24" cy="30" r="11" />
      <circle cx="24" cy="30" r="8" strokeOpacity="0.45" />
      <path d="M19 12 h10 l3.5 4.5 -8.5 7 -8.5 -7 z" />
      <path d="M15.5 16.5 h17 M21 12 l3 11.5 3 -11.5" strokeOpacity="0.45" />
    </>
  ),
  necklace: (
    <>
      <path d="M8 9 Q24 38 40 9" />
      <path d="M12.5 10 Q24 32 35.5 10" strokeOpacity="0.45" />
      <path d="M24 31 l-3.5 4.5 3.5 6.5 3.5 -6.5 z" />
    </>
  ),
  earrings: (
    <>
      <path d="M15 8 a3 3 0 1 1 0 5 v6" />
      <path d="M15 19 l-4.5 6.5 4.5 7.5 4.5 -7.5 z" />
      <path d="M33 8 a3 3 0 1 1 0 5 v6" />
      <path d="M33 19 l-4.5 6.5 4.5 7.5 4.5 -7.5 z" />
    </>
  ),
  bracelet: (
    <>
      <ellipse cx="24" cy="26" rx="16" ry="10" />
      <circle cx="8.6" cy="23.5" r="1.8" />
      <circle cx="14" cy="17.6" r="1.8" />
      <circle cx="24" cy="16" r="1.8" />
      <circle cx="34" cy="17.6" r="1.8" />
      <circle cx="39.4" cy="23.5" r="1.8" />
    </>
  ),
  pendant: (
    <>
      <path d="M13 7 L24 19 L35 7" strokeOpacity="0.55" />
      <circle cx="24" cy="21" r="1.6" />
      <path d="M24 23.5 C17.5 29 17.5 37 24 42 C30.5 37 30.5 29 24 23.5 Z" />
      <path d="M24 23.5 V42" strokeOpacity="0.45" />
    </>
  ),
  anklet: (
    <>
      <ellipse cx="24" cy="20" rx="17" ry="8" />
      <path d="M15 27 v4 M24 28 v4 M33 27 v4" strokeOpacity="0.6" />
      <circle cx="15" cy="33.5" r="2.2" />
      <path d="M24 32 l-2.2 3 2.2 3.5 2.2 -3.5 z" />
      <circle cx="33" cy="33.5" r="2.2" />
    </>
  ),
  bangle: (
    <>
      <ellipse cx="24" cy="26" rx="16" ry="12" />
      <ellipse cx="24" cy="26" rx="12.5" ry="8.8" strokeOpacity="0.45" />
      <path d="M24 11 l2.5 2.5 -2.5 2.5 -2.5 -2.5 z" />
    </>
  ),
  bala: (
    <>
      <ellipse cx="24" cy="25" rx="17" ry="12.5" />
      <ellipse cx="24" cy="25" rx="11" ry="7.2" />
      <path d="M8.5 21 l3.5 1.2 M39.5 21 l-3.5 1.2 M12 32.5 l3 -2.2 M36 32.5 l-3 -2.2 M24 13 v4 M24 33 v4" strokeOpacity="0.55" />
    </>
  ),
};

function TypeGlyph({ type, className = 'w-9 h-9' }) {
  const art = GLYPHS[String(type || '').toLowerCase()] || GLYPHS.ring;
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {art}
    </svg>
  );
}

TypeGlyph.propTypes = { type: PropTypes.string, className: PropTypes.string };

// ─── Stepper ──────────────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Design',   hint: 'Piece, metal & idea',  icon: FiEdit3 },
  { label: 'Images',   hint: 'References · optional', icon: FiImage },
  { label: 'Delivery', hint: 'Where to send it',      icon: FiMapPin },
  { label: 'Review',   hint: 'Check & submit',        icon: FiCheckCircle },
];

function Stepper({ current, onJump }) {
  const pct = (current / (STEPS.length - 1)) * 100;
  return (
    <nav aria-label="Request progress" className="relative mx-auto max-w-2xl">
      <div className="absolute left-[12.5%] right-[12.5%] top-5 h-[2px] rounded-full bg-white/[0.07]" aria-hidden="true">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-gold-600 via-gold-400 to-gold-300 shadow-[0_0_12px_rgba(212,175,55,0.55)]"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        />
      </div>
      <ol className="relative grid grid-cols-4">
        {STEPS.map((s, i) => {
          const done   = i < current;
          const active = i === current;
          const Icon   = s.icon;
          let tone = 'bg-dark-900 border-white/10 text-dark-500 cursor-default';
          if (done) tone = 'bg-gold-gradient border-transparent text-dark-900 shadow-gold hover:scale-105 cursor-pointer';
          else if (active) tone = 'bg-dark-900 border-gold-400 text-gold-300 shadow-[0_0_0_5px_rgba(212,175,55,0.12)]';
          return (
            <li key={s.label} className="flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => done && onJump(i)}
                disabled={!done}
                aria-current={active ? 'step' : undefined}
                aria-label={done ? `Back to ${s.label}` : s.label}
                className={`relative w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-300 ${tone}`}
              >
                {done ? <FiCheck size={16} strokeWidth={3} /> : <Icon size={16} />}
              </button>
              <span className={`mt-2 font-jakarta text-[11px] sm:text-xs font-semibold tracking-wide ${active ? 'text-gold-300' : done ? 'text-dark-200' : 'text-dark-500'}`}>
                {s.label}
              </span>
              <span className="hidden sm:block font-jakarta text-[11px] text-dark-500 mt-0.5">{s.hint}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

Stepper.propTypes = {
  current: PropTypes.number.isRequired,
  onJump: PropTypes.func.isRequired,
};

// ─── Building blocks ──────────────────────────────────────────────────────────
function StepCard({ icon, eyebrow, title, sub, badge, children }) {
  const Icon = icon;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-b from-dark-800 to-dark-800/70 shadow-card">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
      <span className="pointer-events-none absolute -right-20 -top-24 w-60 h-60 rounded-full bg-gold-500/[0.07] blur-3xl" />
      <header className="relative flex items-start gap-3.5 px-5 sm:px-7 pt-5 sm:pt-6 pb-4 border-b border-white/[0.06]">
        <span className="w-11 h-11 shrink-0 rounded-2xl bg-gold-500/10 border border-gold-500/25 flex items-center justify-center text-gold-300">
          <Icon size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-jakarta text-[10px] font-semibold tracking-[0.25em] uppercase text-gold-500/90">{eyebrow}</p>
          <h3 className="font-serif text-xl sm:text-2xl text-white mt-0.5">{title}</h3>
          {sub && <p className="text-dark-400 text-sm mt-1 leading-relaxed">{sub}</p>}
        </div>
        {badge}
      </header>
      <div className="relative p-5 sm:p-7">{children}</div>
    </div>
  );
}

StepCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  eyebrow: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  sub: PropTypes.node,
  badge: PropTypes.node,
  children: PropTypes.node.isRequired,
};

function FieldGroup({ n, title, hint, optional = false, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-6 h-6 shrink-0 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-300 text-[11px] font-bold font-jakarta flex items-center justify-center">{n}</span>
          <h4 className="font-jakarta text-sm font-semibold text-white">
            {title}{!optional && <span className="text-gold-500 ml-0.5" aria-hidden="true">*</span>}
          </h4>
        </div>
        {optional && <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-dark-400">Optional</span>}
      </div>
      {hint && <p className="text-xs text-dark-500 -mt-1 sm:pl-[34px]">{hint}</p>}
      {children}
    </section>
  );
}

FieldGroup.propTypes = {
  n: PropTypes.number.isRequired,
  title: PropTypes.string.isRequired,
  hint: PropTypes.node,
  optional: PropTypes.bool,
  children: PropTypes.node.isRequired,
};

// ─── Option Button (purity) ───────────────────────────────────────────────────
function OptionBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 cursor-pointer
        ${active
          ? 'bg-gold-500/15 border-gold-500 text-gold-300 shadow-gold'
          : 'border-white/10 bg-dark-900/40 text-dark-300 hover:border-white/30 hover:text-white'
        }`}
    >
      {active && <FiCheck size={13} strokeWidth={3} />}
      {children}
    </button>
  );
}

OptionBtn.propTypes = {
  active: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

function TickBadge() {
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 24 }}
      className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gold-500 text-dark-900 flex items-center justify-center shadow-gold"
    >
      <FiCheck size={11} strokeWidth={3.5} />
    </motion.span>
  );
}

function JourneyList({ compact = false }) {
  return (
    <ol className="relative space-y-4">
      <span className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-gold-500/50 via-white/10 to-transparent" aria-hidden="true" />
      {JOURNEY.map(({ icon, title, text }, i) => {
        const Icon = icon;
        return (
        <li key={title} className="relative flex gap-3">
          <span className={`relative z-10 w-8 h-8 shrink-0 rounded-full flex items-center justify-center border ${i === 0 ? 'bg-gold-500/15 border-gold-500/50 text-gold-300' : 'bg-dark-900 border-white/10 text-dark-400'}`}>
            <Icon size={14} />
          </span>
          <div className="min-w-0 pt-1">
            <p className={`font-jakarta font-semibold text-white ${compact ? 'text-[13px]' : 'text-sm'}`}>{title}</p>
            <p className="text-xs text-dark-400 leading-relaxed mt-0.5">{text}</p>
          </div>
        </li>
        );
      })}
    </ol>
  );
}

JourneyList.propTypes = { compact: PropTypes.bool };

function ReviewSection({ title, onEdit, children }) {
  return (
    <section className="py-5 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h4 className="font-jakarta text-[11px] font-semibold uppercase tracking-[0.2em] text-dark-400">{title}</h4>
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gold-400 hover:text-gold-300 hover:bg-gold-500/10 transition-colors">
          <FiEdit3 size={12} /> Edit
        </button>
      </div>
      {children}
    </section>
  );
}

ReviewSection.propTypes = {
  title: PropTypes.string.isRequired,
  onEdit: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CustomOrder() {
  const navigate = useNavigate();
  const user     = useSelector(selectUser);

  const [step, setStep]   = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [sizeUnit, setSizeUnit] = useState('cm');

  // helpers

// Step 1: Design
  const [form, setForm] = useState({
    type: '', material: '', purity: 'None',
    description: '', fingerSize: '', neckSize: '',
    wristSize: '', weight: '',
  });

  // Step 2: Images
  const [images, setImages]       = useState([]); // File objects
  const [previews, setPreviews]   = useState([]);  // base64 data URLs
  const fileInputRef              = useRef(null);

  // Step 3: Delivery
  const [addresses,      setAddresses]      = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState(null);
  const [showNewAddr,    setShowNewAddr]    = useState(false);
  const [newAddr,        setNewAddr]        = useState({ ...BLANK_ADDRESS, fullName: user?.name || '' });
  const [addrLoading,    setAddrLoading]    = useState(false);
  const [preferredDate,  setPreferredDate]  = useState('');

  useEffect(() => {
    document.title = 'Custom Jewelry — M.B. JEWELLERS';
  }, []);

  // Load saved addresses when reaching step 2
  useEffect(() => {
    if (step === 2 && addresses.length === 0) {
      setAddrLoading(true);
      userService.getProfile()
        .then((res) => {
          const addrs = res.data.user?.addresses || [];
          setAddresses(addrs);
          const def = addrs.find((a) => a.isDefault) ?? addrs[0];
          if (def) setSelectedAddrId(def._id);
          else setShowNewAddr(true);
        })
        .catch(() => setShowNewAddr(true))
        .finally(() => setAddrLoading(false));
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Image handling ──────────────────────────────────────────────────────────
  const handleFileAdd = (files) => {
    const remaining = 4 - images.length;
    if (remaining <= 0) { toast.error('Maximum 4 reference images allowed'); return; }
    const toAdd = Array.from(files).slice(0, remaining);
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const valid = toAdd.filter((f) => {
      if (!validTypes.includes(f.type)) { toast.error(`${f.name}: only JPEG/PNG/WebP allowed`); return false; }
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name}: max 10MB per image`); return false; }
      return true;
    });
    setImages((p) => [...p, ...valid]);
    valid.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => setPreviews((p) => [...p, e.target.result]);
      reader.readAsDataURL(f);
    });
  };

  const removeImage = (idx) => {
    setImages((p)   => p.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFileAdd(e.dataTransfer.files);
  };

  // ── Address helpers ─────────────────────────────────────────────────────────
  const getSelectedAddress = useCallback(() => {
    if (showNewAddr) return newAddr;
    return addresses.find((a) => a._id === selectedAddrId) ?? null;
  }, [showNewAddr, newAddr, addresses, selectedAddrId]);

  // Delivery areas + shipping charge per PIN — the same list shop checkout uses (server: utils/shippingRates.js)
  const [zones, setZones] = useState(null);
  useEffect(() => {
    orderService.getShippingZones().then((r) => setZones(r.data.zones || [])).catch(() => setZones(null));
  }, []);
  const zoneFor = (pin) => zones?.find((z) => z.pincode === String(pin || '').replaceAll(/\s+/g, '')) || null;

  const validateAddress = useCallback((addr) => {
    for (const f of REQUIRED_ADDR_FIELDS) {
      if (!addr[f]?.trim()) {
        toast.error(`Please fill in: ${f.replaceAll(/([A-Z])/g, ' $1').toLowerCase()}`);
        return false;
      }
    }
    if (!/^\d{6}$/.test(addr.pincode)) { toast.error('PIN code must be 6 digits'); return false; }
    if (zones?.length && !zones.some((z) => z.pincode === String(addr.pincode).trim())) {
      toast.error(`Sorry, we do not deliver to PIN ${addr.pincode} yet. We deliver to: ${zones.map((z) => `${z.area} (${z.pincode})`).join(', ')}`, { duration: 6000 });
      return false;
    }
    if (!/^[6-9]\d{9}$/.test(addr.phone.replaceAll(/\s/g, ''))) {
      toast.error('Please enter a valid 10-digit Indian mobile number'); return false;
    }
    return true;
  }, [zones]);

  // ── Step validation ─────────────────────────────────────────────────────────

  const goNext = () => {
    if (step === 0) {
      if (!form.type)     { toast.error('Please select a jewelry type'); return; }
      if (!form.material) { toast.error('Please select a material'); return; }
      if (form.description.trim().length < 20) { toast.error('Please write a description (at least 20 characters)'); return; }
    }
    if (step === 2) {
      const addr = getSelectedAddress();
      if (!addr) { toast.error('Please select or add a delivery address'); return; }
      if (!validateAddress(addr)) return;
    }
    setStep((s) => s + 1);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const addr = getSelectedAddress();
    if (!addr || !validateAddress(addr)) return;

    setSubmitting(true);
    try {
      const fd = new FormData();
      // Fields — sizes are sent WITH their unit so the workshop knows what the number means
      const SIZE_FIELDS = ['fingerSize', 'neckSize', 'wristSize'];
      Object.entries(form).forEach(([k, v]) => {
        if (!v) return;
        fd.append(k, SIZE_FIELDS.includes(k) ? `${v} ${sizeUnit}` : v);
      });
      // Shipping address
      Object.entries(addr).forEach(([k, v]) => fd.append(`shippingAddress[${k}]`, v));
      if (preferredDate) fd.append('preferredDeliveryDate', preferredDate);
      // Images
      images.forEach((img) => fd.append('referenceImages', img));

      await customOrderService.create(fd);
      toast.success('Custom order submitted! We\'ll send you a quote within 24–48 hours. 💎', { duration: 6000 });
      navigate('/custom-orders');
    } catch (err) {
      toast.error(
        err.response?.data?.message
          || (err.response ? 'Failed to submit. Please try again.' : 'Could not reach the server. Please check your connection and try again.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Helpers to replace nested ternaries ─────────────────────────────────────
  const getSizeLabel = () => {
    if (form.type === 'Ring') return 'Finger Size';
    if (form.type === 'Necklace' || form.type === 'Pendant') return 'Neck Size';
    return 'Size';
  };

  const getSizeValue = () => {
    if (form.type === 'Ring') return form.fingerSize;
    if (form.type === 'Necklace' || form.type === 'Pendant') return form.neckSize;
    return form.wristSize;
  };

  // Convert through millimetres so every pair (cm / inch / mm) is correct
  const MM_PER_UNIT = { mm: 1, cm: 10, inch: 25.4 };
  const convertSize = (val, fromUnit, toUnit) => {
    const n = Number.parseFloat(val);
    if (!val || Number.isNaN(n) || fromUnit === toUnit) return val;
    return String(Number(((n * MM_PER_UNIT[fromUnit]) / MM_PER_UNIT[toUnit]).toFixed(2)));
  };

  const handleSizeUnitChange = (e) => {
    const next = e.target.value;
    setForm((f) => ({
      ...f,
      wristSize:  convertSize(f.wristSize, sizeUnit, next),
      neckSize:   convertSize(f.neckSize, sizeUnit, next),
      fingerSize: convertSize(f.fingerSize, sizeUnit, next),
    }));
    setSizeUnit(next);
  };

  const handleSizeChange = (e) => {
    const v = e.target.value;
    if (form.type === 'Ring') setForm((f) => ({ ...f, fingerSize: v }));
    else if (form.type === 'Necklace' || form.type === 'Pendant') setForm((f) => ({ ...f, neckSize: v }));
    else setForm((f) => ({ ...f, wristSize: v }));
  };

  // ── Render Steps ────────────────────────────────────────────────────────────
  const addr = getSelectedAddress();

  // UI-only state / derived values
  const [dragOver, setDragOver] = useState(false);
  const stepperRef = useRef(null);
  const firstStepRender = useRef(true);
  useEffect(() => {
    // Bring the stepper back into view when moving between steps (long forms on phones)
    if (firstStepRender.current) { firstStepRender.current = false; return; }
    const el = stepperRef.current;
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 96;
    if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }, [step]);

  const descLen      = form.description.trim().length;
  const descOk       = descLen >= 20;
  const requiredDone = [form.type, form.material, descOk].filter(Boolean).length;
  const purityLabel  = form.purity && form.purity !== 'None' ? form.purity : '';
  const pickedZone   = addr ? zoneFor(addr.pincode) : null;
  const openPicker   = () => { if (images.length < 4) fileInputRef.current?.click(); };

  const stepMotion = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.28, ease: 'easeOut' } };

  const renderDesign = () => (
    <motion.div key="step0" {...stepMotion}>
      <StepCard icon={FiEdit3} eyebrow="Step 1 of 4" title="Design details" sub="Tell us what you'd like us to craft. Fields marked * are required.">
        <div className="space-y-8">
          {/* 1 · Piece */}
          <FieldGroup n={1} title="Choose your piece">
            <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
              {JEWELRY_TYPES.map((t) => {
                const active = form.type === t;
                return (
                  <motion.button
                    key={t}
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    aria-pressed={active}
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`relative flex flex-col items-center justify-center gap-1.5 sm:gap-2 rounded-2xl border px-1 py-3 sm:px-2 sm:py-4 transition-colors duration-200 ${
                      active
                        ? 'border-gold-500 bg-gold-500/[0.09] text-gold-300 shadow-[0_0_0_1px_rgba(212,175,55,0.25),0_8px_24px_-12px_rgba(212,175,55,0.5)]'
                        : 'border-white/[0.08] bg-dark-900/40 text-dark-300 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {active && <TickBadge />}
                    <TypeGlyph type={t} className={`w-8 h-8 sm:w-10 sm:h-10 ${active ? 'text-gold-300' : 'text-dark-400'}`} />
                    <span className="font-jakarta text-[11px] sm:text-[13px] font-semibold">{t}</span>
                  </motion.button>
                );
              })}
            </div>
          </FieldGroup>

          {/* 2 · Metal + purity */}
          <FieldGroup n={2} title="Pick the metal">
            <div className="grid grid-cols-2 gap-2.5">
              {CUSTOMER_MATERIALS.map((m) => {
                const active = form.material === m;
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setForm((f) => ({ ...f, material: m, purity: 'None' }))}
                    className={`relative flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 ${
                      active
                        ? 'border-gold-500 bg-gold-500/[0.09] shadow-[0_0_0_1px_rgba(212,175,55,0.25)]'
                        : 'border-white/[0.08] bg-dark-900/40 hover:border-white/25'
                    }`}
                  >
                    {active && <TickBadge />}
                    <span className={`w-10 h-10 shrink-0 rounded-full ring-2 ring-white/10 shadow-inner ${METAL_SWATCH[m] || 'bg-dark-600'}`} />
                    <span className="min-w-0">
                      <span className={`block font-jakarta text-sm font-semibold ${active ? 'text-gold-200' : 'text-white'}`}>{m}</span>
                      <span className="block text-[11px] text-dark-400 mt-0.5">{(PURITY_MAP[m] || []).join(' · ')}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence initial={false}>
              {form.material && PURITY_MAP[form.material] && (
                <motion.div
                  key={form.material}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-1 rounded-2xl border border-white/[0.06] bg-dark-900/40 p-3.5">
                    <p className="text-xs text-dark-400 mb-2.5">
                      {form.material} purity <span className="text-dark-500">· optional — leave unselected if unsure</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {PURITY_MAP[form.material].map((p) => (
                        <OptionBtn key={p} active={form.purity === p} onClick={() => setForm((f) => ({ ...f, purity: p }))}>
                          {p}
                        </OptionBtn>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </FieldGroup>

          {/* 3 · Measurements */}
          <FieldGroup n={3} title="Size & weight" optional hint="Leave blank if you're not sure — we'll confirm with you.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="label-dark mb-0" htmlFor="co-size">{getSizeLabel()}</label>
                  <div className="inline-flex rounded-lg border border-white/10 bg-dark-900 p-0.5" role="group" aria-label="Size unit">
                    {['cm', 'inch', 'mm'].map((u) => (
                      <button
                        key={u}
                        type="button"
                        aria-pressed={sizeUnit === u}
                        onClick={() => sizeUnit !== u && handleSizeUnitChange({ target: { value: u } })}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${sizeUnit === u ? 'bg-gold-500 text-dark-900' : 'text-dark-400 hover:text-white'}`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <input
                    id="co-size"
                    value={getSizeValue()}
                    onChange={handleSizeChange}
                    className="input-dark pr-14"
                    inputMode="decimal"
                    placeholder="e.g. 5.5"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-dark-500">{sizeUnit}</span>
                </div>
              </div>
              <div>
                <label className="label-dark" htmlFor="co-weight">Estimated weight</label>
                <input id="co-weight" value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} className="input-dark" placeholder="e.g. 8–10 g" />
              </div>
            </div>
          </FieldGroup>

          {/* 4 · Description */}
          <FieldGroup n={4} title="Describe your idea">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-dark-500 mr-0.5">Helpful to mention:</span>
              {DESCRIPTION_TIPS.map((t) => (
                <span key={t} className="rounded-full border border-white/[0.08] bg-dark-900/50 px-2.5 py-0.5 text-[11px] text-dark-300">{t}</span>
              ))}
            </div>
            <textarea
              id="co-description"
              aria-label="Design description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="input-dark resize-none leading-relaxed"
              rows={5}
              maxLength={2000}
              placeholder="Describe your dream piece in detail — style, occasion, engravings, gemstones, finish (matte/polished), etc. The more detail, the better our quote will be."
            />
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-1 w-20 shrink-0 rounded-full bg-white/[0.08] overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${descOk ? 'bg-emerald-400' : 'bg-gold-500'}`} style={{ width: `${Math.min(100, (descLen / 20) * 100)}%` }} />
                </div>
                {descOk
                  ? <span className="text-emerald-400 inline-flex items-center gap-1"><FiCheck size={12} strokeWidth={3} /> Looks good</span>
                  : <span className="text-dark-500 truncate">{20 - descLen} more character{20 - descLen === 1 ? '' : 's'} needed</span>}
              </div>
              <span className={`shrink-0 tabular-nums ${form.description.length > 1900 ? 'text-red-400' : 'text-dark-500'}`}>{form.description.length}/2000</span>
            </div>
          </FieldGroup>
        </div>
      </StepCard>
    </motion.div>
  );

  const renderImages = () => (
    <motion.div key="step1" {...stepMotion}>
      <StepCard
        icon={FiImage}
        eyebrow="Step 2 of 4"
        title="Reference images"
        sub="Photos, screenshots or sketches help our artisans match your vision and quote more accurately."
        badge={<span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-dark-400">Optional</span>}
      >
        <div className="space-y-5">
          {/* Drop Zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload reference images"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openPicker();
              }
            }}
            onDrop={(e) => { setDragOver(false); handleDrop(e); }}
            onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={openPicker}
            className={`relative overflow-hidden rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-all duration-200 bg-[radial-gradient(rgba(212,175,55,0.10)_1px,transparent_1px)] [background-size:14px_14px] ${
              images.length >= 4
                ? 'border-white/10 opacity-60'
                : dragOver
                  ? 'border-gold-400 bg-gold-500/[0.08] cursor-copy'
                  : 'border-white/15 hover:border-gold-500/50 hover:bg-gold-500/[0.04] cursor-pointer'
            }`}
          >
            <span className={`mx-auto mb-3 w-14 h-14 rounded-2xl flex items-center justify-center border transition-colors ${dragOver ? 'bg-gold-500 text-dark-900 border-gold-400' : 'bg-gold-500/10 text-gold-300 border-gold-500/25'}`}>
              <FiUpload size={22} />
            </span>
            <p className="text-white text-sm font-semibold">
              {images.length < 4 ? (dragOver ? 'Drop to add' : <>Drag & drop or <span className="text-gold-400 underline underline-offset-4 decoration-gold-500/40">browse</span></>) : 'Maximum 4 images uploaded'}
            </p>
            <p className="text-dark-500 text-xs mt-1.5">JPEG, PNG or WebP · up to 10 MB each</p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-dark-900/70 px-3 py-1 text-[11px] font-medium text-dark-300">
              <FiImage size={11} className="text-gold-400" /> {images.length} of 4 added
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => { handleFileAdd(e.target.files); e.target.value = ''; }}
          />

          {/* Slots */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((idx) => {
              const src = previews[idx];
              if (src) {
                return (
                  <motion.div key={src.slice(-24)} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} className="relative group aspect-square rounded-2xl overflow-hidden bg-dark-700 border border-white/10">
                    <img src={src} alt={`Reference ${idx + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      aria-label={`Remove image ${idx + 1}`}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-red-500 text-white flex items-center justify-center transition-all [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus:opacity-100"
                    >
                      <FiX size={13} />
                    </button>
                  </motion.div>
                );
              }
              return (
                <button
                  key={`slot-${idx}`}
                  type="button"
                  onClick={openPicker}
                  className="aspect-square rounded-2xl border border-dashed border-white/10 bg-dark-900/40 flex flex-col items-center justify-center gap-1.5 text-dark-500 hover:border-gold-500/40 hover:text-gold-400 transition-colors"
                >
                  <FiPlus size={18} />
                  <span className="text-[11px]">Image {idx + 1}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-gold-500/20 bg-gold-500/[0.06] p-3.5 text-xs leading-relaxed">
            <FiInfo className="flex-shrink-0 mt-0.5 text-gold-400" size={15} />
            <p className="text-dark-300">
              <span className="text-gold-300 font-medium">Tip:</span> clear, well-lit photos of similar pieces or your own sketch work best.
              No images? You can skip this step.
            </p>
          </div>
        </div>
      </StepCard>
    </motion.div>
  );

  const renderDelivery = () => (
    <motion.div key="step2" {...stepMotion}>
      <StepCard icon={FiMapPin} eyebrow="Step 3 of 4" title="Delivery details" sub="Where should we deliver your finished piece?">
        {addrLoading ? (
          <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 rounded-xl skeleton bg-dark-700/50" />)}</div>
        ) : (
          <AddressSelector
            addresses={addresses}
            selectedAddrId={selectedAddrId}
            setSelectedAddrId={setSelectedAddrId}
            showNewAddr={showNewAddr}
            setShowNewAddr={setShowNewAddr}
            newAddr={newAddr}
            setNewAddr={setNewAddr}
            addrLoading={addrLoading}
          />
        )}

        {zones?.length > 0 && (
          <div className="mt-5 rounded-2xl border border-white/[0.07] bg-dark-900/50 p-4">
            {pickedZone ? (
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-300"><FiTruck size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white">We deliver to <span className="font-semibold">{pickedZone.area}</span> ({addr.pincode})</p>
                  <p className="text-xs text-dark-400 mt-0.5">Shipping is added to your quote along with GST.</p>
                </div>
                <span className="shrink-0 text-gold-400 font-semibold tabular-nums">₹{pickedZone.charge.toLocaleString('en-IN')}</span>
              </div>
            ) : (
              <>
                <p className="text-xs text-dark-400 flex items-center gap-1.5 mb-2.5"><FiTruck size={13} className="text-gold-400" /> We currently deliver to</p>
                <div className="flex flex-wrap gap-2">
                  {zones.map((z) => (
                    <span key={z.pincode} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-dark-800 px-2.5 py-1 text-xs text-dark-200">
                      {z.area} <span className="font-mono text-dark-500">{z.pincode}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </StepCard>
    </motion.div>
  );

  const reviewSpecs = [
    ['Material', form.material],
    ['Purity',   purityLabel || 'Not specified'],
    form.fingerSize && ['Finger size', `${form.fingerSize} ${sizeUnit}`],
    form.neckSize   && ['Neck size',   `${form.neckSize} ${sizeUnit}`],
    form.wristSize  && ['Wrist size',  `${form.wristSize} ${sizeUnit}`],
    form.weight     && ['Est. weight', form.weight],
  ].filter(Boolean);

  const renderReview = () => (
    <motion.div key="step3" {...stepMotion} className="space-y-4">
      <StepCard icon={FiCheckCircle} eyebrow="Step 4 of 4" title="Review your request" sub="Check everything once — you can edit any section before submitting.">
        <div className="divide-y divide-white/[0.06]">
          <ReviewSection title="Your design" onEdit={() => setStep(0)}>
            <div className="flex items-start gap-4">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-2xl overflow-hidden border border-gold-500/20 bg-dark-900 flex items-center justify-center bg-[radial-gradient(rgba(212,175,55,0.13)_1px,transparent_1px)] [background-size:10px_10px]">
                {previews[0]
                  ? <img src={previews[0]} alt="" className="w-full h-full object-cover" />
                  : <TypeGlyph type={form.type} className="w-12 h-12 text-gold-400/80" />}
              </div>
              <div className="min-w-0">
                <p className="font-serif text-xl text-white">Custom {form.type}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {reviewSpecs.map(([k, v]) => (
                    <span key={k} className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-dark-900/60 px-2 py-1 text-[11px]">
                      <span className="text-dark-500">{k}</span><span className="text-dark-100 font-medium">{v}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <blockquote className="mt-4 rounded-r-xl border-l-2 border-gold-500/60 bg-dark-900/40 py-3 pl-4 pr-3 text-sm text-dark-200 leading-relaxed whitespace-pre-line break-words">
              {form.description}
            </blockquote>
          </ReviewSection>

          <ReviewSection title={`Reference images (${previews.length})`} onEdit={() => setStep(1)}>
            {previews.length > 0 ? (
              <div className="flex gap-2.5 flex-wrap">
                {previews.map((src, i) => (
                  <div key={src.slice(-24)} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-dark-700 border border-white/10">
                    <img src={src} alt={`Reference ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-dark-500">No images added — that&apos;s fine, they&apos;re optional.</p>
            )}
          </ReviewSection>

          {addr && (
            <ReviewSection title="Delivery address" onEdit={() => setStep(2)}>
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 shrink-0 rounded-xl bg-gold-500/10 border border-gold-500/25 flex items-center justify-center text-gold-300"><FiMapPin size={15} /></span>
                <div className="min-w-0 text-sm">
                  <p className="text-white font-medium">{addr.fullName}</p>
                  <p className="text-dark-400">{addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''}</p>
                  <p className="text-dark-400">{addr.city}, {addr.state} — {addr.pincode}</p>
                  <p className="text-dark-500">{addr.phone}</p>
                </div>
              </div>
              {pickedZone && (
                <p className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-dark-900/50 px-3.5 py-2.5 text-sm">
                  <span className="text-dark-400 flex items-center gap-2"><FiTruck size={14} className="text-gold-400" /> Shipping to {pickedZone.area} ({addr.pincode})</span>
                  <span className="text-gold-400 font-semibold tabular-nums">₹{pickedZone.charge.toLocaleString('en-IN')}</span>
                </p>
              )}
            </ReviewSection>
          )}
        </div>
      </StepCard>

      <div className="relative overflow-hidden rounded-2xl border border-gold-500/25 bg-gradient-to-br from-gold-500/[0.10] via-gold-500/[0.04] to-transparent p-4 sm:p-5 flex items-start gap-3.5">
        <span className="w-10 h-10 shrink-0 rounded-xl bg-gold-500/15 border border-gold-500/30 flex items-center justify-center text-gold-300"><FiShield size={17} /></span>
        <div>
          <p className="text-white text-sm font-semibold">No payment today</p>
          <p className="text-dark-300 text-xs leading-relaxed mt-1">
            Our artisans will review your request and send a personalised quote within <strong className="text-white">24–48 hours</strong>.
            The quote shows the piece price, GST and the shipping charge for your PIN code.
            You&apos;ll see the quote on your Custom Orders page. Once you accept and pay, we begin crafting your piece.
          </p>
        </div>
      </div>

      <div className="lg:hidden rounded-2xl border border-white/[0.07] bg-dark-800/70 p-5">
        <p className="font-jakarta text-[11px] font-semibold uppercase tracking-[0.2em] text-dark-400 mb-4">What happens next</p>
        <JourneyList />
      </div>
    </motion.div>
  );

  // Live summary (desktop sidebar)
  const sizeValue = getSizeValue();
  const summaryRows = [
    { label: 'Piece',       value: form.type, required: true },
    { label: 'Metal',       value: [form.material, purityLabel].filter(Boolean).join(' · '), required: true },
    { label: 'Size',        value: sizeValue ? `${sizeValue} ${sizeUnit}` : '' },
    { label: 'Weight',      value: form.weight },
    { label: 'Description', value: descOk ? `${descLen} characters` : '', required: true },
    { label: 'Images',      value: images.length ? `${images.length} of 4` : '' },
    { label: 'Deliver to',  value: step >= 2 && addr?.city && addr?.pincode ? `${addr.city} · ${addr.pincode}` : '' },
  ];

  let primaryLabel = 'Continue';
  if (step === 1 && images.length === 0) primaryLabel = 'Skip for now';
  else if (step === 2) primaryLabel = 'Review request';

  return (
    <div className="relative min-h-screen pt-24 pb-16 overflow-x-clip">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(212,175,55,0.10),transparent_70%)]" aria-hidden="true" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-9">
          <p className="section-subtitle mb-3">Bespoke Craftsmanship</p>
          <h1 className="section-title mb-3">Design Your Custom Jewelry</h1>
          <GoldOrnament className="mb-4" />
          <p className="text-dark-400 text-sm max-w-xl mx-auto leading-relaxed">
            Share your vision and we&apos;ll craft a one-of-a-kind piece. Our skilled artisans will review
            your request and send a personalised quote within 24–48 hours.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {[
              [FiShield, 'No payment today'],
              [FiClock, 'Quote in 24–48 hours'],
              [FiFeather, 'Handcrafted for you'],
            ].map(([icon, text]) => {
              const Icon = icon;
              return (
                <span key={text} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-dark-800/70 px-3 py-1.5 font-jakarta text-[11px] sm:text-xs text-dark-200">
                  <Icon size={12} className="text-gold-400" /> {text}
                </span>
              );
            })}
          </div>
        </div>

        <div ref={stepperRef} className="mb-8 sm:mb-10">
          <Stepper current={step} onJump={setStep} />
        </div>

        <div className="grid gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
          {/* Main column */}
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              {step === 0 && renderDesign()}
              {step === 1 && renderImages()}
              {step === 2 && renderDelivery()}
              {step === 3 && renderReview()}
            </AnimatePresence>

            {/* Navigation — sticky so the next action is always within reach */}
            <div className="sticky bottom-0 z-20 mt-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-dark-900 via-dark-900/90 to-transparent">
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-dark-800/95 backdrop-blur-md p-2.5 sm:p-3 shadow-card">
                {step > 0 ? (
                  <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-dark py-2.5 px-4 sm:px-5 text-sm">
                    <FiChevronLeft size={16} /> Back
                  </button>
                ) : null}
                <div className="flex-1 min-w-0 hidden sm:block px-1">
                  <p className="font-jakarta text-xs text-dark-400">Step {step + 1} of {STEPS.length} · <span className="text-white font-medium">{STEPS[step].label}</span></p>
                  <div className="mt-1.5 h-1 max-w-[180px] rounded-full bg-white/[0.07] overflow-hidden">
                    <div className="h-full rounded-full bg-gold-gradient transition-all duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
                  </div>
                </div>
                <div className="flex-1 sm:hidden" />
                {step < 3 ? (
                  <button type="button" onClick={goNext} className="btn-gold py-2.5 px-5 sm:px-6 text-sm">
                    {primaryLabel} <FiChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="btn-gold py-2.5 px-5 sm:px-7 text-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />{'Submitting…'}
                      </span>
                    ) : (
                      <><FiSend size={15} /> Submit request</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Live summary — desktop */}
          <aside className="hidden lg:block lg:sticky lg:top-28 space-y-4">
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-dark-800/80 shadow-card">
              <div className="relative aspect-[16/10] flex items-center justify-center border-b border-white/[0.06] bg-dark-900 bg-[radial-gradient(rgba(212,175,55,0.13)_1px,transparent_1px)] [background-size:12px_12px]">
                {previews[0]
                  ? <img src={previews[0]} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  : (
                    <div className="text-center">
                      <TypeGlyph type={form.type} className={`mx-auto w-16 h-16 ${form.type ? 'text-gold-400/85' : 'text-dark-600'}`} />
                      {!form.type && <p className="mt-2 text-[11px] text-dark-500">Pick a piece to begin</p>}
                    </div>
                  )}
                <span className="absolute left-3 top-3 rounded-full bg-black/60 border border-gold-500/30 px-2.5 py-0.5 font-jakarta text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-300">Bespoke</span>
              </div>
              <div className="p-5">
                <p className="font-jakarta text-[10px] font-semibold uppercase tracking-[0.25em] text-gold-500/90">Your request</p>
                <p className="font-serif text-xl text-white mt-0.5 truncate">{form.type ? `Custom ${form.type}` : 'Your custom piece'}</p>

                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1 flex-1 rounded-full bg-white/[0.07] overflow-hidden">
                    <div className="h-full rounded-full bg-gold-gradient transition-all duration-500" style={{ width: `${(requiredDone / 3) * 100}%` }} />
                  </div>
                  <span className="text-[11px] text-dark-400 tabular-nums">{requiredDone}/3 required</span>
                </div>

                <dl className="mt-4 space-y-2.5">
                  {summaryRows.map(({ label, value, required }) => (
                    <div key={label} className="flex items-center gap-2.5 text-[13px]">
                      <span className={`w-4 h-4 shrink-0 rounded-full flex items-center justify-center ${value ? 'bg-gold-500 text-dark-900' : 'border border-white/15'}`}>
                        {value && <FiCheck size={10} strokeWidth={3.5} />}
                      </span>
                      <dt className="text-dark-400 shrink-0">{label}</dt>
                      <dd className={`ml-auto min-w-0 truncate text-right ${value ? 'text-white font-medium' : 'text-dark-600'}`}>
                        {value || (required ? 'Required' : '—')}
                      </dd>
                    </div>
                  ))}
                </dl>
                {pickedZone && step >= 2 && (
                  <p className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[13px]">
                    <span className="text-dark-400">Shipping ({pickedZone.area})</span>
                    <span className="text-gold-400 font-semibold tabular-nums">₹{pickedZone.charge.toLocaleString('en-IN')}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/[0.07] bg-dark-800/60 p-5">
              <p className="font-jakarta text-[11px] font-semibold uppercase tracking-[0.2em] text-dark-400 mb-4">How it works</p>
              <JourneyList compact />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
