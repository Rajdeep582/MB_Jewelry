import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiShoppingBag, FiPackage, FiUsers, FiDollarSign, FiArrowRight, FiChevronLeft, FiChevronRight,
  FiRefreshCw, FiBox, FiTruck, FiEdit2, FiAlertTriangle, FiCheckCircle, FiInbox,
} from 'react-icons/fi';
import { orderService, userService, productService, customOrderService } from '../../services/services';
import { formatPrice } from '../../utils/helpers';

function StatCard({ icon, title, value, subtitle, color = 'gold', to }) {

  const SIcon = icon;
  const colors = {
    gold:  'bg-gold-500/10 text-gold-500 border-gold-500/20',
    blue:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    purple:'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };
  return (
    <Link to={to} className="card p-3.5 group block hover:border-white/15 hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between mb-2.5">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${colors[color]}`}>
          <SIcon size={16} />
        </div>
        <FiArrowRight size={13} className="text-dark-600 group-hover:text-gold-400 group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-xl sm:text-2xl font-display font-medium text-white tabular-nums truncate">{value}</p>
      <p className="text-dark-400 text-xs mt-0.5">{title}</p>
      {subtitle && <p className="text-[11px] text-dark-500 mt-0.5">{subtitle}</p>}
    </Link>
  );
}

// Action tile: what needs the admin's attention right now
function AttentionTile({ icon, label, count, hint, to, tone }) {
  const SIcon = icon;
  const active = count > 0;
  const tones = {
    amber:  'text-amber-300 bg-amber-500/10 border-amber-500/25',
    blue:   'text-blue-300 bg-blue-500/10 border-blue-500/25',
    violet: 'text-violet-300 bg-violet-500/10 border-violet-500/25',
    red:    'text-red-300 bg-red-500/10 border-red-500/25',
  };
  return (
    <Link
      to={to}
      className={`group flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl border transition-all duration-200 ${
        active ? `${tones[tone]} hover:brightness-125` : 'border-white/[0.08] bg-white/[0.02] text-dark-400 hover:border-white/15'
      }`}
    >
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-black/20' : 'bg-dark-800'}`}>
        <SIcon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-lg font-semibold leading-none tabular-nums ${active ? 'text-white' : 'text-dark-300'}`}>{count}</p>
        <p className="text-[11px] mt-1 leading-tight line-clamp-2 sm:truncate">{label}</p>
      </div>
      <span className="hidden sm:block text-[10px] text-dark-500 group-hover:text-dark-300 transition-colors whitespace-nowrap">{hint}</span>
    </Link>
  );
}

const PIPELINE = [
  { key: 'confirmed',     label: 'Processing',    bar: 'bg-amber-400',   text: 'text-amber-300' },
  { key: 'ready_to_ship', label: 'Ready to Ship', bar: 'bg-blue-400',    text: 'text-blue-300' },
  { key: 'shipped',       label: 'Shipped',       bar: 'bg-violet-400',  text: 'text-violet-300' },
  { key: 'delivered',     label: 'Delivered',     bar: 'bg-emerald-400', text: 'text-emerald-300' },
];

const STATUS_CHIP = {
  confirmed:     { label: 'Processing',    cls: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
  ready_to_ship: { label: 'Ready to Ship', cls: 'bg-blue-500/10 text-blue-300 border-blue-500/20' },
  shipped:       { label: 'Shipped',       cls: 'bg-violet-500/10 text-violet-300 border-violet-500/20' },
  delivered:     { label: 'Delivered',     cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
};

function timeAgo(date) {
  const diff = Math.max(0, Date.now() - new Date(date).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// ── IST helpers ──────────────────────────────────────────────────────────────
const getIST = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 60 * 60 * 1000); // UTC+5:30
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function pad(n) { return String(n).padStart(2, '0'); }

function LiveCalendar() {
  const [now, setNow]         = useState(getIST);
  const [view, setView]       = useState(() => { const d = getIST(); return { y: d.getFullYear(), m: d.getMonth() }; });

  useEffect(() => {
    const t = setInterval(() => setNow(getIST()), 1000);
    return () => clearInterval(t);
  }, []);

  const { y, m } = view;
  const today      = now;
  const firstDay   = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const h  = now.getHours();
  const mi = now.getMinutes();
  const s  = now.getSeconds();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const timeStr = `${pad(h12)}:${pad(mi)}:${pad(s)} ${ampm}`;
  const dateStr = `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  const isToday = (day) =>
    today.getDate() === day &&
    today.getMonth() === m &&
    today.getFullYear() === y;

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  return (
    <div className="card p-4 flex flex-col">
      {/* Live clock */}
      <div className="text-center pb-2 mb-2 border-b border-white/[0.08]">
        <p className="font-mono text-lg font-semibold tracking-widest text-gold-400">{timeStr}</p>
        <p className="text-dark-300 text-xs mt-0.5">{dateStr}</p>
        <p className="text-dark-600 text-[10px] mt-0.5 uppercase tracking-widest">India Standard Time</p>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setView(({ y, m }) => m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 text-dark-400 hover:text-gold-400 transition-colors"
        >
          <FiChevronLeft size={14} />
        </button>
        <span className="font-display text-sm text-white">{MONTHS[m]} {y}</span>
        <button
          onClick={() => setView(({ y, m }) => m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 text-dark-400 hover:text-gold-400 transition-colors"
        >
          <FiChevronRight size={14} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] text-dark-600 uppercase tracking-wide py-0.5">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: cells.length }, (_, n) => n).map((pos) => {
          const day = cells[pos];
          return (
            <div key={pos} className="flex items-center justify-center">
              {day ? (
                <div className={`w-6 h-6 flex items-center justify-center rounded-md text-xs font-medium transition-colors ${
                  isToday(day)
                    ? 'bg-gold-500 text-dark-900 shadow-[0_0_10px_rgba(212,175,55,0.4)]'
                    : 'text-dark-300 hover:bg-white/5 hover:text-white cursor-default'
                }`}>
                  {day}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* IST badge */}
      <div className="mt-2 pt-2 border-t border-white/[0.08] flex justify-center">
        <span className="text-[10px] text-dark-600 uppercase tracking-widest">UTC +05:30 · Kolkata</span>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats]               = useState(null);
  const [customStats, setCustomStats]   = useState(null);
  const [totalUsers, setTotalUsers]     = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [updatedAt, setUpdatedAt]       = useState(null);
  const [error, setError]               = useState('');
  const timerRef                        = useRef(null);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [statsRes, usersRes, productsRes, customRes] = await Promise.all([
        orderService.getStats(),
        userService.getAllUsers({ page: 1, limit: 1 }),
        productService.getProducts({ limit: 1 }),
        // Optional widget data — never block the dashboard on it
        customOrderService.getStats().catch(() => null),
      ]);
      setStats(statsRes.data.stats);
      setTotalUsers(usersRes.data.total || 0);
      setTotalProducts(productsRes.data.pagination?.total || 0);
      if (customRes) setCustomStats(customRes.data.stats);
      setUpdatedAt(new Date());
      setError('');
    } catch (err) {
      // A failed background poll keeps the last good data on screen
      if (!silent) setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await fetchStats(true);
    setRefreshing(false);
  };

  useEffect(() => {
    document.title = 'Admin Dashboard — M.B. JEWELLERS';
    fetchStats();
    timerRef.current = setInterval(() => fetchStats(true), 30_000);
    return () => clearInterval(timerRef.current);
  }, [fetchStats]);


  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-10 w-48 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, n) => n).map((n) => (
            <div key={n} className="card p-4 space-y-3">
              <div className="skeleton w-9 h-9 rounded-xl" />
              <div className="skeleton h-6 rounded w-1/2" />
              <div className="skeleton h-3 rounded w-3/4" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, n) => n).map((n) => <div key={n} className="skeleton h-[62px] rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }, (_, n) => n).map((n) => <div key={n} className="skeleton h-64 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FiAlertTriangle size={22} className="mx-auto text-red-400 mb-2" />
          <p className="text-red-400 mb-3 text-sm">{error}</p>
          <button onClick={() => fetchStats()} className="btn-dark text-sm gap-2"><FiRefreshCw size={13} /> Retry</button>
        </div>
      </div>
    );
  }

  const statusCounts = stats?.statusCounts || {};
  const pipelineTotal = PIPELINE.reduce((sum, s) => sum + (statusCounts[s.key] || 0), 0);
  const recentOrders = stats?.recentOrders || [];
  const attention = [
    { icon: FiBox,           label: 'Orders to process',     count: statusCounts.confirmed || 0,     hint: 'Pack & mark ready', to: '/admin/orders',        tone: 'amber' },
    { icon: FiTruck,         label: 'Ready to ship',         count: statusCounts.ready_to_ship || 0, hint: 'Assign & dispatch', to: '/admin/deliveries',    tone: 'blue' },
    { icon: FiEdit2,         label: 'Custom quotes pending', count: customStats?.pendingCount || 0,  hint: 'Send a quote',      to: '/admin/custom-orders', tone: 'violet' },
    { icon: FiAlertTriangle, label: 'Failed payments',       count: stats?.needsAttention || 0,      hint: 'Review',            to: '/admin/orders',        tone: 'red' },
  ];
  const allClear = attention.every((a) => a.count === 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl text-white">Dashboard</h1>
          <p className="text-dark-400 text-sm mt-0.5">
            M.B. JEWELLERS
            {updatedAt && (
              <span className="text-dark-500"> · Updated {updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-dark-800 border border-white/10 text-dark-300 hover:text-white hover:border-white/20 transition-colors disabled:opacity-60"
        >
          <FiRefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={FiDollarSign} title="Total Revenue" value={formatPrice(stats?.totalRevenue || 0)} subtitle="Paid orders" color="gold" to="/admin/orders" />
        <StatCard icon={FiPackage} title="Total Orders" value={stats?.totalOrders || 0} subtitle="Paid orders" color="blue" to="/admin/orders" />
        <StatCard icon={FiUsers} title="Total Users" value={totalUsers} subtitle="Registered" color="green" to="/admin/users" />
        <StatCard icon={FiShoppingBag} title="Products" value={totalProducts} subtitle="In catalogue" color="purple" to="/admin/products" />
      </div>

      {/* Needs attention */}
      <div className="card p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base text-white">Needs attention</h2>
          {allClear && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400">
              <FiCheckCircle size={12} /> All caught up
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-2.5">
          {attention.map((a) => <AttentionTile key={a.label} {...a} />)}
        </div>
      </div>

      {/* Order pipeline · Recent orders · Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="space-y-3">
          {/* Order pipeline */}
          <div className="card p-4">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-base text-white">Order Pipeline</h2>
              <span className="text-[11px] text-dark-500 tabular-nums">{pipelineTotal} paid</span>
            </div>
            {/* Stacked distribution bar */}
            <div className="flex h-1.5 rounded-full overflow-hidden bg-dark-700 mb-3.5">
              {PIPELINE.map((s) => {
                const c = statusCounts[s.key] || 0;
                return c > 0 ? <div key={s.key} className={s.bar} style={{ width: `${(c / (pipelineTotal || 1)) * 100}%` }} title={`${s.label}: ${c}`} /> : null;
              })}
            </div>
            <div className="space-y-1.5">
              {PIPELINE.map((s) => {
                const count = statusCounts[s.key] || 0;
                const pct = pipelineTotal ? Math.round((count / pipelineTotal) * 100) : 0;
                return (
                  <div key={s.key} className="flex items-center gap-3 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.bar}`} />
                    <span className={`text-sm flex-1 ${s.text}`}>{s.label}</span>
                    <span className="text-[11px] text-dark-500 tabular-nums w-9 text-right">{pct}%</span>
                    <span className="text-white text-sm font-semibold w-7 text-right tabular-nums">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card p-4">
            <h2 className="font-display text-base text-white mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Add Product', to: '/admin/products', icon: FiShoppingBag },
                { label: 'Orders', to: '/admin/orders', icon: FiPackage },
                { label: 'Deliveries', to: '/admin/deliveries', icon: FiTruck },
                { label: 'Users', to: '/admin/users', icon: FiUsers },
              ].map((item) => {
                const SIcon = item.icon;
                return (
                  <Link key={item.label} to={item.to}
                    className="flex items-center gap-2.5 p-2 rounded-xl bg-dark-800 hover:bg-dark-700 border border-white/5 hover:border-gold-500/25 transition-all group"
                  >
                    <div className="w-7 h-7 rounded-lg glass-gold flex items-center justify-center flex-shrink-0">
                      <SIcon size={13} className="text-gold-500" />
                    </div>
                    <span className="text-dark-300 group-hover:text-white text-xs font-medium transition-colors truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent orders */}
        <div className="card p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-base text-white">Recent Orders</h2>
            <Link to="/admin/orders" className="inline-flex items-center gap-1 text-[11px] text-gold-400 hover:text-gold-300">
              View all <FiArrowRight size={11} />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-dark-500">
              <FiInbox size={22} className="mb-2" />
              <p className="text-sm">No paid orders yet</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/5 -mx-1">
              {recentOrders.map((o) => {
                const chip = STATUS_CHIP[o.orderStatus];
                const itemCount = (o.items || []).reduce((n, it) => n + (it.quantity || 1), 0);
                const name = o.user?.name || 'Guest';
                return (
                  <li key={o._id}>
                    <Link to="/admin/orders" className="flex items-center gap-3 px-1 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                      <div className="w-8 h-8 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-400 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white truncate">{name}</p>
                        <p className="text-[11px] text-dark-500 truncate">
                          <span className="font-mono">#{String(o._id).slice(-8).toUpperCase()}</span> · {itemCount} item{itemCount === 1 ? '' : 's'} · {timeAgo(o.createdAt)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm text-gold-400 font-semibold tabular-nums">{formatPrice(o.totalAmount)}</p>
                        {chip && <span className={`inline-block mt-0.5 px-1.5 py-px rounded border text-[10px] ${chip.cls}`}>{chip.label}</span>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Live Calendar */}
        <LiveCalendar />
      </div>
    </div>
  );
}
