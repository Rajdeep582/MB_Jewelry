import { useEffect, useState } from 'react';
import {
  FiSearch, FiUserX, FiUserCheck, FiX, FiUsers, FiMail, FiSmartphone, FiPhone,
  FiCalendar, FiClock, FiMapPin, FiHeart, FiCheckCircle, FiAlertTriangle, FiCopy,
} from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { userService } from '../../services/services';
import { formatDate, formatDateTime } from '../../utils/helpers';
import toast from 'react-hot-toast';

// ─── Display helpers ────────────────────────────────────────────────────────────
const AVATAR_TONES = [
  'from-amber-300 to-amber-600 text-dark-900',
  'from-emerald-300 to-emerald-600 text-dark-900',
  'from-sky-300 to-sky-600 text-dark-900',
  'from-violet-300 to-violet-600 text-white',
  'from-rose-300 to-rose-600 text-white',
  'from-teal-300 to-teal-600 text-dark-900',
];
const toneFor = (seed = '') => AVATAR_TONES[[...seed].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_TONES.length];
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?';

const DAY = 864e5;
function ago(date) {
  if (!date) return null;
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60 * 60 * 1000) return 'just now';
  if (diff < DAY) return `${Math.floor(diff / 3.6e6)}h ago`;
  const d = Math.floor(diff / DAY);
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

/** Sign-in methods the account has: Google / mobile OTP / email + password. */
function signInMethods(user) {
  const types = new Set((user.providers || []).map((p) => p.providerType));
  if (types.size === 0 && user.email) types.add('local');
  return [...types];
}

function Avatar({ user }) {
  const [broken, setBroken] = useState(false);
  if (user.avatar && !broken) {
    return (
      <img
        src={user.avatar}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="w-11 h-11 rounded-full object-cover ring-2 ring-white/10 shrink-0"
      />
    );
  }
  return (
    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${toneFor(user.name || user.email)} flex items-center justify-center text-sm font-bold ring-2 ring-white/10 shrink-0`}>
      {initials(user.name)}
    </div>
  );
}

function MethodChip({ type }) {
  if (type === 'google') {
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-white/10 bg-white/[0.04] text-[10px] text-dark-200"><FcGoogle size={11} /> Google</span>;
  }
  if (type === 'mobile') {
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-sky-500/20 bg-sky-500/10 text-[10px] text-sky-300"><FiSmartphone size={10} /> Mobile OTP</span>;
  }
  return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-gold-500/20 bg-gold-500/10 text-[10px] text-gold-300"><FiMail size={10} /> Email</span>;
}

function ConfirmToggle({ user, busy, onConfirm, onCancel }) {
  const deactivating = user.isActive;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="bg-dark-800 border border-white/10 rounded-2xl p-5 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${deactivating ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
            {deactivating ? <FiAlertTriangle size={16} className="text-red-400" /> : <FiUserCheck size={16} className="text-emerald-400" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-sm mb-1">{deactivating ? 'Deactivate' : 'Activate'} {user.name}?</h3>
            <p className="text-dark-400 text-xs leading-relaxed">
              {deactivating
                ? 'They will be signed out on every device and cannot log in or place orders until you activate the account again.'
                : 'They will be able to sign in and place orders again.'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 px-3 py-2 rounded-xl text-xs text-dark-300 hover:text-white bg-dark-900 hover:bg-dark-700 border border-white/10 transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold text-white transition-colors disabled:opacity-60 ${deactivating ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
          >
            {busy ? 'Saving…' : deactivating ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── User card ──────────────────────────────────────────────────────────────────
function UserCard({ user, onToggle }) {
  const methods = signInMethods(user);
  const addresses = user.addresses || [];
  const defAddr = addresses.find((a) => a.isDefault) || addresses[0];
  const mobile = user.mobile || user.phone;
  const lastSeen = ago(user.lastLogin);

  return (
    <div className={`rounded-2xl border p-3.5 transition-colors ${user.isActive ? 'border-white/[0.07] bg-dark-900/40 hover:border-white/15' : 'border-red-500/15 bg-red-500/[0.03]'}`}>
      <div className="flex items-start gap-3">
        <div className="relative">
          <Avatar user={user} />
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-dark-900 ${user.isActive ? 'bg-emerald-400' : 'bg-red-400'}`}
            title={user.isActive ? 'Active' : 'Inactive'}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-white text-sm font-semibold truncate max-w-full">{user.name || '—'}</p>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${user.isActive ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-red-300 bg-red-500/10 border-red-500/20'}`}>
              {user.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          {user.userId && (
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(user.userId).then(() => toast.success('User ID copied')).catch(() => {})}
              className="inline-flex items-center gap-1 font-mono text-[10px] text-gold-400/90 hover:text-gold-300 mt-0.5"
              title="Copy user ID"
            >
              {user.userId} <FiCopy size={9} />
            </button>
          )}
          <a href={`mailto:${user.email}`} className="flex items-center gap-1.5 text-xs text-dark-300 hover:text-gold-400 mt-1 min-w-0">
            <FiMail size={11} className="shrink-0 text-dark-500" /><span className="truncate">{user.email}</span>
          </a>
          {mobile && (
            <a href={`tel:${mobile}`} className="flex items-center gap-1.5 text-xs text-dark-300 hover:text-gold-400 mt-0.5 w-fit">
              <FiPhone size={11} className="shrink-0 text-dark-500" />{mobile}
              {user.mobile && user.mobileVerified && <FiCheckCircle size={10} className="text-emerald-400" title="Mobile verified" />}
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={() => onToggle(user)}
          className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
            user.isActive
              ? 'text-dark-300 border-white/10 hover:text-red-300 hover:border-red-500/40 hover:bg-red-500/10'
              : 'text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10'
          }`}
        >
          {user.isActive ? <><FiUserX size={12} /> Deactivate</> : <><FiUserCheck size={12} /> Activate</>}
        </button>
      </div>

      <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-dark-400">
        <span className="flex items-center gap-1 flex-wrap">{methods.map((t) => <MethodChip key={t} type={t} />)}</span>
        <span className="flex items-center gap-1" title={formatDateTime(user.createdAt)}><FiCalendar size={10} className="text-dark-500" /> Joined {formatDate(user.createdAt)}</span>
        <span className="flex items-center gap-1" title={user.lastLogin ? formatDateTime(user.lastLogin) : 'Never logged in'}>
          <FiClock size={10} className="text-dark-500" /> {lastSeen ? `Seen ${lastSeen}` : 'Never logged in'}
        </span>
        <span className="flex items-center gap-1 min-w-0" title={defAddr ? [defAddr.addressLine1, defAddr.city, defAddr.pincode].filter(Boolean).join(', ') : ''}>
          <FiMapPin size={10} className="text-dark-500" />
          {defAddr ? <span className="truncate">{defAddr.city} · {defAddr.pincode}{addresses.length > 1 ? ` (+${addresses.length - 1})` : ''}</span> : 'No address'}
        </span>
        {user.wishlist?.length > 0 && (
          <span className="flex items-center gap-1"><FiHeart size={10} className="text-rose-400" /> {user.wishlist.length} saved</span>
        )}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState(''); // debounced — searched on the server across all pages
  const [confirmUser, setConfirmUser] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = 'Users — Admin'; }, []);

  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await userService.getAllUsers({ page, limit: 20, search: query || undefined });
      setUsers(res.data.users);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadUsers(); }, [page, query]);

  const handleToggle = async () => {
    const target = confirmUser;
    if (!target) return;
    setBusy(true);
    try {
      const res = await userService.toggleUserActive(target._id);
      const updated = res.data.user;
      toast.success(`${target.name} ${updated.isActive ? 'activated' : 'deactivated'}`);
      setUsers((list) => list.map((u) => (u._id === updated._id ? { ...u, ...updated } : u)));
      setConfirmUser(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    } finally {
      setBusy(false);
    }
  };

  const activeHere = users.filter((u) => u.isActive).length;
  const inactiveHere = users.length - activeHere;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-gold-500/[0.10] via-dark-900/60 to-dark-900/30 p-4 sm:p-5">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-gold-500/10 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-gold-500/15 border border-gold-500/25 flex items-center justify-center text-gold-300">
              <FiUsers size={20} />
            </span>
            <div>
              <h1 className="font-display text-xl text-white">Users</h1>
              <p className="text-dark-400 text-sm">Verified customer accounts</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="rounded-xl border border-white/[0.08] bg-dark-900/50 px-3 py-1.5 min-w-[88px]">
              <p className="text-[10px] uppercase tracking-wider text-dark-500">{query ? 'Matching' : 'Total'}</p>
              <p className="text-lg font-semibold tabular-nums text-gold-300 leading-tight">{loading ? '—' : total}</p>
            </div>
            {!loading && users.length > 0 && (
              <div className="rounded-xl border border-white/[0.08] bg-dark-900/50 px-3 py-1.5" title="Accounts shown on this page">
                <p className="text-[10px] uppercase tracking-wider text-dark-500">This page</p>
                <p className="text-sm font-medium tabular-nums leading-tight mt-0.5">
                  <span className="text-emerald-400">{activeHere} active</span>
                  {inactiveHere > 0 && <span className="text-red-400"> · {inactiveHere} off</span>}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, mobile or USR- ID…"
            className="input-dark pl-9 pr-9 text-sm w-full"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white">
              <FiX size={14} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {loading && (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-[124px] rounded-2xl" />)}
        </div>
      )}
      {!loading && users.length === 0 && (
        <div className="card py-14 flex flex-col items-center text-center">
          <span className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-dark-400 mb-3"><FiUsers size={20} /></span>
          <p className="text-dark-300 text-sm">{query ? `No customers match "${query}"` : 'No customers yet'}</p>
          {query && <button type="button" onClick={() => setSearch('')} className="text-gold-400 text-xs mt-2 hover:text-gold-300">Clear search</button>}
        </div>
      )}
      {!loading && users.length > 0 && (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {users.map((user) => <UserCard key={user._id} user={user} onToggle={setConfirmUser} />)}
        </div>
      )}

      {pages > 1 && (
        <div className="flex justify-center gap-2 flex-wrap">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-xs ${p === page ? 'bg-gold-500 text-dark-900 font-semibold' : 'bg-dark-800 text-dark-400 hover:text-white border border-white/10'}`}>
              {p}
            </button>
          ))}
        </div>
      )}

      {confirmUser && (
        <ConfirmToggle user={confirmUser} busy={busy} onConfirm={handleToggle} onCancel={() => !busy && setConfirmUser(null)} />
      )}
    </div>
  );
}
