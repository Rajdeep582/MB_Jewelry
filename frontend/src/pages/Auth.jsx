import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { FiEye, FiEyeOff, FiMail, FiLock, FiUser } from 'react-icons/fi';
import { registerUser, loginUser, selectAuthLoading, selectAuthError, clearError } from '../store/authSlice';
import toast from 'react-hot-toast';

function AuthPage({ type }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const from = location.state?.from?.pathname || '/';

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    dispatch(clearError());
    document.title = `${type === 'login' ? 'Sign In' : 'Register'} — M&B Jewelry`;
  }, [type]);

  const validate = () => {
    const e = {};
    if (type === 'register' && !form.name.trim()) e.name = 'Name is required';
    if (!form.email.match(/^\S+@\S+\.\S+$/)) e.email = 'Valid email required';
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (type === 'register' && form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const action = type === 'login'
      ? loginUser({ email: form.email, password: form.password })
      : registerUser({ name: form.name, email: form.email, password: form.password });

    const result = await dispatch(action);
    if (result.meta.requestStatus === 'fulfilled') {
      toast.success(type === 'login' ? 'Welcome back! 💎' : 'Account created! Welcome to M&B Jewelry 💍');
      navigate(from, { replace: true });
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: '' });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1601121141418-d26ce1810f9d?w=1200&q=80"
          alt="Luxury jewelry"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-dark-900/60 to-dark-900/80" />
        <div className="relative z-10 text-center px-12">
          <h2 className="font-display text-4xl text-white mb-4">
            Wear Your <span className="text-gradient-gold">Story</span>
          </h2>
          <p className="text-dark-300 leading-relaxed">
            Unlock exclusive access to our luxury jewelry collection, 
            personalized recommendations, and special member pricing.
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-dark-900">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-full bg-gold-gradient flex items-center justify-center mx-auto mb-4 shadow-gold">
              <span className="text-dark-900 font-bold text-lg font-serif">M</span>
            </div>
            <h1 className="font-display text-2xl text-white">
              {type === 'login' ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-dark-400 text-sm mt-1">
              {type === 'login' ? "Don't have an account?" : 'Already have an account?'}
              {' '}
              <Link
                to={type === 'login' ? '/register' : '/login'}
                className="text-gold-500 hover:text-gold-400 transition-colors"
              >
                {type === 'login' ? 'Register' : 'Sign in'}
              </Link>
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form id={`${type}-form`} onSubmit={handleSubmit} className="space-y-4">
            {type === 'register' && (
              <div>
                <label className="label-dark">Full Name</label>
                <div className="relative">
                  <FiUser size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400" />
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    className={`input-dark pl-10 ${errors.name ? 'border-red-500' : ''}`}
                  />
                </div>
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
              </div>
            )}

            <div>
              <label className="label-dark">Email Address</label>
              <div className="relative">
                <FiMail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className={`input-dark pl-10 ${errors.email ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="label-dark">Password</label>
              <div className="relative">
                <FiLock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min. 8 characters"
                  className={`input-dark pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors"
                >
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
            </div>

            {type === 'register' && (
              <div>
                <label className="label-dark">Confirm Password</label>
                <div className="relative">
                  <FiLock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    className={`input-dark pl-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  />
                </div>
                {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full py-3.5 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                  {type === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : (
                type === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

export const Login = () => <AuthPage type="login" />;
export const Register = () => <AuthPage type="register" />;
