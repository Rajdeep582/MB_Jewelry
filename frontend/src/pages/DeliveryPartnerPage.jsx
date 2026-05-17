import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  FiPackage, FiTruck, FiCheckCircle, FiSearch, FiRefreshCw,
  FiMapPin, FiPhone, FiUser, FiAlertCircle, FiDownload, FiX,
  FiCreditCard, FiActivity, FiLogOut,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { deliveryService } from '../services/services';
import { downloadInvoice } from '../utils/invoice';
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

/* ── Live Clock ──────────────────────────────────────────────────────────────── */

function LiveClock() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = String(time.getHours()).padStart(2, '0');
  const mm = String(time.getMinutes()).padStart(2, '0');
  const ss = String(time.getSeconds()).padStart(2, '0');
  const dateStr = time.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <div className="flex flex-col items-end">
      <div className="font-mono text-lg font-bold text-gold-400 leading-none tracking-wider tabular-nums">
        {hh}<span className="opacity-60 animate-pulse">:</span>{mm}<span className="opacity-60 animate-pulse">:</span>{ss}
      </div>
      <div className="text-xs text-dark-500 mt-0.5">{dateStr}</div>
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
    } catch { /* silent */ }
    setSaving(false);
  };

  const Field = ({ label, value, mono }) => (
    <div className="space-y-0.5">
      <p className="text-[10px] text-dark-500 uppercase tracking-widest font-medium">{label}</p>
      <p className={`text-sm text-white ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );
  Field.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.string, mono: PropTypes.bool };

  const genderLabel = { male: 'Male', female: 'Female', other: 'Other' };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.93, opacity: 0, y: 16 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="relative w-full max-w-md bg-dark-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-dark-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center">
              <FiUser size={14} className="text-gold-400" />
            </div>
            <span className="text-white font-semibold text-sm">My Profile</span>
          </div>
          <div className="flex items-center gap-1.5">
            {!loading && profile && !editing && (
              <button
                onClick={startEdit}
                className="px-3 py-1.5 rounded-lg text-xs text-gold-400 border border-gold-500/20 hover:bg-gold-500/10 transition-colors"
              >
                Edit
              </button>
            )}
            <button
              onClick={editing ? cancelEdit : onClose}
              className="p-1.5 rounded-lg hover:bg-white/5 text-dark-400 hover:text-white transition-colors"
            >
              <FiX size={15} />
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto max-h-[70vh]">
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
              <div className="flex items-center gap-4 pb-4 border-b border-white/8">
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
                      className="w-full bg-dark-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold-500/40 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="dp-edit-gender" className="text-[10px] text-dark-500 uppercase tracking-widest font-medium">Gender</label>
                    <select
                      id="dp-edit-gender"
                      value={form.gender}
                      onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                      className="w-full bg-dark-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold-500/40 transition-colors"
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
                      className="w-full bg-dark-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold-500/40 transition-colors"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={cancelEdit}
                      className="flex-1 py-2.5 rounded-xl bg-dark-700 text-dark-300 text-sm hover:bg-dark-600 transition-colors"
                    >Cancel</button>
                    <button
                      onClick={saveEdit}
                      disabled={saving || !form.name.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
                    >{saving ? 'Saving…' : 'Save Changes'}</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div className="col-span-2">
                    <Field label="Partner ID" value={profile.partnerId} mono />
                  </div>
                  <Field label="Email Address" value={profile.email} />
                  <Field label="Gender" value={genderLabel[profile.gender] || profile.gender} />
                  <Field label="Mobile Number" value={profile.phone} />
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
                <div className="pt-4 border-t border-white/8">
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

function printDpInvoice(item) {
  const addr = item.address || {};
  downloadInvoice({
    orderId:         item.displayId,
    _id:             item._id,
    createdAt:       item.createdAt,
    items:           item.items || [],
    itemsPrice:      item.total || 0,
    shippingPrice:   0,
    taxPrice:        0,
    totalAmount:     item.total || 0,
    payment: {
      status:              'paid',
      method:              item.paymentMethod || 'razorpay',
      paidAt:              item.paidAt || item.createdAt,
      razorpayPaymentId:   item.razorpayPaymentId || '',
    },
    shippingAddress: {
      fullName:     addr.fullName  || item.customer?.name || '—',
      addressLine1: addr.addressLine1 || '',
      addressLine2: addr.addressLine2 || '',
      city:         addr.city     || '',
      state:        addr.state    || '',
      pincode:      addr.pincode  || '',
      country:      addr.country  || 'India',
      phone:        addr.phone    || item.customer?.phone || '',
    },
    user: item.customer || {},
  });
}

/* ── Confirm Modal ───────────────────────────────────────────────────────────── */

function ConfirmModal({ onConfirm, onClose, title, message }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 12 }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
        <p className="text-dark-400 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-dark-700 text-dark-300 text-sm hover:bg-dark-600 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors">Confirm</button>
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

function DeliveryCard({ item, onStatusUpdate, onConfirm, currentUserId }) {
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
          <div>
            <p className="text-xs text-dark-500 font-mono">{item.displayId}</p>
            <p className="text-white font-semibold text-sm mt-0.5">{item.customer?.name || '—'}</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${meta.bg} ${meta.color} flex items-center gap-1.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            {status}
          </span>
        </div>

        {/* Customer details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-dark-400">
          <div className="flex items-start gap-1.5">
            <FiMapPin size={12} className="mt-0.5 shrink-0 text-dark-500" />
            <span>
              {[item.address?.addressLine1, item.address?.city, item.address?.state, item.address?.pincode]
                .filter(Boolean).join(', ')}
            </span>
          </div>
          {item.customer?.phone && (
            <div className="flex items-center gap-1.5">
              <FiPhone size={12} className="text-dark-500" />
              <span>{item.customer.phone}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-dark-900/60 rounded-lg p-2.5 space-y-1">
          {item.items?.map((it) => (
            <div key={it.name} className="flex justify-between text-xs">
              <span className="text-dark-300 truncate">{it.name} {it.quantity > 1 ? `×${it.quantity}` : ''}</span>
              <span className="text-dark-500 ml-2 shrink-0">₹{Number(it.price || 0).toLocaleString('en-IN')}</span>
            </div>
          ))}
          <div className="flex justify-between text-xs pt-1 border-t border-white/5 mt-1">
            <span className="text-dark-400">Total</span>
            <span className="text-gold-400 font-semibold">₹{Number(item.total).toLocaleString('en-IN')}</span>
          </div>
        </div>

        <p className="text-xs text-dark-600">{fmt(item.createdAt)}</p>

        {/* DP confirmed indicator */}
        {item.dpConfirmedAt && status !== 'Delivered' && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-xs text-emerald-400">
            <FiCheckCircle size={12} />
            <span>You marked delivered · awaiting admin confirmation</span>
          </div>
        )}

        {/* Actions */}
        {status === 'Shipped' && !item.dpConfirmedAt && (
          <div className="space-y-2 pt-1 border-t border-white/5">
            <div className="space-y-1.5">
              <p className="text-xs text-dark-500">Type <span className="text-white font-mono">DELIVERED</span> to confirm delivery:</p>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="DELIVERED"
                className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-dark-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Delivery note (optional)"
                rows={2}
                className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-dark-600 focus:outline-none focus:border-white/20 resize-none transition-colors"
              />
              <button
                onClick={handleConfirmClick}
                disabled={busy || confirmInput.trim() !== 'DELIVERED'}
                className="w-full py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-600/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <FiCheckCircle size={13} /> Confirm Delivery
              </button>
            </div>
          </div>
        )}

        {/* PDF Invoice */}
        <div className="pt-1 border-t border-white/5 flex justify-end">
          <button
            onClick={() => printDpInvoice(item)}
            className="flex items-center gap-1.5 text-xs text-gold-400 bg-gold-500/10 border border-gold-500/20 hover:bg-gold-500/20 rounded-lg px-3 py-2 transition-colors"
          >
            <FiDownload size={11} /> Invoice PDF
          </button>
        </div>
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
    address:       PropTypes.shape({ addressLine1: PropTypes.string, city: PropTypes.string, state: PropTypes.string, pincode: PropTypes.string }),
    items:         PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string, quantity: PropTypes.number, price: PropTypes.number })),
    total:         PropTypes.number,
    createdAt:     PropTypes.string,
    dpConfirmedAt: PropTypes.string,
  }).isRequired,
  onStatusUpdate: PropTypes.func.isRequired,
  onConfirm:      PropTypes.func.isRequired,
  currentUserId:  PropTypes.string,
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
  const intervalRef                   = useRef(null);

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

  const handleLogout = async () => {
    setLoggingOut(true);
    await dispatch(logoutUser());
    setLoggingOut(false);
  };

  const handleStatusUpdate = async (id, source, status, note) => {
    try {
      await deliveryService.updateStatus(id, { source, status, note });
      await load(true);
      toast.success('Status updated');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Status update failed';
      toast.error(msg);
    }
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
    'In Progress': items.filter((i) => (STATUS_DISPLAY[i.rawStatus] || 'In Progress') === 'In Progress').length,
    'Shipped':     items.filter((i) => STATUS_DISPLAY[i.rawStatus] === 'Shipped').length,
    'Delivered':   items.filter((i) => STATUS_DISPLAY[i.rawStatus] === 'Delivered').length,
  };

  const statBtns = [
    ['In Progress', counts['In Progress'], 'text-amber-400',   'bg-amber-500/10 border-amber-500/20',    'ring-amber-500/30'],
    ['Shipped',     counts['Shipped'],     'text-blue-400',    'bg-blue-500/10 border-blue-500/20',      'ring-blue-500/30'],
    ['Delivered',   counts['Delivered'],   'text-emerald-400', 'bg-emerald-500/10 border-emerald-500/20','ring-emerald-500/30'],
  ];

  const renderDeliveryList = () => {
    if (loading) {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 text-dark-500 text-sm">
          Loading deliveries…
        </motion.div>
      );
    }
    if (error) {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-red-400 text-sm py-8 justify-center">
          <FiAlertCircle size={16} /> {error}
        </motion.div>
      );
    }
    if (filtered.length === 0) {
      return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-16 text-dark-500 text-sm">
          {items.length === 0 ? 'No deliveries assigned yet.' : 'No results match your filter.'}
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
              onStatusUpdate={handleStatusUpdate}
              onConfirm={handleConfirm}
              currentUserId={user?._id}
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
      <div className="bg-dark-900/80 backdrop-blur-md border-b border-white/10 px-4 py-3 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center">
              <FiTruck size={18} className="text-gold-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-semibold text-sm leading-tight truncate">My Deliveries</h1>
              <p className="text-dark-500 text-xs truncate">{user?.name} · Partner</p>
            </div>
          </div>

          {/* Center: live clock */}
          <LiveClock />

          {/* Right: actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowProfile(true)}
              title="My Profile"
              className="p-2 rounded-lg hover:bg-white/5 text-dark-400 hover:text-gold-400 transition-colors"
            >
              <FiUser size={16} />
            </button>
            <button
              onClick={() => load()}
              title="Refresh"
              className="p-2 rounded-lg hover:bg-white/5 text-dark-400 hover:text-white transition-colors"
            >
              <FiRefreshCw size={16} />
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              title="Logout"
              className="p-2 rounded-lg hover:bg-red-500/10 text-dark-400 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              <FiLogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {statBtns.map(([label, count, textCls, bgCls, ringCls]) => (
            <motion.button
              key={label}
              onClick={() => setFilter(filterStatus === label ? 'all' : label)}
              whileTap={{ scale: 0.97 }}
              className={`
                border rounded-xl p-3 text-center w-full
                transition-all duration-200 ease-out
                ${bgCls}
                ${filterStatus === label ? `ring-2 ${ringCls} shadow-lg` : 'hover:brightness-110'}
              `}
            >
              <p className={`text-xl font-bold font-jakarta ${textCls}`}>{count}</p>
              <p className="text-xs text-dark-500 mt-0.5">{label}</p>
            </motion.button>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, name, city…"
              className="w-full bg-dark-800 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-gold-500/30 transition-colors"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-dark-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition-colors"
          >
            <option value="all">All</option>
            <option value="In Progress">In Progress</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
          </select>
        </div>

        {/* Delivery list */}
        {renderDeliveryList()}
      </div>
    </div>
  );
}
