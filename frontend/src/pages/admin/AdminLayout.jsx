import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiGrid, FiPackage, FiShoppingBag, FiUsers, FiTrendingUp,
  FiLogOut, FiMenu, FiTruck, FiEdit2, FiChevronsLeft, FiUser,
} from 'react-icons/fi';
import { MdCurrencyRupee } from 'react-icons/md';
import { logoutUser } from '../../store/authSlice';
import { orderService, customOrderService } from '../../services/services';
import toast from 'react-hot-toast';

const adminLinks = [
  { to: '/admin',               label: 'Dashboard',     icon: FiGrid,          end: true,  attentionKey: null },
  { to: '/admin/products',      label: 'Products',      icon: FiShoppingBag,   end: false, attentionKey: null },
  { to: '/admin/pricing',       label: 'Pricing',       icon: MdCurrencyRupee, end: false, attentionKey: null },
  { to: '/admin/orders',        label: 'Orders',        icon: FiPackage,       end: false, attentionKey: 'orders' },
  { to: '/admin/custom-orders', label: 'Custom Orders', icon: FiEdit2,         end: false, attentionKey: 'customOrders' },
  { to: '/admin/deliveries',    label: 'Deliveries',    icon: FiTruck,         end: false, attentionKey: 'deliveries' },
  { to: '/admin/users',         label: 'Users',         icon: FiUsers,         end: false, attentionKey: null },
];

function NavItem({ item, isActive, hasAttention, expanded, onClick }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={`group relative flex items-center gap-3 rounded-xl transition-all duration-200 ${
        expanded ? 'px-3 py-2.5 w-full' : 'w-12 h-12 justify-center'
      } ${
        isActive
          ? 'bg-gold-500/15 text-gold-400 shadow-[0_0_10px_rgba(212,175,55,0.15)]'
          : 'text-dark-500 hover:text-white hover:bg-white/8'
      }`}
    >
      <div className="relative flex-shrink-0 flex items-center justify-center w-5 h-5">
        <Icon size={20} />
        {hasAttention && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)] animate-pulse" />
        )}
      </div>
      {expanded && <span className="text-sm font-medium flex-1 truncate">{item.label}</span>}
      {expanded && hasAttention && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />}
      {!expanded && (
        <span className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-lg bg-dark-800 border border-white/10 px-2.5 py-1.5 text-xs text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 select-none">
          {item.label}
          {hasAttention && <span className="ml-1.5 text-amber-400 text-[10px]">●</span>}
        </span>
      )}
    </Link>
  );
}

export default function AdminLayout() {
  const location  = useLocation();
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const admin     = useSelector(s => s.auth.user);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded,   setExpanded]   = useState(false);
  const [attention,  setAttention]  = useState({ orders: 0, customOrders: 0, deliveries: 0 });
  const timerRef = useRef(null);

  const fetchAttention = useCallback(async () => {
    try {
      const [orderRes, customRes] = await Promise.all([
        orderService.getStats(),
        customOrderService.getStats(),
      ]);
      const sc  = orderRes.data.stats?.statusCounts  || {};
      const csc = customRes.data.stats?.statusCounts || {};
      setAttention({
        orders:       (sc.confirmed  || 0) + (sc.pending || 0),
        customOrders: (csc.pending   || 0) + (csc.quoted || 0),
        deliveries:   (sc.shipped    || 0),
      });
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchAttention();
    timerRef.current = setInterval(fetchAttention, 30_000);
    return () => clearInterval(timerRef.current);
  }, [fetchAttention]);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/');
    toast.success('Logged out');
  };

  const SidebarContent = ({ isExpanded, onLinkClick, onToggle }) => (
    <div className={`flex flex-col h-full py-4 gap-1 transition-all duration-300 ${isExpanded ? 'w-56' : 'w-16 items-center'}`}>

      {/* Header: logo + toggle button */}
      <div className={`flex items-center mb-3 ${isExpanded ? 'px-3 justify-between' : 'flex-col gap-2 justify-center'}`}>
        <Link to="/" className="group relative flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gold-gradient flex-shrink-0 flex items-center justify-center shadow-[0_0_14px_rgba(212,175,55,0.2)] hover:shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-shadow">
            <span className="text-dark-900 font-bold text-[11px] tracking-tight">MB</span>
          </div>
          {isExpanded && (
            <div className="min-w-0">
              <p className="text-white font-display text-xs tracking-wide leading-none">M.B. JEWELLERS</p>
              <p className="text-gold-500 text-[10px] mt-0.5">Admin Panel</p>
            </div>
          )}
          {!isExpanded && (
            <span className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-lg bg-dark-800 border border-white/10 px-2.5 py-1.5 text-xs text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity select-none">
              M.B. Jewellers
            </span>
          )}
        </Link>

        {/* Hamburger / collapse button */}
        <button
          onClick={onToggle}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-dark-500 hover:text-white hover:bg-white/8 transition-all"
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? <FiChevronsLeft size={15} /> : <FiMenu size={15} />}
        </button>
      </div>

      <div className={`h-px bg-white/10 mb-1 ${isExpanded ? 'mx-3' : 'w-6'}`} />

      {/* Nav */}
      <nav className={`flex-1 flex flex-col gap-1 ${isExpanded ? 'px-2' : 'w-full items-center'}`}>
        {adminLinks.map((item) => {
          const isActive     = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
          const hasAttention = item.attentionKey ? (attention[item.attentionKey] || 0) > 0 : false;
          return (
            <NavItem
              key={item.to}
              item={item}
              isActive={isActive}
              hasAttention={hasAttention}
              expanded={isExpanded}
              onClick={onLinkClick}
            />
          );
        })}
      </nav>

      {/* Bottom */}
      <div className={`flex flex-col gap-0.5 mt-1 pt-2 border-t border-white/8 ${isExpanded ? 'px-2' : 'w-full items-center'}`}>

        {/* Profile widget */}
        <Link
          to="/admin/profile"
          className={`group relative flex items-center gap-3 rounded-xl transition-all duration-200 mb-1
            bg-gradient-to-r from-gold-500/8 to-transparent
            border border-gold-500/15 hover:border-gold-500/35
            hover:from-gold-500/14
            shadow-[0_0_10px_rgba(212,175,55,0.06)] hover:shadow-[0_0_16px_rgba(212,175,55,0.2)]
            ${isExpanded ? 'px-3 py-2 w-full' : 'w-10 h-10 justify-center'}`}
        >
          <div className="relative flex-shrink-0 w-7 h-7 rounded-full
            bg-gradient-to-br from-gold-400/40 to-gold-600/25
            border border-gold-500/50
            shadow-[0_0_10px_rgba(212,175,55,0.4)]
            group-hover:shadow-[0_0_16px_rgba(212,175,55,0.65)]
            group-hover:border-gold-400/80
            flex items-center justify-center transition-all duration-300">
            <span className="text-gold-200 text-xs font-bold leading-none">{admin?.name?.[0]?.toUpperCase() || 'A'}</span>
          </div>
          {isExpanded && (
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium leading-none truncate">{admin?.name || 'Admin'}</p>
              <p className="text-gold-600 text-[10px] mt-0.5 truncate">{admin?.email || ''}</p>
            </div>
          )}
          {!isExpanded && (
            <span className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-lg bg-dark-800 border border-white/10 px-2.5 py-1.5 text-xs text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity select-none">
              My Profile
            </span>
          )}
        </Link>

        <button
          onClick={handleLogout}
          className={`group relative flex items-center gap-3 rounded-xl text-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition-all ${
            isExpanded ? 'px-3 py-2.5 w-full' : 'w-12 h-12 justify-center'
          }`}
        >
          <FiLogOut size={17} className="flex-shrink-0" />
          {isExpanded && <span className="text-sm">Logout</span>}
          {!isExpanded && (
            <span className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-lg bg-dark-800 border border-white/10 px-2.5 py-1.5 text-xs text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity select-none">
              Logout
            </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="admin-panel min-h-screen flex bg-dark-950 relative">

      {/* Desktop sidebar — animated width */}
      <motion.aside
        animate={{ width: expanded ? 224 : 64 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden lg:flex flex-col glass border-r border-white/8 sticky top-0 h-screen flex-shrink-0 overflow-hidden"
      >
        <SidebarContent
          isExpanded={expanded}
          onLinkClick={undefined}
          onToggle={() => setExpanded(v => !v)}
        />
      </motion.aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            <motion.aside
              initial={{ x: -224 }}
              animate={{ x: 0 }}
              exit={{ x: -224 }}
              transition={{ type: 'spring', stiffness: 350, damping: 32 }}
              className="relative h-full glass border-r border-white/8 flex flex-col overflow-hidden"
              style={{ width: 224 }}
            >
              <SidebarContent
                isExpanded={true}
                onLinkClick={() => setMobileOpen(false)}
                onToggle={() => setMobileOpen(false)}
              />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 p-3 glass border-b border-white/8 sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-dark-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            <FiMenu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gold-gradient flex items-center justify-center">
              <span className="text-dark-900 font-bold text-[9px]">MB</span>
            </div>
            <span className="text-white font-display text-sm">Admin Panel</span>
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
