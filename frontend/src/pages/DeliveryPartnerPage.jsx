import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  FiTruck, FiCheckCircle, FiSearch, FiRefreshCw,
  FiMapPin, FiPhone, FiUser, FiAlertCircle, FiDownload, FiX,
  FiCreditCard, FiActivity, FiLogOut, FiNavigation, FiPackage, FiClock, FiInbox,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { deliveryService } from '../services/services';
import { downloadInvoice, downloadCustomOrderInvoice } from '../utils/invoice';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, logoutUser } from '../store/authSlice';
import api from '../services/api';
import toast from 'react-hot-toast';

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function maskId(uuid) {
  if (!uuid) return null;
  return `MB-${uuid.replaceAll('-', '').slice(-8).toUpperCase()}`;
}

/** "tel:" link for an Indian mobile — bare 10-digit numbers get the +91 prefix. */
function telHref(phone) {
  const digits = String(phone || '').replaceAll(/[^\d+]/g, '');
  if (!digits) return null;
  if (/^[6-9]\d{9}$/.test(digits)) return `tel:+91${digits}`;
  return `tel:${digits}`;
}

/**
 * Google Maps directions to the delivery address. Origin is left empty so Maps starts from the
 * phone's live GPS position. The destination is written in the standard Indian postal format
 * ("…, City, State PIN, India") — keeping the PIN next to the state and adding the country lets
 * Google pin the right locality instead of a same-named street elsewhere.
 */
function mapsHref(address) {
  if (!address) return null;
  const clean = (s) => String(s || '').trim().replaceAll(/\s+/g, ' ');
  const statePin = [clean(address.state), clean(address.pincode)].filter(Boolean).join(' ');
  const parts = [address.addressLine1, address.addressLine2, address.city].map(clean).filter(Boolean);
  if (!parts.length && !statePin) return null;
  const destination = [...parts, statePin, 'India'].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function normalise(raw, type) {
  if (type === 'order') {
    return {
      _id: raw._id, _source: 'order',
      displayId: raw.orderId || maskId(raw.deliveryId) || raw._id,
      customer: raw.user,
      address:  raw.shippingAddress,
      items:    raw.items,
      total:    raw.totalAmount,
      rawStatus: raw.orderStatus,
      deliveryAgent: raw.deliveryAgent,
      dpConfirmedAt: raw.dpConfirmedAt,
      dpNote: raw.dpNote,
      createdAt: raw.createdAt,
      _raw: raw,
    };
  }
  return {
    _id: raw._id, _source: 'custom_order',
    displayId: raw.customOrderId || maskId(raw.deliveryId) || raw._id,
    customer: raw.user,
    address:  raw.shippingAddress,
    items:    [{ name: `Custom ${raw.type} — ${raw.material}${raw.purity && raw.purity !== 'None' ? ` (${raw.purity})` : ''}`, quantity: 1, price: raw.totalAmount }],
    total:    raw.totalAmount,
    rawStatus: raw.status,
    deliveryAgent: raw.deliveryAgent,
    dpConfirmedAt: raw.dpConfirmedAt,
    dpNote: raw.dpNote,
    createdAt: raw.createdAt,
    _raw: raw,
  };
}

const STATUS_DISPLAY = {
  confirmed: 'In Progress', in_production: 'In Progress', ready_to_ship: 'In Progress',
  advance_paid: 'In Progress', final_payment_pending: 'In Progress', final_payment_paid: 'In Progress',
  quoted: 'In Progress',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

const STAGE_META = {
  'In Progress': { color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',    dot: 'bg-amber-400',   border: 'border-l-amber-500' },
  'Shipped':     { color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',      dot: 'bg-blue-400',    border: 'border-l-blue-500'  },
  'Delivered':   { color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20',dot: 'bg-emerald-400', border: 'border-l-emerald-500'},
};

/** Close a modal with the Escape key. */
function useEscape(onEscape) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onEscape(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEscape]);
}

/* ── Live Clock ──────────────────────────────────────────────────────────────── */

/** Compact date + time strip shown under the header on every screen size. */
function LiveClock() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = String(time.getHours()).padStart(2, '0');
  const mm = String(time.getMinutes()).padStart(2, '0');
  const ss = String(time.getSeconds()).padStart(2, '0');
  const dateStr = time.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="flex items-center justify-between gap-3 text-[11px] leading-none" aria-hidden="true">
      <span className="flex items-center gap-1.5 text-dark-400 whitespace-nowrap">
        <FiClock size={11} className="text-gold-500/70" /> {dateStr}
      </span>
      <span className="font-mono font-semibold text-gold-400 tabular-nums tracking-wider whitespace-nowrap">
        {hh}<span className="opacity-60">:</span>{mm}<span className="opacity-60">:</span>{ss}
      </span>
    </div>
  );
}

/* ── Small UI pieces ─────────────────────────────────────────────────────────── */

function Field({ label, value, mono, href }) {
  return (
    <div className="space-y-0.5 min-w-0">
      <p className="text-[10px] text-dark-500 uppercase tracking-widest font-medium">{label}</p>
      {href && value ? (
        <a href={href} className={`inline-flex items-center gap-1.5 text-sm text-gold-300 hover:text-gold-200 underline-offset-2 hover:underline ${mono ? 'font-mono' : ''}`}>
          <FiPhone size={12} className="shrink-0" /> {value}
        </a>
      ) : (
        <p className={`text-sm text-white break-words ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
      )}
    </div>
  );
}
Field.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.string, mono: PropTypes.bool, href: PropTypes.string };

/** Big tap target to call a number — works on any phone, shows the number on desktop. */
function CallButton({ phone, label = 'Call' }) {
  const href = telHref(phone);
  if (!href) return null;
  return (
    <a
      href={href}
      aria-label={`${label} ${phone}`}
      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 sm:py-2 text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 active:scale-[0.97] transition-all"
    >
      <FiPhone size={13} /> {label}
    </a>
  );
}
CallButton.propTypes = { phone: PropTypes.string, label: PropTypes.string };

function CardSkeleton() {
  return (
    <div className="bg-dark-800 border border-white/5 border-l-4 border-l-dark-600 rounded-xl p-4 space-y-3 animate-pulse">
      <div className="flex justify-between"><div className="space-y-2"><div className="h-2.5 w-24 bg-dark-700 rounded" /><div className="h-3.5 w-32 bg-dark-700 rounded" /></div><div className="h-6 w-20 bg-dark-700 rounded-full" /></div>
      <div className="h-16 bg-dark-900/60 rounded-lg" />
      <div className="h-12 bg-dark-900/60 rounded-lg" />
    </div>
  );
}

/* ── Profile Modal (centered) ────────────────────────────────────────────────── */

function ProfileModal({ onClose }) {
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({ name: '', gender: '', phone: '' });

  // Escape mirrors the header X: leaves edit mode first, then closes
  const handleEscape = useCallback(() => (editing ? setEditing(false) : onClose()), [editing, onClose]);
  useEscape(handleEscape);

  useEffect(() => {
    api.get('/dp-auth/profile')
      .then(r => {
        const p = r.data.profile;
        if (!p) { setLoading(false); return; }
        setProfile(p);
        setForm({ name: p.name || '', gender: p.gender || '', phone: p.phone || '' });
      })
      .catch(err => {
        console.error('DP profile load failed:', err?.response?.status, err?.response?.data?.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const startEdit = () => {
    setForm({ name: profile.name || '', gender: profile.gender || '', phone: profile.phone || '' });
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.patch('/dp-auth/profile', { name: form.name, gender: form.gender, phone: form.phone });
      setProfile(prev => ({ ...prev, name: form.name, gender: form.gender, phone: form.phone }));
      setEditing(false);
      toast.success('Profile updated');
    } catch (err) {
      // Previously swallowed — the partner had no idea why "Save" did nothing
      toast.error(err?.response?.data?.message || 'Could not save changes');
    }
    setSaving(false);
  };

  const genderLabel = { male: 'Male', female: 'Female', other: 'Other' };
  const inputCls = 'w-full bg-dark-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold-500/40 focus:ring-1 focus:ring-gold-500/20 transition-colors';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4 sm:py-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal — bottom sheet on phones, centred card from sm up */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dp-profile-title"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="relative w-full sm:max-w-md max-h-[90dvh] flex flex-col bg-dark-900 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-dark-800/60 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center">
              <FiUser size={14} className="text-gold-400" />
            </div>
            <span id="dp-profile-title" className="text-white font-semibold text-sm">{editing ? 'Edit Profile' : 'My Profile'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {!loading && profile && !editing && (
              <button
                type="button"
                onClick={startEdit}
                className="px-3 py-1.5 rounded-lg text-xs text-gold-400 border border-gold-500/20 hover:bg-gold-500/10 transition-colors"
              >
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={editing ? cancelEdit : onClose}
              aria-label={editing ? 'Cancel editing' : 'Close profile'}
              className="p-2 rounded-lg hover:bg-white/5 text-dark-400 hover:text-white transition-colors"
            >
              <FiX size={16} />
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]" data-lenis-prevent="true">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, n) => (
                <div key={n} className="space-y-1.5">
                  <div className="h-2.5 w-20 bg-dark-700 rounded animate-pulse" />
                  <div className="h-4 w-36 bg-dark-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : profile ? (
            <div className="p-5 space-y-5">
              {/* Avatar + identity */}
              <div className="flex items-center gap-4 pb-4 border-b border-white/[0.08]">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-500/20 to-gold-700/10 border border-gold-500/20 flex items-center justify-center text-2xl font-bold text-gold-400 shrink-0">
                  {(editing ? form.name : profile.name)?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-base truncate">{editing ? form.name || '—' : profile.name}</p>
                  <p className="text-dark-500 text-xs mt-0.5 truncate">{profile.email}</p>
                  <span className="inline-flex items-center gap-1 mt-1.5 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <FiActivity size={10} /> Active Partner
                  </span>
                </div>
              </div>

              {editing ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="dp-edit-name" className="text-[10px] text-dark-500 uppercase tracking-widest font-medium">Name</label>
                    <input
                      id="dp-edit-name"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      maxLength={50}
                      autoComplete="name"
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="dp-edit-gender" className="text-[10px] text-dark-500 uppercase tracking-widest font-medium">Gender</label>
                    <select
                      id="dp-edit-gender"
                      value={form.gender}
                      onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">Not specified</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="dp-edit-phone" className="text-[10px] text-dark-500 uppercase tracking-widest font-medium">Mobile Number</label>
                    <input
                      id="dp-edit-phone"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="10-digit mobile number"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex-1 py-2.5 rounded-xl bg-dark-700 text-dark-300 text-sm hover:bg-dark-600 transition-colors"
                    >Cancel</button>
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={saving || !form.name.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
                    >{saving ? 'Saving…' : 'Save Changes'}</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-x-6 gap-y-4">
                  <div className="min-[400px]:col-span-2">
                    <Field label="Partner ID" value={profile.partnerId} mono />
                  </div>
                  <Field label="Email Address" value={profile.email} />
                  <Field label="Gender" value={genderLabel[profile.gender] || profile.gender} />
                  <Field label="Mobile Number" value={profile.phone} href={telHref(profile.phone)} />
                  <Field label="Vehicle Number" value={profile.vehicleNumber} mono />
                  <Field label="Dispatch Zone" value={profile.dispatchZone} />
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-dark-500 uppercase tracking-widest font-medium">Aadhaar Number</p>
                    <div className="flex items-center gap-2">
                      <FiCreditCard size={13} className="text-dark-500 shrink-0" />
                      <p className="text-sm text-white font-mono">{profile.aadhaarMasked || '—'}</p>
                    </div>
                  </div>
                </div>
              )}

              {!editing && (
                <div className="pt-4 border-t border-white/[0.08]">
                  <p className="text-xs text-dark-600">
                    Member since {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-dark-500 text-sm">Failed to load profile.</div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

ProfileModal.propTypes = { onClose: PropTypes.func.isRequired };

/* ── PDF Invoice ─────────────────────────────────────────────────────────────── */

// Same tax invoice the customer and admin download — issued once the order is paid
const dpInvoiceReady = (item) => !!item._raw?.invoiceNumber || (item._source === 'order' && item._raw?.payment?.status === 'paid');
function printDpInvoice(item) {
  if (item._source === 'order') downloadInvoice(item._raw);
  else downloadCustomOrderInvoice(item._raw);
}

/* ── Confirm Modal ───────────────────────────────────────────────────────────── */

function ConfirmModal({ onConfirm, onClose, title, message }) {
  useEscape(onClose);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dp-confirm-title"
        initial={{ scale: 0.92, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 12 }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
          <FiCheckCircle size={20} className="text-emerald-400" />
        </div>
        <h3 id="dp-confirm-title" className="text-white font-semibold text-lg mb-2">{title}</h3>
        <p className="text-dark-400 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-dark-700 text-dark-300 text-sm hover:bg-dark-600 transition-colors">Cancel</button>
          <button type="button" onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors">Confirm</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

ConfirmModal.propTypes = {
  onConfirm: PropTypes.func.isRequired,
  onClose:   PropTypes.func.isRequired,
  title:     PropTypes.string.isRequired,
  message:   PropTypes.string.isRequired,
};

/* ── Delivery Card ───────────────────────────────────────────────────────────── */

function DeliveryCard({ item, onConfirm }) {
  const status = STATUS_DISPLAY[item.rawStatus] || 'In Progress';
  const meta   = STAGE_META[status];
  const [confirmInput, setConfirmInput] = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [noteInput, setNoteInput]       = useState('');
  const [busy, setBusy]                 = useState(false);

  const handleConfirmClick = () => {
    if (confirmInput.trim() !== 'DELIVERED') return;
    setShowModal(true);
  };

  const handleFinalConfirm = async () => {
    setShowModal(false);
    setBusy(true);
    await onConfirm(item._id, item._source, noteInput);
    setBusy(false);
    setConfirmInput('');
    setNoteInput('');
  };

  const addr = item.address || {};
  const recipientName  = addr.fullName || item.customer?.name;
  const recipientPhone = addr.phone || item.customer?.phone;
  // Account phone shown separately only when it differs from the delivery contact
  const accountPhone   = item.customer?.phone && item.customer.phone !== addr.phone ? item.customer.phone : null;
  const directions     = mapsHref(addr);
  const inputId        = `dp-confirm-${item._source}-${item._id}`;

  return (
    <>
      <AnimatePresence>
        {showModal && (
          <ConfirmModal
            title="Confirm Delivery"
            message="This will notify the admin that you have delivered this order. Admin must do a final confirmation."
            onConfirm={handleFinalConfirm}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>

      <motion.div
        layout
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        className={`bg-dark-800 border ${meta.bg} border-l-4 ${meta.border} rounded-xl p-4 space-y-3`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-dark-500 font-mono truncate">{item.displayId}</p>
            <p className="text-white font-semibold text-sm mt-0.5 truncate">{item.customer?.name || recipientName || '—'}</p>
          </div>
          <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${meta.bg} ${meta.color} flex items-center gap-1.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            {status}
          </span>
        </div>

        {/* Deliver to */}
        <div className="rounded-lg bg-dark-900/60 border border-white/5 p-3 space-y-2.5">
          <div className="flex items-start gap-2 text-xs">
            <FiMapPin size={13} className="mt-0.5 shrink-0 text-gold-500/80" />
            <div className="min-w-0 text-dark-300 leading-relaxed">
              {recipientName && <p className="text-white font-medium">{recipientName}</p>}
              <p className="break-words">
                {[addr.addressLine1, addr.addressLine2].filter(Boolean).join(', ')}
                {(addr.city || addr.state || addr.pincode) && <br />}
                {[addr.city, addr.state].filter(Boolean).join(', ')}
                {addr.pincode && <span className="text-white font-medium tabular-nums">{` – ${addr.pincode}`}</span>}
              </p>
            </div>
          </div>

          {recipientPhone && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <FiPhone size={13} className="shrink-0 text-gold-500/80" />
              <a href={telHref(recipientPhone)} className="text-gold-300 hover:text-gold-200 font-medium tabular-nums hover:underline underline-offset-2">
                {recipientPhone}
              </a>
              {accountPhone && (
                <span className="text-dark-500">
                  · Account <a href={telHref(accountPhone)} className="text-dark-300 hover:text-gold-300 tabular-nums">{accountPhone}</a>
                </span>
              )}
            </div>
          )}

          {(recipientPhone || directions) && (
            <div className="flex gap-2 pt-0.5">
              {recipientPhone && <CallButton phone={recipientPhone} label="Call" />}
              {directions && (
                <a
                  href={directions}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 sm:py-2 text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 active:scale-[0.97] transition-all"
                >
                  <FiNavigation size={13} /> Directions
                </a>
              )}
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-dark-900/60 rounded-lg p-2.5 space-y-1">
          {item.items?.map((it, idx) => (
            <div key={`${it.name}-${idx}`} className="flex justify-between gap-2 text-xs">
              <span className="text-dark-300 truncate">{it.name} {it.quantity > 1 ? `×${it.quantity}` : ''}</span>
              <span className="text-dark-500 shrink-0 tabular-nums">{inr(it.price)}</span>
            </div>
          ))}
          <div className="flex justify-between text-xs pt-1 border-t border-white/5 mt-1">
            <span className="text-dark-400">Total</span>
            <span className="text-gold-400 font-semibold tabular-nums">{inr(item.total)}</span>
          </div>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-dark-600"><FiClock size={11} /> {fmt(item.createdAt)}</p>

        {/* DP confirmed indicator */}
        {item.dpConfirmedAt && status !== 'Delivered' && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-xs text-emerald-400">
            <FiCheckCircle size={12} className="shrink-0" />
            <span>You marked delivered · awaiting admin confirmation</span>
          </div>
        )}

        {/* Actions */}
        {status === 'Shipped' && !item.dpConfirmedAt && (
          <div className="space-y-2 pt-2 border-t border-white/5">
            <label htmlFor={inputId} className="block text-xs text-dark-500">
              Type <span className="text-white font-mono">DELIVERED</span> to confirm delivery:
            </label>
            <input
              id={inputId}
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="DELIVERED"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono tracking-wider text-white placeholder-dark-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Delivery note (optional)"
              aria-label="Delivery note (optional)"
              rows={2}
              className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-white/20 resize-none transition-colors"
            />
            <button
              type="button"
              onClick={handleConfirmClick}
              disabled={busy || confirmInput.trim() !== 'DELIVERED'}
              className="w-full py-2.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-600/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {busy ? <FiRefreshCw size={13} className="animate-spin" /> : <FiCheckCircle size={14} />} Confirm Delivery
            </button>
          </div>
        )}

        {/* PDF Invoice */}
        {dpInvoiceReady(item) && <div className="pt-1 border-t border-white/5 flex justify-end">
          <button
            type="button"
            onClick={() => printDpInvoice(item)}
            className="flex items-center gap-1.5 text-xs text-gold-400 bg-gold-500/10 border border-gold-500/20 hover:bg-gold-500/20 rounded-lg px-3 py-2 transition-colors"
          >
            <FiDownload size={11} /> Invoice PDF
          </button>
        </div>}
      </motion.div>
    </>
  );
}

DeliveryCard.propTypes = {
  item: PropTypes.shape({
    _id:           PropTypes.string.isRequired,
    _source:       PropTypes.string.isRequired,
    rawStatus:     PropTypes.string,
    displayId:     PropTypes.string,
    deliveryAgent: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    customer:      PropTypes.shape({ name: PropTypes.string, phone: PropTypes.string }),
    address:       PropTypes.shape({
      fullName: PropTypes.string, phone: PropTypes.string,
      addressLine1: PropTypes.string, addressLine2: PropTypes.string,
      city: PropTypes.string, state: PropTypes.string, pincode: PropTypes.string,
    }),
    items:         PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string, quantity: PropTypes.number, price: PropTypes.number })),
    total:         PropTypes.number,
    createdAt:     PropTypes.string,
    dpConfirmedAt: PropTypes.string,
  }).isRequired,
  onConfirm:      PropTypes.func.isRequired,
};

/* ── Main Page ───────────────────────────────────────────────────────────────── */

export default function DeliveryPartnerPage() {
  const user     = useSelector(selectUser);
  const dispatch = useDispatch();

  const [items, setItems]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilter]     = useState('Shipped');
  const [showProfile, setShowProfile] = useState(false);
  const [loggingOut, setLoggingOut]   = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const intervalRef                   = useRef(null);

  useEffect(() => { document.title = 'My Deliveries — M.B. JEWELLERS'; }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await deliveryService.getMyDeliveries();
      const orders  = (res.data.orders || []).map((o) => normalise(o, 'order'));
      const customs = (res.data.customOrders || []).map((o) => normalise(o, 'custom_order'));
      const merged  = [...orders, ...customs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setItems(merged);
      setError('');
    } catch {
      setError('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(true), 30000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await dispatch(logoutUser());
    setLoggingOut(false);
  };

  const handleConfirm = async (id, source, note) => {
    try {
      await deliveryService.confirmDelivery(id, { source, note });
      await load(true);
      toast.success('Delivery confirmed — awaiting admin approval');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Confirmation failed';
      toast.error(msg);
    }
  };

  const filtered = items
    .filter((item) => {
      const display = STATUS_DISPLAY[item.rawStatus] || 'In Progress';
      const matchStatus = filterStatus === 'all' || display === filterStatus;
      const q = search.toLowerCase();
      const matchSearch = !q ||
        item.displayId?.toLowerCase().includes(q) ||
        item.customer?.name?.toLowerCase().includes(q) ||
        item.address?.city?.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    })
    .sort((a, b) => {
      const aWaiting = !!(a.dpConfirmedAt && (STATUS_DISPLAY[a.rawStatus] || 'In Progress') === 'Shipped');
      const bWaiting = !!(b.dpConfirmedAt && (STATUS_DISPLAY[b.rawStatus] || 'In Progress') === 'Shipped');
      if (aWaiting !== bWaiting) return aWaiting ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const counts = {
    'Shipped':   items.filter((i) => STATUS_DISPLAY[i.rawStatus] === 'Shipped').length,
    'Delivered': items.filter((i) => STATUS_DISPLAY[i.rawStatus] === 'Delivered').length,
  };

  const statBtns = [
    ['Shipped',   counts['Shipped'],   'text-blue-400',    'bg-blue-500/10 border-blue-500/20',      'ring-blue-500/30',    <FiTruck key="i" size={16} />,       'To deliver'],
    ['Delivered', counts['Delivered'], 'text-emerald-400', 'bg-emerald-500/10 border-emerald-500/20','ring-emerald-500/30', <FiCheckCircle key="i" size={16} />, 'Completed'],
  ];

  const renderDeliveryList = () => {
    if (loading) {
      return (
        <div className="space-y-3" aria-busy="true" aria-label="Loading deliveries">
          <CardSkeleton /><CardSkeleton />
        </div>
      );
    }
    if (error) {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3 text-red-400 text-sm py-12 text-center">
          <span className="flex items-center gap-2"><FiAlertCircle size={16} /> {error}</span>
          <button type="button" onClick={() => load()} className="px-4 py-2 rounded-lg border border-white/10 text-dark-300 hover:text-white hover:bg-white/5 text-xs transition-colors">
            Try again
          </button>
        </motion.div>
      );
    }
    if (filtered.length === 0) {
      return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center py-14 text-dark-500 text-sm">
          <span className="w-12 h-12 rounded-2xl bg-dark-800 border border-white/5 flex items-center justify-center mb-3">
            {items.length === 0 ? <FiPackage size={20} /> : <FiInbox size={20} />}
          </span>
          {items.length === 0 ? 'No deliveries assigned yet.' : 'No results match your filter.'}
          {items.length > 0 && (search || filterStatus !== 'all') && (
            <button type="button" onClick={() => { setSearch(''); setFilter('all'); }} className="mt-3 text-xs text-gold-400 hover:text-gold-300">
              Show all deliveries
            </button>
          )}
        </motion.div>
      );
    }
    return (
      <motion.div layout className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((item) => (
            <DeliveryCard
              key={`${item._source}-${item._id}`}
              item={item}
              onConfirm={handleConfirm}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-dark-950 text-white">
      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-dark-900/80 backdrop-blur-md border-b border-white/10 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-full bg-gold-gradient flex items-center justify-center shadow-gold">
              <span className="text-dark-900 font-bold text-[10px] font-serif tracking-tight leading-none">MB</span>
            </div>
            <div className="min-w-0">
              <h1 className="font-jakarta text-white font-semibold text-sm leading-tight pt-0 truncate">My Deliveries</h1>
              <p className="text-dark-500 text-xs truncate">{user?.name} · Partner</p>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowProfile(true)}
              title="My Profile"
              aria-label="My profile"
              className="p-2.5 rounded-lg hover:bg-white/5 text-dark-400 hover:text-gold-400 transition-colors"
            >
              <FiUser size={17} />
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh"
              aria-label="Refresh deliveries"
              className="p-2.5 rounded-lg hover:bg-white/5 text-dark-400 hover:text-white transition-colors disabled:opacity-60"
            >
              <FiRefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              title="Logout"
              aria-label="Log out"
              className="p-2.5 rounded-lg hover:bg-red-500/10 text-dark-400 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              <FiLogOut size={17} />
            </button>
          </div>
        </div>
        <div className="max-w-4xl mx-auto mt-2.5 pt-2 border-t border-white/[0.06]">
          <LiveClock />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          {statBtns.map(([label, count, textCls, bgCls, ringCls, icon, hint]) => (
            <motion.button
              type="button"
              key={label}
              onClick={() => setFilter(filterStatus === label ? 'all' : label)}
              whileTap={{ scale: 0.97 }}
              aria-pressed={filterStatus === label}
              className={`
                border rounded-xl p-3 sm:p-4 w-full flex items-center gap-3 text-left
                transition-all duration-200 ease-out
                ${bgCls}
                ${filterStatus === label ? `ring-2 ${ringCls} shadow-lg` : 'hover:brightness-110'}
              `}
            >
              <span className={`hidden min-[360px]:flex w-9 h-9 shrink-0 rounded-lg bg-dark-900/40 items-center justify-center ${textCls}`}>
                {icon}
              </span>
              <span className="min-w-0">
                <span className={`block text-xl sm:text-2xl font-bold font-jakarta leading-none tabular-nums ${textCls}`}>{count}</span>
                <span className="block text-xs text-dark-400 mt-1 truncate">{label}<span className="hidden sm:inline text-dark-600"> · {hint}</span></span>
              </span>
            </motion.button>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, name, city"
              aria-label="Search deliveries"
              enterKeyHint="search"
              className="w-full bg-dark-800 border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-gold-500/30 transition-colors [&::-webkit-search-cancel-button]:hidden"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-dark-500 hover:text-white"
              >
                <FiX size={13} />
              </button>
            )}
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter by status"
            className="bg-dark-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold-500/30 transition-colors"
          >
            <option value="all">All</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
          </select>
        </div>

        {/* Delivery list */}
        {renderDeliveryList()}

        <p className="text-center text-[11px] text-dark-600 pt-2">Auto-refreshes every 30 seconds</p>
      </main>
    </div>
  );
}
