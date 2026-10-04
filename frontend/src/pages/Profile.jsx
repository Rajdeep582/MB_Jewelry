import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import PropTypes from 'prop-types';
import {
  FiUser, FiMapPin, FiPlus, FiTrash2, FiEdit3, FiCheck, FiShoppingBag, FiHeart,
  FiShield, FiPhone, FiMail, FiPackage, FiCalendar, FiChevronRight, FiStar,
} from 'react-icons/fi';
import { setUser, selectUser } from '../store/authSlice';
import { addToCart, openCart } from '../store/cartSlice';
import { userService } from '../services/services';
import { resolveImageUrl, formatPrice } from '../utils/helpers';
import toast from 'react-hot-toast';
import api from '../services/api';

// ─── Static config ────────────────────────────────────────────────────────────
const BLANK_ADDR = {
  fullName: '', phone: '', addressLine1: '', addressLine2: '',
  city: '', state: '', pincode: '', country: 'India', isDefault: false,
};
const ADDR_KEYS = Object.keys(BLANK_ADDR);
const ADDR_FIELDS = [
  { name: 'fullName',     label: 'Full Name',                  col: 2, autoComplete: 'name' },
  { name: 'phone',        label: 'Phone Number',               placeholder: '10-digit mobile number', inputMode: 'tel', autoComplete: 'tel' },
  { name: 'pincode',      label: 'PIN Code',                   placeholder: '6-digit PIN', inputMode: 'numeric', maxLength: 6, autoComplete: 'postal-code' },
  { name: 'addressLine1', label: 'Street Address',             col: 2, placeholder: 'House no., building, street', autoComplete: 'address-line1' },
  { name: 'addressLine2', label: 'Apartment/Suite (optional)', col: 2, placeholder: 'Area, landmark', autoComplete: 'address-line2' },
  { name: 'city',         label: 'City',                       autoComplete: 'address-level2' },
  { name: 'state',        label: 'State',                      autoComplete: 'address-level1' },
];
const TABS = [
  { id: 'details',   label: 'Personal Details', short: 'Details',   icon: FiUser },
  { id: 'addresses', label: 'Addresses',        short: 'Addresses', icon: FiMapPin },
  { id: 'saved',     label: 'Saved Items',      short: 'Saved',     icon: FiHeart },
];
const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];
const INPUT = 'input-dark !bg-dark-900/50 text-sm py-2.5';

// ─── Pure helpers (display only) ──────────────────────────────────────────────
function formFromUser(user) {
  const nameParts = (user?.name || '').trim().split(' ');
  return {
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || '',
    gender: user?.gender || '',
    phone: user?.phone || '',
    alternateEmail: user?.alternateEmail || '',
  };
}
const lastTenDigits = (v) => String(v ?? '').replaceAll(/\D/g, '').slice(-10);
const pickAddress = (a) => Object.fromEntries(
  ADDR_KEYS.map((k) => [k, typeof a[k] === 'string' ? a[k].trim() : a[k] ?? BLANK_ADDR[k]])
);
const apiError = (err, fallback) =>
  err?.response?.data?.errors?.[0]?.message || err?.response?.data?.message || fallback;

// ─── Small presentational pieces ─────────────────────────────────────────────
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

// Faint brilliant-cut outline used as a background accent in the hero card
function FacetMark({ className = '' }) {
  return (
    <svg viewBox="0 0 120 100" fill="none" stroke="currentColor" strokeWidth="1" className={className} aria-hidden="true">
      <path d="M20 8h80l18 26-58 62L2 34z" />
      <path d="M2 34h116M20 8l20 26 20-26 20 26 20-26M40 34l20 62 20-62" />
    </svg>
  );
}
FacetMark.propTypes = { className: PropTypes.string };

// Avatar wrapped in an animated profile-completion ring
function CompletionAvatar({ initial, pct }) {
  const R = 40;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative w-[88px] h-[88px] flex-shrink-0" title={`Profile ${pct}% complete`}>
      <svg viewBox="0 0 92 92" className="absolute inset-0 w-full h-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="pf-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F2C94C" />
            <stop offset="100%" stopColor="#B8892B" />
          </linearGradient>
        </defs>
        <circle cx="46" cy="46" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
        <motion.circle
          cx="46" cy="46" r={R} fill="none" stroke="url(#pf-ring)" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct / 100) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-[9px] rounded-full bg-gradient-to-br from-dark-700 to-dark-900 border border-gold-500/20 flex items-center justify-center">
        <span className="font-serif text-3xl text-gold-400 leading-none">{initial}</span>
      </div>
      <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-dark-900 border border-gold-500/30 font-jakarta text-[10px] font-semibold text-gold-400 leading-none">
        {pct}%
      </span>
    </div>
  );
}
CompletionAvatar.propTypes = { initial: PropTypes.string.isRequired, pct: PropTypes.number.isRequired };

function StatTile({ icon, value, label, onClick, to }) {
  const Icon = icon;
  const cls = 'group text-left p-3 rounded-xl bg-dark-900/50 border border-white/[0.06] hover:border-gold-500/35 hover:bg-gold-500/[0.04] transition-colors';
  const body = (
    <>
      <span className="flex items-center justify-between text-dark-500 group-hover:text-gold-400 transition-colors">
        <Icon size={13} />
        <FiChevronRight size={12} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
      </span>
      <span className="block font-jakarta text-lg font-semibold text-white leading-none mt-2">{value}</span>
      <span className="block font-jakarta text-[11px] text-dark-400 mt-1">{label}</span>
    </>
  );
  return to
    ? <Link to={to} className={cls}>{body}</Link>
    : <button type="button" onClick={onClick} className={cls}>{body}</button>;
}
StatTile.propTypes = {
  icon: PropTypes.elementType.isRequired,
  value: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  to: PropTypes.string,
};

function SectionTitle({ icon, title, sub }) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="w-9 h-9 rounded-xl bg-gold-500/10 border border-gold-500/20 text-gold-400 flex items-center justify-center flex-shrink-0">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <h3 className="font-serif text-lg sm:text-xl text-white font-semibold leading-tight">{title}</h3>
        {sub && <p className="font-jakarta text-xs text-dark-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
SectionTitle.propTypes = { icon: PropTypes.elementType.isRequired, title: PropTypes.string.isRequired, sub: PropTypes.string };

function Field({ id, label, icon, hint = '', ...inputProps }) {
  const Icon = icon;
  return (
    <div>
      <label htmlFor={id} className="block font-jakarta text-xs font-medium text-dark-300 mb-1.5">{label}</label>
      <div className="relative group">
        {Icon && (
          <Icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500 group-focus-within:text-gold-400 transition-colors pointer-events-none" />
        )}
        <input id={id} {...inputProps} className={`${INPUT} ${Icon ? 'pl-10' : ''}`} />
      </div>
      <AnimatePresence>
        {hint && (
          <motion.p initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-amber-400/90 text-[11px] mt-1">
            {hint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
Field.propTypes = { id: PropTypes.string.isRequired, label: PropTypes.string.isRequired, icon: PropTypes.elementType, hint: PropTypes.string };

function EmptyState({ icon, text, children }) {
  const Icon = icon;
  return (
    <div className="mt-4 text-center py-8 px-4 rounded-2xl border border-dashed border-white/10 bg-dark-900/30">
      <span className="mx-auto mb-3 w-12 h-12 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-400 flex items-center justify-center">
        <Icon size={18} />
      </span>
      <p className="font-jakarta text-dark-300 text-sm">{text}</p>
      {children}
    </div>
  );
}
EmptyState.propTypes = { icon: PropTypes.elementType.isRequired, text: PropTypes.string.isRequired, children: PropTypes.node };

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Profile() {
  const dispatch = useDispatch();
  const authUser = useSelector(selectUser);
  const [params, setParams] = useSearchParams();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', gender: '', phone: '', alternateEmail: '',
  });
  const [emailForm, setEmailForm] = useState({ email: '' });
  const [addEmailStep, setAddEmailStep] = useState('input'); // input | otp | done
  const [addingEmail, setAddingEmail] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [addrForm, setAddrForm] = useState(null); // null | { id: string|null, data: address }
  const [savingAddr, setSavingAddr] = useState(false);
  const [confirmDelId, setConfirmDelId] = useState(null);

  const isNonUser = authUser?.role === 'admin' || authUser?.role === 'delivery';

  useEffect(() => {
    if (isNonUser) return; // admin/delivery don't use the user profile fetch
    document.title = 'My Profile — M.B. JEWELLERS';
    userService.getProfile()
      .then((profRes) => {
        const user = profRes.data.user;
        if (!user) { setLoading(false); return; }
        setProfile(user);
        setForm(formFromUser(user));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isNonUser]);

  // Delivery partners have dedicated profile on /delivery page
  if (authUser?.role === 'delivery') return <Navigate to="/delivery" replace />;

  // Admin profile — show minimal view
  if (authUser?.role === 'admin') {
    return (
      <div className="min-h-screen pt-20 pb-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h1 className="section-title mb-2">Admin Profile</h1>
          <div className="gold-divider mt-2 mx-0 mb-6" />
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-500/20 to-gold-700/10 border border-gold-500/20 flex items-center justify-center text-2xl font-bold text-gold-400">
                {(authUser.name || 'A')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-white font-semibold text-lg">{authUser.name || '—'}</p>
                <p className="text-dark-500 text-sm">{authUser.email}</p>
                <span className="inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-400">
                  Admin
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Tabs (kept in the URL so ?tab=addresses can be linked/refreshed) ──────
  const tabParam = params.get('tab');
  const tab = TABS.some((t) => t.id === tabParam) ? tabParam : 'details';
  const setTab = (id) => setParams(id === 'details' ? {} : { tab: id }, { replace: true });

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fullName = `${form.firstName} ${form.lastName}`.trim();
      const payload = {
        name: fullName,
        phone: form.phone,
        alternateEmail: form.alternateEmail,
        gender: form.gender
      };

      const res = await userService.updateProfile(payload);
      setProfile(res.data.user);
      setForm(formFromUser(res.data.user));
      dispatch(setUser(res.data.user)); // keep the in-memory access token
      toast.success('Profile details saved!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  // ─── Address book (existing add / update / delete endpoints) ──────────────
  const openAddForm = () => {
    setConfirmDelId(null);
    setAddrForm({
      id: null,
      data: {
        ...BLANK_ADDR,
        fullName: profile?.name || '',
        phone: profile?.phone || profile?.mobile || '',
        isDefault: !profile?.addresses?.length,
      },
    });
  };
  const openEditForm = (addr) => {
    setConfirmDelId(null);
    setAddrForm({ id: addr._id, data: { ...BLANK_ADDR, ...pickAddress(addr) } });
  };
  const setAddrField = (name, value) => setAddrForm((f) => ({ ...f, data: { ...f.data, [name]: value } }));

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    if (!addrForm) return;
    const editing = !!addrForm.id;
    setSavingAddr(true);
    try {
      const payload = pickAddress(addrForm.data);
      const res = editing
        ? await userService.updateAddress(addrForm.id, payload)
        : await userService.addAddress(payload);
      setProfile((p) => ({ ...p, addresses: res.data.addresses }));
      toast.success(editing ? 'Address updated' : 'Address added!');
      setAddrForm(null);
    } catch (err) {
      toast.error(apiError(err, editing ? 'Failed to update address' : 'Failed to add address'));
    } finally {
      setSavingAddr(false);
    }
  };

  const handleSetDefault = async (addr) => {
    try {
      const res = await userService.updateAddress(addr._id, { ...pickAddress(addr), isDefault: true });
      setProfile((p) => ({ ...p, addresses: res.data.addresses }));
      toast.success('Default address updated');
    } catch (err) {
      toast.error(apiError(err, 'Failed to update address'));
    }
  };

  const handleDeleteAddress = async (addrId) => {
    setConfirmDelId(null);
    if (addrForm?.id === addrId) setAddrForm(null);
    try {
      const res = await userService.deleteAddress(addrId);
      setProfile((p) => ({ ...p, addresses: res.data.addresses }));
      toast.success('Address removed');
    } catch {
      toast.error('Failed to remove address');
    }
  };

  const handleRemoveWishlist = async (productId) => {
    // Optimistic UI update
    setProfile(prev => ({
      ...prev,
      wishlist: prev.wishlist.filter(p => p._id !== productId)
    }));

    try {
      const res = await userService.toggleWishlist(productId);
      dispatch(setUser(res.data.user)); // keep the in-memory access token
      toast.success('Removed from saved items');
    } catch {
      toast.error('Failed to remove item');
    }
  };

  const handleAddEmail = async (e) => {
    e.preventDefault();
    setAddingEmail(true);
    try {
      await api.post('/auth/add-email', { email: emailForm.email });
      setAddEmailStep('otp');
      toast.success('Verification email sent!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send email');
    } finally {
      setAddingEmail(false);
    }
  };

  const handleVerifyEmailOtp = async (e) => {
    e.preventDefault();
    setAddingEmail(true);
    try {
      const res = await api.post('/auth/verify-email-otp', { otp: emailOtp });
      setProfile((p) => ({ ...p, email: res.data.email, isVerified: true }));
      dispatch(setUser({ ...profile, email: res.data.email }));
      setAddEmailStep('done');
      toast.success('Email verified and saved!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Invalid OTP');
    } finally {
      setAddingEmail(false);
    }
  };

  const handleAddToCart = (product) => {
    if (product.stock === 0) {
      toast.error('Product is out of stock');
      return;
    }
    dispatch(addToCart({ ...product, quantity: 1 }));
    dispatch(openCart());
    toast.success(`${product.name} added to cart!`, { icon: '💎' });
  };

  if (loading) return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="h-12 w-52 rounded-xl skeleton bg-dark-700/50" />
        <div className="h-36 rounded-3xl skeleton bg-dark-700/50" />
        <div className="h-10 w-80 max-w-full rounded-xl skeleton bg-dark-700/50" />
        <div className="h-64 rounded-3xl skeleton bg-dark-700/50" />
      </div>
    </div>
  );

  const calculateCompletion = () => {
    let score = 0;
    if (profile?.name) score += 20;
    if (profile?.email) score += 20;
    if (profile?.phone) score += 20;
    if (profile?.alternateEmail) score += 10;
    if (profile?.addresses?.length > 0) score += 30;
    return Math.min(score, 100);
  };
  const completion = calculateCompletion();

  // ─── Derived display values ───────────────────────────────────────────────
  const addresses   = profile?.addresses || [];
  const wishlist    = profile?.wishlist || [];
  const counts      = { addresses: addresses.length, saved: wishlist.length };
  const displayName = profile?.name || 'User';
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : null;
  const accountPhone = lastTenDigits(profile?.phone || profile?.mobile);
  const initialForm  = formFromUser(profile);
  const dirty = Object.keys(initialForm).some((k) => String(form[k] ?? '').trim() !== String(initialForm[k] ?? '').trim());
  const altSameAsLogin = !!profile?.email && form.alternateEmail.trim().toLowerCase() === profile.email.toLowerCase();

  const missing = [
    !profile?.email && { key: 'email', label: 'Add email', tab: 'details', focus: 'pf-add-email' },
    !profile?.phone && { key: 'phone', label: 'Add phone', tab: 'details', focus: 'pf-phone' },
    !profile?.alternateEmail && { key: 'alt', label: 'Add alternate email', tab: 'details', focus: 'pf-alternateEmail' },
    !addresses.length && { key: 'addr', label: 'Add an address', tab: 'addresses', add: true },
  ].filter(Boolean);

  const goToMissing = (m) => {
    setTab(m.tab);
    if (m.add) openAddForm();
    if (m.focus) setTimeout(() => document.getElementById(m.focus)?.focus(), 350);
  };

  // ─── Section renderers ────────────────────────────────────────────────────
  const renderEmailContent = () => {
    if (profile?.email) {
      return (
        <div className="flex items-center gap-3 p-3.5 bg-dark-900/50 rounded-xl border border-green-500/20">
          <FiCheck className="text-green-400 shrink-0" size={16} />
          <div>
            <p className="text-white text-sm">{profile.email}</p>
            <p className="text-green-400 text-xs mt-0.5">Verified</p>
          </div>
        </div>
      );
    }
    if (addEmailStep === 'done') {
      return (
        <div className="flex items-center gap-3 p-3.5 bg-dark-900/50 rounded-xl border border-green-500/20">
          <FiCheck className="text-green-400 shrink-0" size={16} />
          <p className="text-white text-sm">Email verified successfully</p>
        </div>
      );
    }
    if (addEmailStep === 'otp') {
      return (
        <form onSubmit={handleVerifyEmailOtp} className="space-y-3">
          <p className="text-dark-400 text-sm">Enter the 6-digit OTP sent to <span className="text-white">{emailForm.email}</span></p>
          <div className="max-w-xs">
            <label htmlFor="pf-email-otp" className="block font-jakarta text-xs font-medium text-dark-300 mb-1.5">OTP Code</label>
            <input
              id="pf-email-otp"
              value={emailOtp}
              onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`${INPUT} tracking-[0.4em] text-center font-mono`}
              placeholder="000000"
              maxLength={6}
              required
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={addingEmail || emailOtp.length !== 6} className="btn-gold text-sm py-2 px-5">
              {addingEmail ? 'Verifying…' : 'Verify OTP'}
            </button>
            <button type="button" onClick={() => { setAddEmailStep('input'); setEmailOtp(''); }} className="btn-dark text-sm py-2 px-5">Back</button>
          </div>
        </form>
      );
    }
    return (
      <form onSubmit={handleAddEmail} className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <Field
            id="pf-add-email" label="Email Address" icon={FiMail} type="email"
            value={emailForm.email}
            onChange={(e) => setEmailForm({ email: e.target.value })}
            placeholder="you@example.com"
            required
          />
        </div>
        <button type="submit" disabled={addingEmail} className="btn-gold text-sm py-2.5 px-6">
          {addingEmail ? 'Sending OTP…' : 'Add Email'}
        </button>
      </form>
    );
  };

  const renderDetails = () => (
    <div className="space-y-4">
      <form onSubmit={handleUpdateProfile} className="card p-5 sm:p-6">
        <SectionTitle icon={FiUser} title="Personal Details" sub="How we address you and reach you about your orders." />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5 mt-5">
          <Field
            id="pf-firstName" label="First Name" icon={FiUser} autoComplete="given-name" required
            value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
          <Field
            id="pf-lastName" label="Last Name" autoComplete="family-name" required
            value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
          <div>
            <span className="block font-jakarta text-xs font-medium text-dark-300 mb-1.5">Gender</span>
            <div role="radiogroup" aria-label="Gender" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-dark-900/50 border border-white/10">
              {GENDERS.map((g) => {
                const active = form.gender === g.value;
                return (
                  <button
                    key={g.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setForm({ ...form, gender: active ? '' : g.value })}
                    className={`relative py-1.5 rounded-lg font-jakarta text-[13px] transition-colors ${active ? 'text-dark-900 font-semibold' : 'text-dark-300 hover:text-white'}`}
                  >
                    {active && (
                      <motion.span layoutId="pf-gender-pill" className="absolute inset-0 rounded-lg bg-gold-gradient" transition={{ type: 'spring', stiffness: 450, damping: 35 }} />
                    )}
                    <span className="relative">{g.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <Field
            id="pf-phone" label="Phone Number" icon={FiPhone} inputMode="tel" autoComplete="tel" maxLength={15}
            placeholder="10-digit mobile number"
            value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <div className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
            <Field
              id="pf-alternateEmail" label="Alternate Email" icon={FiMail} type="email" autoComplete="email"
              placeholder="Optional — a backup email"
              hint={altSameAsLogin ? 'This is the same as your sign-in email — add a different one or leave it blank.' : ''}
              value={form.alternateEmail} onChange={(e) => setForm({ ...form, alternateEmail: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-white/5 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
          <span className="font-jakarta text-xs flex items-center gap-1.5">
            {dirty
              ? <><span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" /><span className="text-gold-300">Unsaved changes</span></>
              : <><FiCheck size={13} className="text-green-400" /><span className="text-dark-400">All changes saved</span></>}
          </span>
          <div className="flex gap-2">
            <AnimatePresence>
              {dirty && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}
                  onClick={() => setForm(initialForm)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-dark-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Discard
                </motion.button>
              )}
            </AnimatePresence>
            <button type="submit" disabled={saving || !dirty} className="btn-gold text-sm py-2 px-6 flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>

      {/* ADD EMAIL (mobile-registered users) */}
      {profile?.mobile && (
        <div className="card p-5 sm:p-6">
          <SectionTitle icon={FiMail} title="Email Address" sub="For sign-in, order updates and invoices." />
          <div className="mt-4">{renderEmailContent()}</div>
        </div>
      )}
    </div>
  );

  const renderAddrForm = () => (
    <motion.form
      key="addr-form"
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.28 }}
      onSubmit={handleSaveAddress}
      className="overflow-hidden"
    >
      <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-dark-900/40 border border-gold-500/25">
        <p className="font-jakarta text-sm text-white font-medium mb-3">{addrForm.id ? 'Edit Address' : 'New Delivery Address'}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3">
          {ADDR_FIELDS.map(({ name, label, col, ...rest }) => (
            <div key={name} className={col === 2 ? 'sm:col-span-2' : ''}>
              <Field
                id={`addr-${name}`} label={label} {...rest}
                value={addrForm.data[name] ?? ''}
                onChange={(e) => setAddrField(name, e.target.value)}
                required={name !== 'addressLine2'}
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!addrForm.data.isDefault}
          onClick={() => setAddrField('isDefault', !addrForm.data.isDefault)}
          className="mt-4 inline-flex items-center gap-2.5 font-jakarta text-sm text-dark-200"
        >
          <span className={`relative w-9 h-5 rounded-full transition-colors ${addrForm.data.isDefault ? 'bg-gold-500' : 'bg-dark-600'}`}>
            <motion.span
              className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow"
              animate={{ x: addrForm.data.isDefault ? 16 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            />
          </span>
          Set as default address
        </button>
        <div className="flex gap-2 mt-4">
          <button type="submit" disabled={savingAddr} className="btn-gold text-sm py-2 px-6">
            {savingAddr ? 'Saving…' : 'Save Address'}
          </button>
          <button type="button" onClick={() => setAddrForm(null)} className="px-5 py-2 rounded-xl text-sm font-medium text-dark-300 hover:text-white hover:bg-white/5 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </motion.form>
  );

  const renderAddressCard = (addr) => {
    const confirming = confirmDelId === addr._id;
    // Phone is shown only when it differs from the account phone (avoids repeating the same number)
    const showPhone = addr.phone && lastTenDigits(addr.phone) !== accountPhone;
    return (
      <motion.div
        layout
        key={addr._id}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
        className={`relative flex flex-col p-4 rounded-2xl border transition-colors ${
          addr.isDefault
            ? 'border-gold-500/40 bg-gold-500/[0.04] shadow-[0_0_0_1px_rgba(212,175,55,0.1)]'
            : 'border-white/[0.07] bg-dark-900/40 hover:border-white/15'
        }`}
      >
        <div className="flex-1 flex items-start gap-3">
          <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${addr.isDefault ? 'bg-gold-500/15 text-gold-400' : 'bg-white/5 text-dark-400'}`}>
            <FiMapPin size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-jakarta text-white text-sm font-semibold truncate">{addr.fullName}</p>
              {addr.isDefault && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gold-500/15 text-gold-400 text-[10px] font-semibold uppercase tracking-wider">
                  <FiStar size={9} /> Default
                </span>
              )}
            </div>
            <p className="font-jakarta text-dark-300 text-xs leading-relaxed mt-1">
              {addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''}
              <br />
              {addr.city}, {addr.state} — <span className="text-white/90 font-medium tracking-wide">{addr.pincode}</span>
            </p>
            {showPhone && (
              <p className="font-jakarta text-dark-500 text-xs mt-1 flex items-center gap-1.5"><FiPhone size={11} /> {addr.phone}</p>
            )}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-white/5 min-h-[30px] flex items-center">
          <AnimatePresence mode="wait" initial={false}>
            {confirming ? (
              <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 w-full">
                <span className="font-jakarta text-xs text-red-300 mr-auto">Remove this address?</span>
                <button type="button" onClick={() => setConfirmDelId(null)} className="px-2.5 py-1 rounded-lg text-xs text-dark-300 hover:text-white hover:bg-white/5">Keep</button>
                <button type="button" onClick={() => handleDeleteAddress(addr._id)} className="px-2.5 py-1 rounded-lg text-xs font-semibold text-red-300 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20">Remove</button>
              </motion.div>
            ) : (
              <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1 w-full font-jakarta text-xs">
                <button type="button" onClick={() => openEditForm(addr)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-dark-300 hover:text-gold-400 hover:bg-white/5 transition-colors">
                  <FiEdit3 size={12} /> Edit
                </button>
                {!addr.isDefault && (
                  <button type="button" onClick={() => handleSetDefault(addr)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-dark-300 hover:text-gold-400 hover:bg-white/5 transition-colors">
                    <FiStar size={12} /> Set default
                  </button>
                )}
                <button type="button" onClick={() => setConfirmDelId(addr._id)} aria-label="Remove address" className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-dark-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <FiTrash2 size={12} /> Remove
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  const renderAddresses = () => (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle icon={FiMapPin} title="Address Book" sub="Saved addresses make checkout faster." />
        {!addrForm && (
          <button
            type="button"
            onClick={openAddForm}
            className="flex-shrink-0 inline-flex items-center gap-1.5 text-sm font-medium text-gold-400 hover:text-dark-900 bg-gold-500/10 hover:bg-gold-500 border border-gold-500/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            <FiPlus size={14} /> Add New
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>{addrForm && renderAddrForm()}</AnimatePresence>

      {addresses.length === 0 && !addrForm ? (
        <EmptyState icon={FiMapPin} text="No saved addresses yet.">
          <button type="button" onClick={openAddForm} className="mt-3 text-sm text-gold-400 hover:text-gold-300 inline-flex items-center gap-1">
            <FiPlus size={13} /> Add your first address
          </button>
        </EmptyState>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <AnimatePresence initial={false}>{addresses.map(renderAddressCard)}</AnimatePresence>
        </motion.div>
      )}
    </div>
  );

  const renderSavedItem = (product) => {
    const outOfStock = product.stock === 0;
    return (
      <motion.div
        layout
        key={product._id}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className="group relative flex flex-col rounded-2xl overflow-hidden border border-white/[0.07] bg-dark-900/40 hover:border-gold-500/30 transition-colors"
      >
        <Link to={`/products/${product._id}`} className="relative block aspect-[3/2] overflow-hidden bg-dark-900">
          <img
            src={resolveImageUrl(product?.images?.[0]?.url)}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-dark-900/70 to-transparent" />
        </Link>
        <button
          type="button"
          onClick={() => handleRemoveWishlist(product._id)}
          title="Remove from saved"
          aria-label={`Remove ${product.name} from saved items`}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-dark-900/75 backdrop-blur border border-white/10 text-gold-400 hover:text-red-400 hover:border-red-500/40 flex items-center justify-center transition-colors"
        >
          <FiHeart size={14} fill="currentColor" />
        </button>
        <div className="p-3.5 flex flex-col flex-1">
          <p className="font-jakarta text-dark-500 text-[10px] uppercase tracking-[0.15em] truncate">
            {[product.material, product.type].filter(Boolean).join(' · ')}
          </p>
          <Link to={`/products/${product._id}`} className="font-jakarta text-white text-sm font-medium mt-1 truncate hover:text-gold-400 transition-colors">
            {product.name}
          </Link>
          <div className="mt-auto pt-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-gold-400 font-semibold text-sm">{formatPrice(product.discountedPrice || product.price)}</span>
              {product.discountedPrice && <span className="ml-1.5 text-dark-500 text-[11px] line-through">{formatPrice(product.price)}</span>}
            </div>
            <button
              type="button"
              onClick={() => handleAddToCart(product)}
              disabled={outOfStock}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-500/10 text-gold-400 hover:bg-gold-500 hover:text-dark-900 text-xs font-semibold transition-colors disabled:opacity-50 disabled:hover:bg-gold-500/10 disabled:hover:text-gold-400 disabled:cursor-not-allowed"
            >
              <FiShoppingBag size={12} /> {outOfStock ? 'Sold out' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderSaved = () => (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle icon={FiHeart} title="Saved Items" sub="Pieces you’ve kept an eye on." />
        <Link to="/shop" className="flex-shrink-0 font-jakarta text-xs text-dark-400 hover:text-gold-400 inline-flex items-center gap-1 transition-colors">
          Browse collection <FiChevronRight size={12} />
        </Link>
      </div>
      {wishlist.length > 0 ? (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          <AnimatePresence initial={false}>{wishlist.map(renderSavedItem)}</AnimatePresence>
        </motion.div>
      ) : (
        <EmptyState icon={FiHeart} text="Your wishlist is empty.">
          <Link to="/shop" className="mt-3 text-sm text-gold-400 hover:text-gold-300 inline-flex items-center gap-1">
            Explore the collection <FiChevronRight size={13} />
          </Link>
        </EmptyState>
      )}
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen pt-24 pb-20 bg-dark-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(55%_100%_at_50%_0%,rgba(212,175,55,0.07),transparent_70%)]" aria-hidden="true" />
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-5">
          <p className="font-jakarta text-[11px] font-semibold tracking-[0.3em] text-gold-500 uppercase mb-2">My Account</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-white leading-tight pt-0">My Profile</h1>
          <GoldOrnament className="mt-3" />
        </div>

        {/* Identity card */}
        <motion.section
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="card relative p-5 sm:p-6"
        >
          <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full bg-gold-500/[0.08] blur-3xl" aria-hidden="true" />
          <FacetMark className="pointer-events-none absolute right-[330px] top-1/2 -translate-y-1/2 w-32 h-28 text-gold-500/[0.07] hidden lg:block" />

          <div className="relative flex flex-col md:flex-row md:items-center gap-5">
            <div className="flex items-center gap-4 sm:gap-5 min-w-0 flex-1">
              <CompletionAvatar initial={displayName.charAt(0).toUpperCase()} pct={completion} />
              <div className="min-w-0">
                <h2 className="font-serif text-2xl sm:text-[1.7rem] text-white font-semibold leading-tight pt-0 truncate">{displayName}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 font-jakarta text-xs text-dark-400">
                  {profile?.email && (
                    <span className="inline-flex items-center gap-1.5 min-w-0"><FiMail size={12} className="text-gold-500/80 flex-shrink-0" /><span className="truncate">{profile.email}</span></span>
                  )}
                  {profile?.mobile && (
                    <span className="inline-flex items-center gap-1.5"><FiPhone size={12} className="text-gold-500/80" />{profile.mobile}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2.5 font-jakarta text-[11px]">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/25 text-green-400">
                    <FiShield size={10} /> {profile?.isVerified ? 'Verified' : 'Active'}
                  </span>
                  {memberSince && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-dark-300">
                      <FiCalendar size={10} /> Member since {memberSince}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 md:w-[300px] flex-shrink-0">
              <StatTile icon={FiMapPin} value={counts.addresses} label="Addresses" onClick={() => setTab('addresses')} />
              <StatTile icon={FiHeart} value={counts.saved} label="Saved" onClick={() => setTab('saved')} />
              <StatTile icon={FiPackage} value="View" label="My Orders" to="/orders" />
            </div>
          </div>

          {missing.length > 0 && (
            <div className="relative mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center gap-2 font-jakarta">
              <span className="text-xs text-dark-400 mr-1">Complete your profile:</span>
              {missing.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => goToMissing(m)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-gold-500/40 text-gold-400 text-xs hover:bg-gold-500/10 hover:border-gold-500/70 transition-colors"
                >
                  <FiPlus size={11} /> {m.label}
                </button>
              ))}
            </div>
          )}
        </motion.section>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Profile sections"
          className="mt-5 mb-4 flex sm:inline-flex w-full sm:w-auto p-1 rounded-xl bg-dark-800/80 border border-white/[0.06]"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            const count = counts[t.id];
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={active}
                aria-controls="profile-panel"
                onClick={() => setTab(t.id)}
                className={`relative flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-jakarta text-[13px] font-medium transition-colors ${
                  active ? 'text-gold-300' : 'text-dark-400 hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="pf-tab-pill"
                    className="absolute inset-0 rounded-lg bg-gold-500/[0.12] border border-gold-500/30"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  />
                )}
                <Icon size={14} className="relative" />
                <span className="relative hidden sm:inline">{t.label}</span>
                <span className="relative sm:hidden">{t.short}</span>
                {count !== undefined && (
                  <span className={`relative min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center ${
                    active ? 'bg-gold-500 text-dark-900' : 'bg-white/10 text-dark-300'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Active panel */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            id="profile-panel"
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {tab === 'details' && renderDetails()}
            {tab === 'addresses' && renderAddresses()}
            {tab === 'saved' && renderSaved()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
