import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiEye, FiEyeOff, FiMail, FiLock, FiUser, FiPhone, FiTruck, FiCreditCard,
} from 'react-icons/fi';
import {
  loginDP, registerDP, selectAuthLoading, selectAuthError, clearError,
} from '../store/authSlice';
import toast from 'react-hot-toast';

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

const slideVariants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -30 },
};

const inputClass =
  'w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 pl-11 text-dark-100 placeholder-dark-500 focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500/30 transition-all text-sm';

function InputIcon({ icon: Icon }) {
  return (
    <Icon
      size={16}
      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500"
    />
  );
}
InputIcon.propTypes = { icon: PropTypes.elementType.isRequired };

function PasswordStrength({ password }) {
  const checks = [
    { label: '8+ chars',      pass: password.length >= 8 },
    { label: 'Letter',        pass: /[A-Za-z]/.test(password) },
    { label: 'Number',        pass: /\d/.test(password) },
    { label: 'Special char',  pass: /[@$!%*#?&]/.test(password) },
  ];
  const score = checks.filter(c => c.pass).length;
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0,1,2,3].map(i => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ backgroundColor: i < score ? colors[score - 1] : '#374151' }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {checks.map(c => (
          <span key={c.label} className="text-xs flex items-center gap-1 transition-colors"
            style={{ color: c.pass ? '#22c55e' : '#6b7280' }}>
            <span>{c.pass ? '✓' : '○'}</span> {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
PasswordStrength.propTypes = { password: PropTypes.string };

// ─── Main Component ───────────────────────────────────────────────────────────
function DeliveryAuthPage({ type }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const loading  = useSelector(selectAuthLoading);
  const error    = useSelector(selectAuthError);

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    phone: '', vehicleNumber: '', dispatchZone: '',
    gender: '', aadhaarNumber: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    dispatch(clearError());
    document.title = `${type === 'login' ? 'Partner Sign In' : 'Partner Register'} — M.B. JEWELLERS`;
  }, [type, dispatch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
  };

  const validate = () => {
    const e = {};
    if (type === 'register') {
      if (!form.name.trim()) e.name = 'Name is required';
      if (!form.phone.trim()) e.phone = 'Phone is required';
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Valid email required';
    if (!PASSWORD_REGEX.test(form.password))
      e.password = 'Min 8 chars, 1 letter, 1 number, 1 special char';
    if (type === 'register' && form.password !== form.confirmPassword)
      e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (type === 'login') {
      const result = await dispatch(loginDP({ email: form.email.trim(), password: form.password }));
      if (result.meta.requestStatus === 'fulfilled') {
        toast.success('Welcome back!');
        navigate('/delivery', { replace: true });
      } else if (result.meta.requestStatus === 'rejected') {
        toast.error(result.payload || 'Login failed');
      }
      return;
    }

    // Register
    const result = await dispatch(registerDP({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      phone: form.phone.trim(),
      vehicleNumber: form.vehicleNumber.trim(),
      dispatchZone: form.dispatchZone.trim(),
      gender: form.gender,
      aadhaarNumber: form.aadhaarNumber.replace(/\s/g, ''),
    }));
    if (result.meta.requestStatus === 'fulfilled') {
      setRegistered(true);
    }
  };

  if (registered) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center bg-dark-900 border border-dark-700 rounded-2xl p-10"
        >
          <div className="w-16 h-16 rounded-full bg-gold-500/10 flex items-center justify-center mx-auto mb-5">
            <FiTruck size={28} className="text-gold-500" />
          </div>
          <h2 className="text-2xl font-bold text-dark-100 mb-3">Registration Submitted!</h2>
          <p className="text-dark-400 text-sm leading-relaxed mb-6">
            Your delivery partner account is pending admin approval.<br />
            You'll be able to log in once approved.
          </p>
          <Link
            to="/delivery/login"
            className="inline-block text-gold-500 hover:text-gold-400 text-sm font-medium transition-colors"
          >
            Go to Partner Login →
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <Link to="/" className="inline-block">
            <div className="text-2xl font-bold tracking-widest text-gold-500 font-serif">
              M.B. JEWELLERS
            </div>
            <div className="text-xs text-dark-500 tracking-[4px] uppercase mt-1">
              Delivery Partner Portal
            </div>
          </Link>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={type}
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="bg-dark-900 border border-dark-700 rounded-2xl p-8 shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-gold-500/10 flex items-center justify-center">
                <FiTruck size={18} className="text-gold-500" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-dark-100">
                  {type === 'login' ? 'Partner Sign In' : 'Partner Registration'}
                </h1>
                <p className="text-xs text-dark-500">
                  {type === 'login' ? 'Access your delivery dashboard' : 'Apply as a delivery partner'}
                </p>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {type === 'register' && (
                <>
                  {/* Name */}
                  <div>
                    <label htmlFor="dp-name" className="block text-xs font-medium text-dark-400 mb-1.5">Full Name</label>
                    <div className="relative">
                      <InputIcon icon={FiUser} />
                      <input
                        id="dp-name"
                        type="text" name="name" value={form.name}
                        onChange={handleChange} placeholder="Your full name"
                        className={inputClass}
                      />
                    </div>
                    {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                  </div>

                  {/* Phone */}
                  <div>
                    <label htmlFor="dp-phone" className="block text-xs font-medium text-dark-400 mb-1.5">Phone Number</label>
                    <div className="relative">
                      <InputIcon icon={FiPhone} />
                      <input
                        id="dp-phone"
                        type="tel" name="phone" value={form.phone}
                        onChange={handleChange} placeholder="10-digit mobile number"
                        className={inputClass}
                      />
                    </div>
                    {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                  </div>

                  {/* Gender */}
                  <div>
                    <label htmlFor="dp-gender" className="block text-xs font-medium text-dark-400 mb-1.5">Gender</label>
                    <select
                      id="dp-gender"
                      name="gender" value={form.gender} onChange={handleChange}
                      className="w-full bg-dark-800 border border-dark-600 rounded-xl px-4 py-3 text-dark-100 focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500/30 transition-all text-sm"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Aadhaar */}
                  <div>
                    <label htmlFor="dp-aadhaar" className="block text-xs font-medium text-dark-400 mb-1.5">Aadhaar Number</label>
                    <div className="relative">
                      <InputIcon icon={FiCreditCard} />
                      <input
                        id="dp-aadhaar"
                        type="text" name="aadhaarNumber" value={form.aadhaarNumber}
                        onChange={handleChange} placeholder="12-digit Aadhaar number"
                        maxLength={12}
                        className={inputClass}
                      />
                    </div>
                    {errors.aadhaarNumber && <p className="text-red-400 text-xs mt-1">{errors.aadhaarNumber}</p>}
                  </div>

                  {/* Vehicle + Zone */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="dp-vehicle" className="block text-xs font-medium text-dark-400 mb-1.5">Vehicle Number</label>
                      <input
                        id="dp-vehicle"
                        type="text" name="vehicleNumber" value={form.vehicleNumber}
                        onChange={handleChange} placeholder="e.g. MH12AB1234"
                        className="w-full bg-dark-800 border border-dark-600 rounded-xl px-3 py-3 text-dark-100 placeholder-dark-500 focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500/30 transition-all text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="dp-zone" className="block text-xs font-medium text-dark-400 mb-1.5">Dispatch Zone</label>
                      <input
                        id="dp-zone"
                        type="text" name="dispatchZone" value={form.dispatchZone}
                        onChange={handleChange} placeholder="e.g. Mumbai North"
                        className="w-full bg-dark-800 border border-dark-600 rounded-xl px-3 py-3 text-dark-100 placeholder-dark-500 focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500/30 transition-all text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Email */}
              <div>
                <label htmlFor="dp-email" className="block text-xs font-medium text-dark-400 mb-1.5">Email Address</label>
                <div className="relative">
                  <InputIcon icon={FiMail} />
                  <input
                    id="dp-email"
                    type="email" name="email" value={form.email}
                    onChange={handleChange} placeholder="partner@example.com"
                    className={inputClass}
                  />
                </div>
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="dp-password" className="block text-xs font-medium text-dark-400 mb-1.5">Password</label>
                <div className="relative">
                  <InputIcon icon={FiLock} />
                  <input
                    id="dp-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password" value={form.password}
                    onChange={handleChange} placeholder="••••••••"
                    className={inputClass + ' pr-11'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300 transition-colors"
                  >
                    {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                {type === 'register' && <PasswordStrength password={form.password} />}
              </div>

              {/* Confirm Password */}
              {type === 'register' && (
                <div>
                  <label htmlFor="dp-confirm-password" className="block text-xs font-medium text-dark-400 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <InputIcon icon={FiLock} />
                    <input
                      id="dp-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      name="confirmPassword" value={form.confirmPassword}
                      onChange={handleChange} placeholder="••••••••"
                      className={inputClass}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 mt-2
                  bg-gradient-to-r from-gold-600 to-gold-500 text-dark-950
                  hover:from-gold-500 hover:to-gold-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading
                  ? (type === 'login' ? 'Signing in…' : 'Submitting…')
                  : (type === 'login' ? 'Sign In' : 'Apply as Partner')
                }
              </button>
            </form>

            {/* Switch */}
            <p className="mt-5 text-center text-dark-500 text-sm">
              {type === 'login' ? (
                <>Not registered yet?{' '}
                  <Link to="/delivery/register" className="text-gold-500 hover:text-gold-400 font-medium transition-colors">
                    Apply as Partner
                  </Link>
                </>
              ) : (
                <>Already registered?{' '}
                  <Link to="/delivery/login" className="text-gold-500 hover:text-gold-400 font-medium transition-colors">
                    Sign In
                  </Link>
                </>
              )}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Back to shop */}
        <p className="text-center mt-6 text-dark-600 text-xs">
          <Link to="/" className="hover:text-dark-400 transition-colors">← Back to M.B. Jewellers</Link>
        </p>
      </div>
    </div>
  );
}

DeliveryAuthPage.propTypes = { type: PropTypes.oneOf(['login', 'register']).isRequired };

export function DeliveryLogin()    { return <DeliveryAuthPage type="login" />; }
export function DeliveryRegister() { return <DeliveryAuthPage type="register" />; }
