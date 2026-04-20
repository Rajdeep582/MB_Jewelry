import { useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import {
  FiGrid, FiPackage, FiShoppingBag, FiUsers, FiTrendingUp,
  FiLogOut, FiMenu, FiX, FiDollarSign, FiTruck, FiEdit2
} from 'react-icons/fi';
import { logoutUser } from '../../store/authSlice';
import toast from 'react-hot-toast';

const adminLinks = [
  { to: '/admin',            label: 'Dashboard',          icon: FiGrid,       end: true },
  { to: '/admin/products',   label: 'Products',           icon: FiShoppingBag },
  { to: '/admin/pricing',    label: 'Pricing & Discounts', icon: FiDollarSign },
  { to: '/admin/orders',     label: 'Orders',             icon: FiPackage },
  { to: '/admin/custom-orders', label: 'Custom Orders',   icon: FiEdit2 },
  { to: '/admin/deliveries', label: 'Deliveries',         icon: FiTruck },
  { to: '/admin/users',      label: 'Users',              icon: FiUsers },
];

export default function AdminLayout() {
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/');
    toast.success('Logged out');
  };

  const renderSidebar = ({ mobile = false }) => (
    <div className={`flex flex-col h-full ${mobile ? '' : 'w-60 flex-shrink-0'}`}>
      <div className="p-5 border-b border-white/10">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gold-gradient flex items-center justify-center">
            <span className="text-dark-900 font-bold text-sm">M</span>
          </div>
          <div>
            <p className="text-white font-display text-sm">M&B Jewelry</p>
            <p className="text-gold-500 text-xs">Admin Panel</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {adminLinks.map((item) => {
           
          const SIcon = item.icon;
          const isActive = item.end
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                isActive
                  ? 'bg-gold-500/10 text-gold-400 border border-gold-500/20'
                  : 'text-dark-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <SIcon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-dark-400 hover:text-white hover:bg-white/5 transition-colors mb-1">
          <FiTrendingUp size={16} /> View Store
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <FiLogOut size={16} /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-dark-950">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col glass border-r border-white/10 sticky top-0 h-screen">
        {renderSidebar({})}
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <motion.aside
            initial={{ x: -240 }}
            animate={{ x: 0 }}
            exit={{ x: -240 }}
            className="relative w-60 h-full glass border-r border-white/10 flex flex-col"
          >
            {renderSidebar({ mobile: true })}
          </motion.aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (mobile) */}
        <div className="lg:hidden flex items-center gap-3 p-4 glass border-b border-white/10 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-dark-400 hover:text-white">
            <FiMenu size={20} />
          </button>
          <span className="text-white font-display">Admin Panel</span>
        </div>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
