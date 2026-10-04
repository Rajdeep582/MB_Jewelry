import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { loginAdmin, selectAuthLoading, selectAuthError, clearError, selectIsAdmin } from '../../store/authSlice';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiLock, FiEye, FiEyeOff, FiShield, FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import BrandLogo from '../../components/common/BrandLogo';
import toast from 'react-hot-toast';

export default function AdminLogin() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const loading   = useSelector(selectAuthLoading);
  const authError = useSelector(selectAuthError);
  const isAdmin   = useSelector(selectIsAdmin);

  const [form, setForm]       = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);

  if (isAdmin) return <Navigate to="/admin" replace />;

  const set = (k) => (e) => {
    dispatch(clearError());
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await dispatch(loginAdmin({ email: form.email, password: form.password }));
    if (loginAdmin.fulfilled.match(result)) {
      navigate('/admin', { replace: true });
    } else if (loginAdmin.rejected.match(result)) {
      toast.error(result.payload || 'Login failed');
    }
  };

  const inputCls = 'w-full bg-dark-800/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/15 transition-all';

  return (
    <div className="relative min-h-screen bg-dark-950 flex items-center justify-center px-4 py-10 overflow-hidden">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_0%,rgba(212,175,55,0.14),transparent_70%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] bg-[radial-gradient(#D4AF37_1px,transparent_1px)] [background-size:26px_26px]" aria-hidden="true" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[640px] rounded-full border border-gold-500/[0.06]" aria-hidden="true" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[860px] h-[860px] rounded-full border border-dashed border-gold-500/[0.05]" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[380px]"
      >
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-dark-900/85 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
          <span className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" aria-hidden="true" />

          <div className="px-7 pt-7 pb-6">
            <div className="flex justify-center">
              <BrandLogo size="md" to="/" />
            </div>

            <div className="text-center mt-6">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gold-500/25 bg-gold-500/[0.06] text-gold-400 text-[10px] uppercase tracking-[0.25em] font-semibold">
                <FiShield size={11} /> Admin Portal
              </span>
              <h1 className="font-['Cormorant_Garamond',Georgia,serif] text-white text-[1.75rem] font-semibold leading-tight pt-0 mt-3">Sign In</h1>
              <p className="text-dark-400 text-xs mt-1">Welcome back — manage M.B. Jewellers</p>
            </div>

            <AnimatePresence>
              {authError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-5 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    {authError}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-3.5 mt-6">
              <div className="space-y-1.5">
                <label htmlFor="admin-email" className="text-[11px] text-dark-400 uppercase tracking-wider font-medium">Email</label>
                <div className="relative group">
                  <FiMail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500 group-focus-within:text-gold-400 transition-colors" />
                  <input
                    id="admin-email"
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    required
                    autoComplete="username"
                    placeholder="admin@example.com"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="admin-password" className="text-[11px] text-dark-400 uppercase tracking-wider font-medium">Password</label>
                <div className="relative group">
                  <FiLock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500 group-focus-within:text-gold-400 transition-colors" />
                  <input
                    id="admin-password"
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-dark-500 hover:text-gold-400 transition-colors"
                  >
                    {showPwd ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                whileTap={loading ? undefined : { scale: 0.98 }}
                className="group w-full btn-gold py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed !mt-5"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  <>Sign In <FiArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" /></>
                )}
              </motion.button>
            </form>
          </div>

          <div className="px-7 py-3.5 border-t border-white/5 bg-dark-950/40 flex items-center justify-between text-xs">
            <Link to="/" className="inline-flex items-center gap-1.5 text-dark-500 hover:text-gold-400 transition-colors">
              <FiArrowLeft size={12} /> Back to store
            </Link>
            <span className="text-dark-500">
              No account?{' '}
              <Link to="/admin/register" className="text-gold-500 hover:text-gold-400 transition-colors font-medium">
                Register
              </Link>
            </span>
          </div>
        </div>

        <p className="text-center text-dark-600 text-[11px] mt-4 flex items-center justify-center gap-1.5">
          <FiLock size={10} /> Restricted access · Authorized staff only
        </p>
      </motion.div>
    </div>
  );
}
