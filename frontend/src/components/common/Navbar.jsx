import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiShoppingBag, FiUser, FiMenu, FiX, FiSearch, FiChevronDown, FiLogOut, FiPackage, FiSettings, FiStar } from 'react-icons/fi';
import { selectCartCount, openCart } from '../../store/cartSlice';
import { selectIsAuthenticated, selectUser, selectIsAdmin, logoutUser } from '../../store/authSlice';
import toast from 'react-hot-toast';

const navLinks = [
  { to: '/',                   label: 'Home' },
  { to: '/shop',               label: 'Shop' },
  { to: '/shop?material=Gold', label: 'Gold' },
  { to: '/shop?material=Silver', label: 'Silver' },
  { to: '/shop?material=Diamond', label: 'Diamond' },
  { to: '/custom-order',       label: 'Custom Jewelry', highlight: true },
  { to: '/about',              label: 'About' },
  { to: '/contact',            label: 'Contact' },
];

export default function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const cartCount = useSelector(selectCartCount);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  const isAdmin = useSelector(selectIsAdmin);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    setProfileOpen(false);
    navigate('/');
    toast.success('Logged out successfully');
  };

  return (
    <motion.nav
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b ${
        scrolled ? 'bg-dark-900/90 backdrop-blur-md border-white/10 shadow-xl' : 'bg-transparent border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-full bg-gold-gradient flex items-center justify-center shadow-gold group-hover:shadow-gold-lg transition-shadow duration-300">
              <span className="text-dark-900 font-bold text-sm font-serif">M</span>
            </div>
            <span className="text-xl font-display font-medium text-white">
              M<span className="text-gradient-gold">&</span>B
              <span className="text-sm text-dark-400 ml-1 font-sans font-normal hidden sm:inline">Jewelry</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map(({ to, label, highlight }) => {
              const toPath = to.split('?')[0];
              const toSearch = to.split('?')[1] || '';
              
              let isActive = false;
              if (to === '/') {
                isActive = location.pathname === '/';
              } else if (toSearch) {
                isActive = location.pathname === toPath && location.search.includes(toSearch);
              } else if (toPath === '/shop') {
                isActive = location.pathname.startsWith(toPath) && !location.search.includes('material');
              } else {
                isActive = location.pathname.startsWith(toPath);
              }

              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className={`nav-link relative ${isActive ? 'nav-link-active text-gold-500' : ''} ${
                    highlight && !isActive ? 'text-gold-400 hover:text-gold-300' : ''
                  }`}
                >
                  {label}
                  {highlight && (
                    <span className="absolute -top-2 -right-3 text-gold-400 text-xs animate-pulse">✦</span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <button
              onClick={() => navigate('/shop', { state: { focusSearch: true } })}
              className="p-2 text-dark-300 hover:text-gold-500 transition-colors duration-200"
              aria-label="Search"
            >
              <FiSearch size={20} />
            </button>

            {/* Cart */}
            <button
              id="cart-btn"
              onClick={() => dispatch(openCart())}
              className="relative p-2 text-dark-300 hover:text-gold-500 transition-colors duration-200"
              aria-label="Shopping cart"
            >
              <FiShoppingBag size={20} />
              {cartCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gold-500 text-dark-900 text-xs font-bold flex items-center justify-center"
                >
                  {cartCount > 9 ? '9+' : cartCount}
                </motion.span>
              )}
            </button>

            {/* User */}
            {isAuthenticated ? (
              <div ref={profileRef} className="relative hidden lg:block">
                <button
                  id="profile-btn"
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-2 text-dark-300 hover:text-white transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gold-gradient flex items-center justify-center text-dark-900 text-sm font-bold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <FiChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-52 glass rounded-xl shadow-card-hover overflow-hidden"
                    >
                      <div className="p-3 border-b border-white/10">
                        <p className="text-sm font-medium text-white">{user?.name}</p>
                        <p className="text-xs text-dark-400">{user?.email}</p>
                      </div>
                      <div className="p-1">
                        {isAdmin && (
                          <Link
                            to="/admin"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gold-400 hover:bg-gold-500/10 transition-colors"
                          >
                            <FiSettings size={14} /> Admin Panel
                          </Link>
                        )}
                        <Link
                          to="/profile"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-dark-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <FiUser size={14} /> Profile
                        </Link>
                        <Link
                          to="/orders"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-dark-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <FiPackage size={14} /> Orders
                        </Link>
                        <Link
                          to="/custom-orders"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gold-400 hover:bg-gold-500/10 transition-colors"
                        >
                          <FiStar size={14} /> Custom Orders
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <FiLogOut size={14} /> Logout
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden lg:flex btn-outline-gold text-sm py-2 px-4"
              >
                Sign In
              </Link>
            )}

            {/* Mobile Hamburger */}
            <button
              id="mobile-menu-btn"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-dark-300 hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <FiX size={22} /> : <FiMenu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden glass border-t border-white/10 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map(({ to, label, highlight }) => {
                const toPath = to.split('?')[0];
                const toSearch = to.split('?')[1] || '';
                
                let isActive = false;
                if (to === '/') {
                  isActive = location.pathname === '/';
                } else if (toSearch) {
                  isActive = location.pathname === toPath && location.search.includes(toSearch);
                } else if (toPath === '/shop') {
                  isActive = location.pathname.startsWith(toPath) && !location.search.includes('material');
                } else {
                  isActive = location.pathname.startsWith(toPath);
                }

                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => { setMobileOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-between ${
                      isActive
                        ? 'bg-gold-500/10 text-gold-400'
                        : highlight
                        ? 'text-gold-400 hover:bg-gold-500/10'
                        : 'text-dark-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {label}
                    {highlight && <span className="text-gold-400 text-xs">✦</span>}
                  </Link>
                );
              })}

              <div className="pt-3 mt-3 border-t border-white/10 space-y-1">
                {isAuthenticated ? (
                  <>
                    <div className="px-4 py-2">
                      <p className="text-sm font-medium text-white">{user?.name}</p>
                      <p className="text-xs text-dark-400">{user?.email}</p>
                    </div>
                    {isAdmin && (
                      <Link to="/admin" onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-gold-400 hover:bg-gold-500/10">
                        <FiSettings size={14} /> Admin Panel
                      </Link>
                    )}
                    <Link to="/profile" onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-dark-300 hover:text-white hover:bg-white/5">
                      <FiUser size={14} /> Profile
                    </Link>
                    <Link to="/orders" onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-dark-300 hover:text-white hover:bg-white/5">
                      <FiPackage size={14} /> Orders
                    </Link>
                    <Link to="/custom-orders" onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-gold-400 hover:bg-gold-500/10">
                      <FiStar size={14} /> Custom Orders
                    </Link>
                    <button onClick={() => { handleLogout(); setMobileOpen(false); }}
                      className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10">
                      <FiLogOut size={14} /> Logout
                    </button>
                  </>
                ) : (
                  <div className="flex gap-2 px-4 pt-1">
                    <Link to="/login" onClick={() => setMobileOpen(false)} className="flex-1 btn-outline-gold text-sm py-2.5 text-center">
                      Sign In
                    </Link>
                    <Link to="/register" onClick={() => setMobileOpen(false)} className="flex-1 btn-gold text-sm py-2.5 text-center">
                      Register
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
