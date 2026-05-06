import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiShoppingBag, FiPackage, FiUsers, FiDollarSign, FiArrowRight, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { orderService, userService, productService } from '../../services/services';
import { formatPrice } from '../../utils/helpers';

function StatCard({ icon, title, value, subtitle, color = 'gold' }) {

  const SIcon = icon;
  const colors = {
    gold:  'bg-gold-500/10 text-gold-500 border-gold-500/20',
    blue:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    purple:'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };
  return (
    <div className="card p-3">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${colors[color]}`}>
          <SIcon size={15} />
        </div>
      </div>
      <p className="text-xl font-display font-medium text-white">{value}</p>
      <p className="text-dark-400 text-xs">{title}</p>
      {subtitle && <p className="text-xs text-dark-500 mt-0.5">{subtitle}</p>}
    </div>
  );
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
      <div className="text-center pb-2 mb-2 border-b border-white/8">
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
        {cells.map((day, i) => (
          <div key={i} className="flex items-center justify-center">
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
        ))}
      </div>

      {/* IST badge */}
      <div className="mt-2 pt-2 border-t border-white/8 flex justify-center">
        <span className="text-[10px] text-dark-600 uppercase tracking-widest">UTC +05:30 · Kolkata</span>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats]               = useState(null);
  const [totalUsers, setTotalUsers]     = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  useEffect(() => {
    document.title = 'Admin Dashboard — M.B. JEWELLERS';
    Promise.all([
      orderService.getStats(),
      userService.getAllUsers({ page: 1, limit: 1 }),
      productService.getProducts({ limit: 1 }),
    ]).then(([statsRes, usersRes, productsRes]) => {
      setStats(statsRes.data.stats);
      setTotalUsers(usersRes.data.total || 0);
      setTotalProducts(productsRes.data.pagination?.total || 0);
    }).catch((err) => {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    }).finally(() => setLoading(false));
  }, []);


  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="skeleton w-10 h-10 rounded-xl" />
              <div className="skeleton h-6 rounded w-1/2" />
              <div className="skeleton h-4 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-400 mb-2">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-dark text-sm">Retry</button>
        </div>
      </div>
    );
  }

  const statusCounts = stats?.statusCounts || {};

  return (
    <div className="space-y-3">
      <div>
        <h1 className="font-display text-xl text-white">Dashboard</h1>
        <p className="text-dark-400 text-sm">M.B. JEWELLERS</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={FiDollarSign} title="Total Revenue" value={formatPrice(stats?.totalRevenue || 0)} color="gold" />
        <StatCard icon={FiPackage} title="Total Orders" value={stats?.totalOrders || 0} color="blue" />
        <StatCard icon={FiUsers} title="Total Users" value={totalUsers} color="green" />
        <StatCard icon={FiShoppingBag} title="Products" value={totalProducts} color="purple" />
      </div>

      {/* Order Status · Quick Actions · Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Order Status */}
        <div className="card p-4">
          <h2 className="font-display text-base text-white mb-3">Order Status</h2>
          <div className="space-y-2">
            {[
              { key: 'pending',   label: 'Pending',   dot: 'bg-amber-400',  bar: 'bg-amber-400',  bg: 'bg-amber-400/10',  text: 'text-amber-400',  border: 'border-amber-400/20' },
              { key: 'delivered', label: 'Delivered',  dot: 'bg-emerald-400', bar: 'bg-emerald-400', bg: 'bg-emerald-400/10', text: 'text-emerald-400', border: 'border-emerald-400/20' },
              { key: 'cancelled', label: 'Cancelled',  dot: 'bg-red-400',    bar: 'bg-red-400',    bg: 'bg-red-400/10',    text: 'text-red-400',    border: 'border-red-400/20' },
            ].map(({ key, label, dot, bar, bg, text, border }) => {
              const count = statusCounts[key] ?? statusCounts[label] ?? statusCounts[label.toLowerCase()] ?? 0;
              const pct = Math.min(100, (count / (stats?.totalOrders || 1)) * 100);
              return (
                <div key={key} className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${bg} ${border}`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                  <span className={`text-sm font-medium flex-1 ${text}`}>{label}</span>
                  <div className="w-16 h-1 bg-dark-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-white text-sm font-semibold w-5 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card p-4">
          <h2 className="font-display text-base text-white mb-3">Quick Actions</h2>
          <div className="space-y-1.5">
            {[
              { label: 'Add New Product', to: '/admin/products', icon: FiShoppingBag },
              { label: 'View All Orders', to: '/admin/orders', icon: FiPackage },
              { label: 'Manage Users', to: '/admin/users', icon: FiUsers },
            ].map((item) => {
              const SIcon = item.icon;
              return (
                <Link key={item.to} to={item.to}
                  className="flex items-center gap-3 p-2 rounded-xl bg-dark-800 hover:bg-dark-700 border border-white/5 hover:border-white/10 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg glass-gold flex items-center justify-center">
                    <SIcon size={14} className="text-gold-500" />
                  </div>
                  <span className="text-dark-300 group-hover:text-white text-sm transition-colors">{item.label}</span>
                  <FiArrowRight size={14} className="ml-auto text-dark-600 group-hover:text-gold-400 transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Live Calendar */}
        <LiveCalendar />
      </div>
    </div>
  );
}
