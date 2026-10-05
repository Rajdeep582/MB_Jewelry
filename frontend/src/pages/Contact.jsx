import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import {
  FiMail, FiPhone, FiMapPin, FiSend, FiCopy, FiCheck, FiClock, FiNavigation,
  FiChevronDown, FiArrowUpRight, FiPenTool, FiUser, FiMessageSquare, FiTag,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

// ─── Store details ────────────────────────────────────────────────────────────
const EMAIL = 'mbjewellers2021@gmail.com';
const PHONE = '09830424257';
const ADDRESS = "BOYS' HIGH SCHOOL, 217/3, Netaji Subhash Bose Rd, beside NEW BARRACKPORE, New Barrackpur, West Bengal 700131";
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`;

// Opening hours (IST). day: 0 = Sunday … 6 = Saturday; open/close in minutes from midnight.
const HOURS = [
  { label: 'Monday – Friday', days: [1, 2, 3, 4, 5], open: 600, close: 1140, text: '10:00 AM – 7:00 PM' },
  { label: 'Saturday',        days: [6],             open: 600, close: 1020, text: '10:00 AM – 5:00 PM' },
  { label: 'Sunday',          days: [0],             open: null, close: null, text: 'Closed' },
];

const TOPICS = ['Order help', 'Custom design', 'Repair / resize', 'Gold & silver rates', 'Other'];

const FAQS = [
  { q: 'Where do you deliver?', a: 'We currently deliver to New Barrackpore (700131), Madhyamgram (700129) and Barasat (700124). Shipping is calculated at checkout from your PIN code.' },
  { q: 'How long does a custom design take?', a: 'We send a quote within 24–48 hours of your request. Crafting starts once the advance is paid, and you can track every step in My Custom Orders.' },
  { q: 'Is your gold hallmarked?', a: 'Yes — our 22K and 18K gold is BIS-hallmarked and certified for purity before it is crafted.' },
  { q: 'How can I pay?', a: 'All payments are made securely online through Razorpay — UPI, cards, net banking and wallets.' },
];

const MESSAGE_MAX = 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Current day + minutes in India, regardless of the visitor's own time zone. */
function nowInIndia() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

const fmtTime = (m) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${((h + 11) % 12) + 1}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`;
};

function getStoreStatus() {
  const { day, minutes } = nowInIndia();
  const today = HOURS.find((h) => h.days.includes(day));
  if (today?.open != null && minutes >= today.open && minutes < today.close) {
    return { open: true, label: `Open now · closes ${fmtTime(today.close)}`, day };
  }
  if (today?.open != null && minutes < today.open) {
    return { open: false, label: `Closed · opens ${fmtTime(today.open)} today`, day };
  }
  // find next opening day
  for (let i = 1; i <= 7; i += 1) {
    const d = (day + i) % 7;
    const next = HOURS.find((h) => h.days.includes(d) && h.open != null);
    if (next) {
      const name = i === 1 ? 'tomorrow' : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d];
      return { open: false, label: `Closed · opens ${fmtTime(next.open)} ${name}`, day };
    }
  }
  return { open: false, label: 'Closed', day };
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ─── Small pieces ─────────────────────────────────────────────────────────────
function GoldOrnament({ className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-gold-500/70" />
      <span className="w-1.5 h-1.5 rotate-45 bg-gold-400 shadow-[0_0_10px_rgba(212,175,55,0.7)]" />
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-gold-500/70" />
    </div>
  );
}
GoldOrnament.propTypes = { className: PropTypes.string };

/** Quick-action tile: whole tile is a link; optional copy button for the value. */
function ActionTile({ icon, label, value, href, external = false, copy, delay = 0, className = '' }) {
  const Icon = icon;
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (await copyText(copy)) {
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1600);
    }
  };
  const isRoute = href.startsWith('/');
  const cls = `group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-dark-800 to-dark-900 p-3 sm:p-4 ${copy ? 'pr-12' : ''} transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-500/35 hover:shadow-card-hover`;
  const body = (
    <>
      <span className="pointer-events-none absolute -right-8 -top-8 w-24 h-24 rounded-full bg-gold-500/[0.06] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <span className="relative flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 text-gold-400 flex items-center justify-center transition-colors duration-300 group-hover:bg-gold-500 group-hover:text-dark-900">
        <Icon size={17} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block font-jakarta text-[10px] font-semibold uppercase tracking-[0.18em] text-dark-500">{label}</span>
        <span className="block font-jakarta text-[13px] sm:text-sm text-white truncate group-hover:text-gold-300 transition-colors">{value}</span>
      </span>
      {!copy && (
        <FiArrowUpRight size={16} className="relative hidden sm:block flex-shrink-0 text-dark-500 group-hover:text-gold-400 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
      )}
    </>
  );
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }} className={`relative ${className}`}>
      {isRoute ? (
        <Link to={href} className={cls}>{body}</Link>
      ) : (
        <a href={href} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{body}</a>
      )}
      {copy && (
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${label.toLowerCase()}`}
          title="Copy"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-dark-400 hover:text-gold-300 hover:bg-white/5 transition-colors"
        >
          {copied ? <FiCheck size={14} className="text-emerald-400" /> : <FiCopy size={14} />}
        </button>
      )}
    </motion.div>
  );
}
ActionTile.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  href: PropTypes.string.isRequired,
  external: PropTypes.bool,
  copy: PropTypes.string,
  delay: PropTypes.number,
  className: PropTypes.string,
};

/** Stylised street map with a pulsing store pin (no external map script). */
function StoreMap() {
  return (
    <a
      href={MAPS_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open store location in Google Maps"
      className="group relative block h-40 sm:h-44 overflow-hidden rounded-xl border border-white/[0.06] bg-dark-950"
    >
      <svg viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <defs>
          <radialGradient id="ct-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* blocks */}
        <g fill="#ffffff" fillOpacity="0.025">
          <rect x="20" y="16" width="70" height="46" rx="4" /><rect x="110" y="16" width="80" height="46" rx="4" />
          <rect x="230" y="16" width="60" height="46" rx="4" /><rect x="310" y="16" width="74" height="46" rx="4" />
          <rect x="20" y="104" width="70" height="60" rx="4" /><rect x="110" y="104" width="80" height="60" rx="4" />
          <rect x="230" y="104" width="60" height="60" rx="4" /><rect x="310" y="104" width="74" height="60" rx="4" />
        </g>
        {/* roads */}
        <g stroke="#ffffff" strokeOpacity="0.08" strokeWidth="10" fill="none">
          <path d="M0 82 H400" /><path d="M100 0 V180" /><path d="M210 0 V180" /><path d="M300 0 V180" />
        </g>
        {/* main road (NSB Rd) */}
        <path d="M-10 150 C90 120 170 96 210 82 S330 40 410 30" stroke="#D4AF37" strokeOpacity="0.35" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M-10 150 C90 120 170 96 210 82 S330 40 410 30" stroke="#FBEFC4" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="6 8" fill="none" />
        <circle cx="210" cy="82" r="70" fill="url(#ct-glow)" />
      </svg>
      {/* pin */}
      <span className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-full flex flex-col items-center">
        <span className="relative flex items-center justify-center w-9 h-9 rounded-full bg-gold-gradient shadow-gold text-dark-900 transition-transform duration-300 group-hover:-translate-y-1">
          <FiMapPin size={16} />
        </span>
        <span className="w-0.5 h-2 bg-gold-500" />
      </span>
      <span className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-gold-400/70 animate-ping" aria-hidden="true" />
      <span className="absolute left-3 bottom-3 rounded-full bg-dark-950/85 backdrop-blur border border-white/10 px-2.5 py-1 font-jakarta text-[11px] text-dark-200">
        New Barrackpore · 700131
      </span>
      <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-gold-500 px-3 py-1 font-jakarta text-[11px] font-semibold text-dark-900 shadow-gold transition-transform duration-300 group-hover:scale-105">
        <FiNavigation size={11} /> Directions
      </span>
    </a>
  );
}

function FaqItem({ q, a, open, onToggle }) {
  return (
    <div className={`rounded-xl border transition-colors duration-300 ${open ? 'border-gold-500/30 bg-gold-500/[0.04]' : 'border-white/[0.06] bg-dark-900/40 hover:border-white/15'}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
        <span className={`font-jakarta text-sm font-medium transition-colors ${open ? 'text-gold-300' : 'text-white'}`}>{q}</span>
        <FiChevronDown size={15} className={`flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-gold-400' : 'text-dark-500'}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <p className="px-4 pb-3.5 font-jakarta text-[13px] leading-relaxed text-dark-300">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
FaqItem.propTypes = { q: PropTypes.string.isRequired, a: PropTypes.string.isRequired, open: PropTypes.bool.isRequired, onToggle: PropTypes.func.isRequired };

function Field({ id, label, icon, children }) {
  const Icon = icon;
  return (
    <div>
      <label htmlFor={id} className="block font-jakarta text-xs font-medium text-dark-300 mb-1.5">{label}</label>
      <div className="relative group">
        {Icon && <Icon size={14} className="absolute left-3.5 top-[0.95rem] text-dark-500 group-focus-within:text-gold-400 transition-colors pointer-events-none" />}
        {children}
      </div>
    </div>
  );
}
Field.propTypes = { id: PropTypes.string.isRequired, label: PropTypes.string.isRequired, icon: PropTypes.elementType, children: PropTypes.node.isRequired };

const INPUT = 'input-dark !bg-dark-900/50 font-jakarta text-sm py-2.5 pl-10';

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [status, setStatus] = useState(getStoreStatus);

  useEffect(() => { document.title = 'Contact Us — M.B. JEWELLERS'; }, []);

  // Keep the open/closed badge current while the page is open
  useEffect(() => {
    const t = setInterval(() => setStatus(getStoreStatus()), 60000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));

    const subject = encodeURIComponent(form.subject || 'Inquiry — M.B. JEWELLERS');
    const body = encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\nMessage:\n${form.message}`);
    window.location.href = `mailto:${EMAIL}?subject=${subject}&body=${body}`;

    toast.success('Message sent! We\'ll reply within 24 hours. 💍');
    setForm({ name: '', email: '', subject: '', message: '' });
    setSubmitting(false);
  };

  return (
    <div className="relative min-h-screen pt-24 sm:pt-28 pb-20 overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(212,175,55,0.09),transparent_70%)]" aria-hidden="true" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
          <div>
            <p className="font-jakarta text-[11px] font-semibold tracking-[0.3em] text-gold-500 uppercase mb-2">Get in touch</p>
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-white leading-tight pt-0">Contact Us</h1>
            <GoldOrnament className="mt-3" />
            <p className="font-jakarta text-dark-400 text-sm mt-3 max-w-lg">
              Questions about an order, a custom design or today&apos;s rates? Call, write or visit — we usually reply within a day.
            </p>
          </div>
          <span className={`self-start sm:self-auto inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-jakarta text-xs font-medium ${
            status.open ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/[0.03] text-dark-300'
          }`}>
            <span className="relative flex w-2 h-2">
              {status.open && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />}
              <span className={`relative inline-flex w-2 h-2 rounded-full ${status.open ? 'bg-emerald-400' : 'bg-dark-500'}`} />
            </span>
            {status.label}
          </span>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 lg:grid-cols-[1fr_1.35fr_1fr_1.1fr] gap-2.5 sm:gap-3 mb-6">
          <ActionTile icon={FiPhone} label="Call us" value={PHONE} href={`tel:${PHONE}`} copy={PHONE} delay={0} className="col-span-2 sm:col-span-1" />
          <ActionTile icon={FiMail} label="Email" value={EMAIL} href={`mailto:${EMAIL}`} copy={EMAIL} delay={0.05} className="col-span-2 sm:col-span-1" />
          <ActionTile icon={FiNavigation} label="Visit us" value="Directions" href={MAPS_URL} external delay={0.1} />
          <ActionTile icon={FiPenTool} label="Bespoke" value="Custom design" href="/custom-order" delay={0.15} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
          {/* Form */}
          <motion.section
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}
            className="lg:col-span-3 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-dark-800 to-dark-900 p-5 sm:p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="w-9 h-9 rounded-xl bg-gold-500/10 border border-gold-500/20 text-gold-400 flex items-center justify-center"><FiMessageSquare size={16} /></span>
              <div>
                <h2 className="font-serif text-lg sm:text-xl text-white font-semibold leading-tight pt-0">Send a message</h2>
                <p className="font-jakarta text-xs text-dark-500">Opens in your email app, ready to send.</p>
              </div>
            </div>

            {/* Topic chips → subject */}
            <div className="mb-4">
              <p className="font-jakarta text-xs font-medium text-dark-300 mb-2">What is it about?</p>
              <div className="flex flex-wrap gap-1.5">
                {TOPICS.map((t) => {
                  const active = form.subject === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, subject: active ? '' : t })}
                      aria-pressed={active}
                      className={`font-jakarta px-3 py-1.5 rounded-full text-xs border transition-all duration-200 ${
                        active ? 'bg-gold-500 border-gold-500 text-dark-900 font-semibold' : 'border-white/10 text-dark-300 hover:border-gold-500/40 hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <form id="contact-form" onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <Field id="contact-name" label="Full Name" icon={FiUser}>
                  <input id="contact-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Your name" autoComplete="name" className={INPUT} required />
                </Field>
                <Field id="contact-email" label="Email" icon={FiMail}>
                  <input id="contact-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com" autoComplete="email" className={INPUT} required />
                </Field>
              </div>
              <Field id="contact-subject" label="Subject" icon={FiTag}>
                <input id="contact-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Order inquiry, custom design, etc." className={INPUT} required />
              </Field>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="contact-message" className="font-jakarta text-xs font-medium text-dark-300">Message</label>
                  <span className={`font-jakarta text-[11px] tabular-nums ${form.message.length > MESSAGE_MAX * 0.9 ? 'text-amber-400' : 'text-dark-600'}`}>
                    {form.message.length}/{MESSAGE_MAX}
                  </span>
                </div>
                <textarea id="contact-message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="How can we help you?" rows={4} maxLength={MESSAGE_MAX}
                  className="input-dark !bg-dark-900/50 font-jakarta text-sm py-2.5 resize-none" required />
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <p className="font-jakarta text-[11px] text-dark-500 flex items-center gap-1.5">
                  <FiClock size={11} className="text-gold-600" /> Usual reply time: within 24 hours
                </p>
                <button type="submit" disabled={submitting} className="btn-gold py-2.5 px-6 text-sm gap-2">
                  {submitting ? (
                    <><span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" /> Sending...</>
                  ) : (
                    <><FiSend size={14} /> Send Message</>
                  )}
                </button>
              </div>
            </form>
          </motion.section>

          {/* Store + hours */}
          <motion.aside
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.15 }}
            className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-dark-800 to-dark-900 p-5 sm:p-6 space-y-4"
          >
            <div>
              <h2 className="font-serif text-lg sm:text-xl text-white font-semibold leading-tight pt-0 mb-3">Visit our store</h2>
              <StoreMap />
              <p className="font-jakarta text-dark-300 text-[13px] leading-relaxed mt-3 flex items-start gap-2">
                <FiMapPin size={13} className="text-gold-500 mt-0.5 flex-shrink-0" />
                {ADDRESS}
              </p>
            </div>

            <div className="pt-4 border-t border-white/[0.06]">
              <h3 className="font-jakarta text-[11px] font-semibold uppercase tracking-[0.18em] text-dark-300 mb-2.5 flex items-center gap-2">
                <FiClock size={12} className="text-gold-500" /> Business hours
              </h3>
              <ul className="space-y-1">
                {HOURS.map((h) => {
                  const isToday = h.days.includes(status.day);
                  return (
                    <li key={h.label} className={`flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 font-jakarta text-[13px] ${isToday ? 'bg-gold-500/[0.08] border border-gold-500/20' : ''}`}>
                      <span className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 ${isToday ? 'text-gold-300 font-medium' : 'text-dark-400'}`}>
                        {h.label}
                        {isToday && <span className="rounded-full bg-gold-500 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-dark-900">Today</span>}
                      </span>
                      <span className={`shrink-0 whitespace-nowrap text-right ${h.open == null ? 'text-red-400' : 'text-white'}`}>{h.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.aside>
        </div>

        {/* FAQ */}
        <section className="mt-6 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-dark-800 to-dark-900 p-5 sm:p-6">
          <div className="flex items-end justify-between gap-3 mb-4">
            <div>
              <p className="font-jakarta text-[10px] font-semibold tracking-[0.25em] text-gold-500 uppercase mb-1">Before you write</p>
              <h2 className="font-serif text-lg sm:text-xl text-white font-semibold leading-tight pt-0">Quick answers</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 items-start">
            {FAQS.map((f, i) => (
              <FaqItem key={f.q} q={f.q} a={f.a} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? -1 : i)} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
