import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { loginAdmin, selectAuthLoading, selectAuthError, clearError, selectIsAdmin } from '../../store/authSlice';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
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

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold-gradient shadow-[0_0_24px_rgba(212,175,55,0.3)] mb-4">
            <span className="text-dark-900 font-bold text-lg tracking-tight">MB</span>
          </div>
          <h1 className="font-display text-2xl text-white">Admin Portal</h1>
          <p className="text-dark-500 text-sm mt-1">M.B. Jewellers Management</p>
        </div>

        <div className="card p-6 border border-white/8">
          <h2 className="text-white font-semibold text-lg mb-5">Sign In</h2>

          {authError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-dark-400 uppercase tracking-wider">Email</label>
              <div className="relative">
                <FiMail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  required
                  placeholder="admin@example.com"
                  className="w-full bg-dark-800 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-gold-500/50 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-dark-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <FiLock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  required
                  placeholder="••••••••"
                  className="w-full bg-dark-800 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-gold-500/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300"
                >
                  {showPwd ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-gold py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-dark-600 text-xs mt-5">
            No account?{' '}
            <Link to="/admin/register" className="text-gold-500 hover:text-gold-400 transition-colors">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
