import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  FiUser, FiMail, FiEdit2, FiCheck, FiX, FiShield, FiShoppingBag, FiTrendingUp,
  FiFeather, FiUsers, FiSend, FiRefreshCw, FiLock, FiInfo,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { orderService, customOrderService, userService } from '../../services/services';
import { formatPrice } from '../../utils/helpers';
import { setUser } from '../../store/authSlice';

const NAME_MAX = 50;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || 'A';

function StatTile({ icon, label, value, tone }) {
  const Icon = icon;
  const tones = {
    gold:    'from-gold-500/[0.14] border-gold-500/20 text-gold-300 bg-gold-500/15',
    emerald: 'from-emerald-500/[0.14] border-emerald-500/20 text-emerald-300 bg-emerald-500/15',
    violet:  'from-violet-500/[0.14] border-violet-500/20 text-violet-300 bg-violet-500/15',
    sky:     'from-sky-500/[0.14] border-sky-500/20 text-sky-300 bg-sky-500/15',
  }[tone].split(' ');
  return (
    <div className={`rounded-2xl border bg-gradient-to-br to-transparent px-3.5 py-3 ${tones[0]} ${tones[1]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-dark-400">{label}</p>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${tones[3]} ${tones[2]}`}><Icon size={13} /></span>
      </div>
      <p className={`text-xl font-semibold tabular-nums mt-1 ${tones[2]}`}>{value ?? <span className="inline-block w-12 h-5 rounded skeleton align-middle" />}</p>
    </div>
  );
}

function Step({ n, label, active, done }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold border transition-colors ${
        done ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
          : active ? 'bg-gold-500 border-gold-500 text-dark-900'
            : 'border-white/15 text-dark-500'
      }`}>
        {done ? <FiCheck size={12} /> : n}
      </span>
      <span className={`text-xs ${active ? 'text-white' : 'text-dark-500'}`}>{label}</span>
    </div>
  );
}

export default function AdminProfile() {
  const dispatch = useDispatch();
  const admin    = useSelector((s) => s.auth.user);

  useEffect(() => { document.title = 'My Profile — Admin'; }, []);

  // ── Store at a glance (read-only, existing admin endpoints) ───────────────
  const [stats, setStats] = useState({});
  useEffect(() => {
    let alive = true;
    const put = (patch) => alive && setStats((s) => ({ ...s, ...patch }));
    orderService.getStats()
      .then((r) => put({ orders: r.data.stats?.totalOrders ?? 0, revenue: r.data.stats?.totalRevenue ?? 0 }))
      .catch(() => put({ orders: '—', revenue: null, revenueFailed: true }));
    customOrderService.getStats()
      .then((r) => put({ custom: r.data.stats?.total ?? 0 }))
      .catch(() => put({ custom: '—' }));
    userService.getAllUsers({ page: 1, limit: 1 })
      .then((r) => put({ users: r.data.total ?? 0 }))
      .catch(() => put({ users: '—' }));
    return () => { alive = false; };
  }, []);

  // ── Name editing ──────────────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [name,        setName]        = useState(admin?.name || '');
  const [savingName,  setSavingName]  = useState(false);
  const nameChanged = name.trim() && name.trim() !== admin?.name;

  const handleSaveName = async () => {
    if (!nameChanged || savingName) return;
    setSavingName(true);
    try {
      const res = await api.patch('/admin-auth/profile/name', { name: name.trim().slice(0, NAME_MAX) });
      dispatch(setUser(res.data.user));
      toast.success('Name updated.');
      setEditingName(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update name.');
    } finally { setSavingName(false); }
  };

  // ── Email change ──────────────────────────────────────────────────────────
  const [emailStep,   setEmailStep]   = useState('idle'); // idle | otp
  const [newEmail,    setNewEmail]    = useState('');
  const [otp,         setOtp]         = useState('');
  const [sendingOtp,  setSendingOtp]  = useState(false);
  const [verifying,   setVerifying]   = useState(false);

  const cleanEmail = newEmail.trim().toLowerCase();
  const emailError = !cleanEmail ? ''
    : !EMAIL_RX.test(cleanEmail) ? 'Enter a valid email address.'
      : cleanEmail === admin?.email?.toLowerCase() ? 'This is already your current email.'
        : '';

  const handleRequestEmailChange = async () => {
    if (!cleanEmail || emailError || sendingOtp) return;
    setSendingOtp(true);
    try {
      const res = await api.post('/admin-auth/profile/request-email-change', { newEmail: cleanEmail });
      toast.success(res.data.message);
      setEmailStep('otp');
      setOtp('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP.');
    } finally { setSendingOtp(false); }
  };

  const handleConfirmEmailChange = async () => {
    if (otp.length !== 6 || verifying) return;
    setVerifying(true);
    try {
      const res = await api.post('/admin-auth/profile/confirm-email-change', { otp });
      dispatch(setUser(res.data.user));
      toast.success(res.data.message);
      setEmailStep('idle');
      setNewEmail('');
      setOtp('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP.');
    } finally { setVerifying(false); }
  };

  const cancelEmailChange = () => { setEmailStep('idle'); setOtp(''); };

  return (
    <div className="max-w-4xl mx-auto space-y-4 py-1">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl border border-gold-500/20 bg-gradient-to-br from-gold-500/[0.16] via-dark-900/70 to-dark-900/40">
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-gold-400/15 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="absolute -bottom-20 -left-10 w-48 h-48 rounded-full bg-amber-600/10 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
          <div className="relative w-fit">
            <div className="w-20 h-20 rounded-full p-[2px] bg-gradient-to-br from-gold-300 via-gold-500 to-amber-700 shadow-[0_0_30px_rgba(212,175,55,0.25)]">
              {admin?.avatar ? (
                <img src={admin.avatar} alt="" referrerPolicy="no-referrer" className="w-full h-full rounded-full object-cover bg-dark-900" />
              ) : (
                <div className="w-full h-full rounded-full bg-dark-900 flex items-center justify-center">
                  <span className="font-display text-2xl text-gold-300">{initials(admin?.name)}</span>
                </div>
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-dark-900 border border-gold-500/40 flex items-center justify-center text-gold-300" title="Administrator">
              <FiShield size={13} />
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] text-gold-400/80">Admin account</p>
            <h1 className="font-display text-2xl sm:text-3xl text-white leading-tight truncate">{admin?.name || 'Administrator'}</h1>
            <p className="text-dark-300 text-sm flex items-center gap-1.5 mt-0.5 min-w-0"><FiMail size={13} className="shrink-0 text-dark-500" /><span className="truncate">{admin?.email}</span></p>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <span className="inline-flex items-center gap-1 text-[11px] bg-gold-500/15 border border-gold-500/30 text-gold-300 px-2 py-0.5 rounded-md font-medium"><FiShield size={10} /> Administrator</span>
              <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md font-medium"><FiLock size={10} /> OTP-protected email</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Store at a glance ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatTile icon={FiShoppingBag} label="Paid orders"   value={stats.orders}  tone="gold" />
        <StatTile icon={FiTrendingUp}  label="Revenue"       value={stats.revenueFailed ? '—' : stats.revenue == null ? undefined : formatPrice(stats.revenue)} tone="emerald" />
        <StatTile icon={FiFeather}     label="Custom orders" value={stats.custom}  tone="violet" />
        <StatTile icon={FiUsers}       label="Customers"     value={stats.users}   tone="sky" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        {/* ── Display name ── */}
        <section className="card p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400"><FiUser size={14} /></span>
              <div>
                <h2 className="text-white font-semibold text-sm">Display name</h2>
                <p className="text-dark-500 text-[11px]">Shown in the admin panel</p>
              </div>
            </div>
            {!editingName && (
              <button type="button" onClick={() => { setEditingName(true); setName(admin?.name || ''); }}
                className="flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300 bg-gold-500/10 hover:bg-gold-500/15 border border-gold-500/20 px-3 py-1.5 rounded-lg transition-all">
                <FiEdit2 size={11} /> Edit
              </button>
            )}
          </div>

          {editingName ? (
            <div className="space-y-2.5">
              <div className="relative">
                <input
                  className="input-dark w-full pr-14"
                  value={name}
                  maxLength={NAME_MAX}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-dark-500">{name.length}/{NAME_MAX}</span>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleSaveName} disabled={savingName || !nameChanged}
                  className="btn-gold flex items-center gap-1.5 !px-4 !py-2 !text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:!translate-y-0">
                  <FiCheck size={13} /> {savingName ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setEditingName(false)}
                  className="btn-dark flex items-center gap-1.5 px-4 py-2 text-sm">
                  <FiX size={13} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-dark-900/60 border border-white/[0.06] px-3.5 py-2.5 text-white text-sm">{admin?.name}</p>
          )}
        </section>

        {/* ── Email ── */}
        <section className="card p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400"><FiMail size={14} /></span>
            <div className="min-w-0">
              <h2 className="text-white font-semibold text-sm">Email address</h2>
              <p className="text-dark-500 text-[11px] truncate">Current: <span className="text-dark-200">{admin?.email}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Step n={1} label="New email" active={emailStep === 'idle'} done={emailStep === 'otp'} />
            <span className="flex-1 h-px bg-white/10" />
            <Step n={2} label="Verify OTP" active={emailStep === 'otp'} />
          </div>

          {emailStep === 'idle' && (
            <div className="space-y-2.5">
              <div>
                <input
                  className={`input-dark w-full ${emailError ? 'border-red-500/40 focus:border-red-500/60' : ''}`}
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="New email address"
                  autoComplete="email"
                  onKeyDown={(e) => e.key === 'Enter' && handleRequestEmailChange()}
                />
                {emailError && <p className="text-red-400 text-[11px] mt-1">{emailError}</p>}
              </div>
              <button type="button" onClick={handleRequestEmailChange} disabled={sendingOtp || !cleanEmail || !!emailError}
                className="btn-gold flex items-center gap-1.5 !px-4 !py-2 !text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:!translate-y-0">
                <FiSend size={13} /> {sendingOtp ? 'Sending OTP…' : 'Send verification OTP'}
              </button>
            </div>
          )}

          {emailStep === 'otp' && (
            <div className="space-y-2.5">
              <p className="text-xs text-dark-400">Code sent to <span className="text-gold-400 break-all">{cleanEmail}</span>. Valid for 10 minutes.</p>
              <input
                className="input-dark w-full font-mono tracking-[0.6em] text-lg text-center"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmEmailChange()}
                placeholder="••••••"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleConfirmEmailChange} disabled={verifying || otp.length !== 6}
                  className="btn-gold flex items-center gap-1.5 !px-4 !py-2 !text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:!translate-y-0">
                  <FiCheck size={13} /> {verifying ? 'Verifying…' : 'Confirm'}
                </button>
                <button type="button" onClick={handleRequestEmailChange} disabled={sendingOtp}
                  className="btn-dark flex items-center gap-1.5 px-3 py-2 text-sm disabled:opacity-50">
                  <FiRefreshCw size={12} className={sendingOtp ? 'animate-spin' : ''} /> Resend
                </button>
                <button type="button" onClick={cancelEmailChange}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-dark-400 hover:text-white transition-colors">
                  <FiX size={13} /> Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── Security notes ── */}
      <div className="rounded-2xl border border-white/[0.07] bg-dark-900/40 p-4 flex gap-3">
        <span className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-300 shrink-0"><FiInfo size={14} /></span>
        <ul className="text-xs text-dark-400 space-y-1 leading-relaxed">
          <li>Email changes take effect only after you enter the code sent to the <span className="text-dark-200">new</span> address (5 attempts, 10-minute expiry).</li>
          <li>Use the new email the next time you sign in to the admin portal.</li>
          <li>On a shared computer, sign out from the sidebar when you are done.</li>
        </ul>
      </div>
    </div>
  );
}
