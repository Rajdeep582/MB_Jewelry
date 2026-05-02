import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiEye, FiEyeOff, FiMail, FiLock, FiUser, FiKey,
  FiArrowLeft, FiCheckCircle, FiRefreshCw, FiShield,
} from 'react-icons/fi';
import {
  registerUser, loginUser, loginWithGoogle, loginWithFacebook, selectAuthLoading, selectAuthError, clearError,
} from '../store/authSlice';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import _FacebookLoginModule from 'react-facebook-login/dist/facebook-login-render-props';
// react-facebook-login ships as CJS; Vite may wrap it under .default — unwrap safely
const FacebookLogin = _FacebookLoginModule.default || _FacebookLoginModule;
import { FaFacebookF } from 'react-icons/fa';
import toast from 'react-hot-toast';
import api from '../services/api';

// ─── Shared helpers ───────────────────────────────────────────────────────────
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

const slideVariants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -30 },
};

// ─── Password strength meter ──────────────────────────────────────────────────
function PasswordStrength({ password }) {
  const checks = [
    { label: '8+ characters', pass: password.length >= 8 },
    { label: 'Letter',        pass: /[A-Za-z]/.test(password) },
    { label: 'Number',        pass: /\d/.test(password) },
    { label: 'Special char',  pass: /[@$!%*#?&]/.test(password) },
  ];
  const score = checks.filter(c => c.pass).length;
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ backgroundColor: i < score ? colors[score - 1] : '#374151' }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {checks.map(c => (
          <span
            key={c.label}
            className="text-xs flex items-center gap-1 transition-colors"
            style={{ color: c.pass ? '#22c55e' : '#6b7280' }}
          >
            <span>{c.pass ? '✓' : '○'}</span> {c.label}
          </span>
        ))}
      </div>
      {score === 4 && (
        <p className="text-xs" style={{ color: colors[3] }}>
          {labels[score - 1]} password
        </p>
      )}
    </div>
  );
}

PasswordStrength.propTypes = {
  password: PropTypes.string,
};

// ─── Resend countdown button ──────────────────────────────────────────────────
function ResendButton({ onResend, loading }) {
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    if (seconds > 0) {
      const t = setTimeout(() => setSeconds(s => s - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [seconds]);

  const canResend = seconds <= 0;

  const handleResend = async () => {
    setSeconds(60);
    await onResend();
  };

  if (canResend) {
    return (
      <button
        type="button"
        onClick={handleResend}
        disabled={loading}
        className="text-sm text-gold-500 hover:text-gold-400 transition-colors flex items-center gap-1.5 disabled:opacity-50"
      >
        <FiRefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Sending…' : 'Resend code'}
      </button>
    );
  }

  return (
    <span className="text-sm text-dark-500">
      Resend in <span className="text-dark-300 font-medium tabular-nums">{seconds}s</span>
    </span>
  );
}

ResendButton.propTypes = {
  onResend: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

// ─── Main Auth page ───────────────────────────────────────────────────────────
function AuthPage({ type }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const dispatch  = useDispatch();
  const loading   = useSelector(selectAuthLoading);
  const error     = useSelector(selectAuthError);
  const from      = location.state?.from?.pathname || '/';

  // ── State ──────────────────────────────────────────────────────────────────
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword]   = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [errors, setErrors]               = useState({});

  // Registration OTP step
  const [step, setStep]           = useState('form'); // 'form' | 'otp' | 'forgot-email' | 'forgot-otp' | 'reset-password'
  const [otp, setOtp]             = useState('');
  const [verifying, setVerifying] = useState(false);

  // Forgot password state
  const [fpEmail, setFpEmail]       = useState('');
  const [fpEmailError, setFpEmailError] = useState('');
  const [fpLoading, setFpLoading]   = useState(false);
  const [fpOtp, setFpOtp]           = useState('');
  const [fpOtpError, setFpOtpError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [newPwdErrors, setNewPwdErrors] = useState({});
  const [resetting, setResetting]   = useState(false);

  useEffect(() => {
    dispatch(clearError());
    const titles = {
      form:             type === 'login' ? 'Sign In' : 'Register',
      otp:              'Verify Email',
      'forgot-email':   'Forgot Password',
      'forgot-otp':     'Enter Reset Code',
      'reset-password': 'Set New Password',
    };
    document.title = `${titles[step] || 'Auth'} — M&B Jewelry`;
  }, [type, step, dispatch]);

  // ── Registration form validation ────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (type === 'register' && !form.name.trim()) e.name = 'Name is required';
    if (!form.email.match(/^\S+@\S+\.\S+$/)) e.email = 'Valid email required';
    if (!PASSWORD_REGEX.test(form.password)) {
      e.password = 'Password must have min 8 chars, 1 letter, 1 number & 1 special char';
    }
    if (type === 'register' && form.password !== form.confirmPassword) {
      e.confirmPassword = 'Passwords do not match';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: '' });
  };

  // ── Registration / Login submit ─────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const action = type === 'login'
      ? loginUser({ email: form.email, password: form.password })
      : registerUser({ name: form.name, email: form.email, password: form.password });

    const result = await dispatch(action);
    if (result.meta.requestStatus === 'fulfilled') {
      if (type === 'login') {
        toast.success('Welcome back! 💎');
        navigate(from, { replace: true });
      } else {
        toast.success('Account created! Please check your email for the OTP.');
        setStep('otp');
      }
    }
  };

  // ── Registration OTP verify ─────────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return toast.error('OTP must be exactly 6 digits');
    setVerifying(true);
    try {
      const res = await api.post('/auth/verify-otp', { email: form.email, otp });
      toast.success(res.data.message);
      setForm({ name: '', email: '', password: '', confirmPassword: '' });
      setOtp('');
      setStep('form');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  // ── Forgot password — Step 1: send OTP ─────────────────────────────────────
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!fpEmail.match(/^\S+@\S+\.\S+$/)) {
      setFpEmailError('Please enter a valid email address');
      return;
    }
    setFpEmailError('');
    setFpLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: fpEmail });
      // Always show success (backend never reveals if email exists)
      toast.success('Reset code sent! Check your inbox.');
      setStep('forgot-otp');
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong. Please try again.';
      if (err.response?.status === 429) {
        toast.error(msg);
      } else {
        setFpEmailError(msg);
      }
    } finally {
      setFpLoading(false);
    }
  };

  // Resend OTP (reuses the same forgot-password endpoint)
  const handleResendOtp = useCallback(async () => {
    setFpLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: fpEmail });
      toast.success('New reset code sent!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resend code. Try again shortly.');
    } finally {
      setFpLoading(false);
    }
  }, [fpEmail]);

  // ── Forgot password — Step 2: verify OTP ────────────────────────────────────
  const handleForgotOtpSubmit = async (e) => {
    e.preventDefault();
    if (fpOtp.length !== 6) {
      setFpOtpError('Please enter the 6-digit code');
      return;
    }
    setFpOtpError('');
    setFpLoading(true);
    try {
      const res = await api.post('/auth/verify-reset-otp', { email: fpEmail, otp: fpOtp });
      setResetToken(res.data.resetToken);
      toast.success('Code verified!');
      setStep('reset-password');
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid code. Please try again.';
      setFpOtpError(msg);
      if (err.response?.status === 403) {
        // Max attempts reached — go back to email step
        setTimeout(() => setStep('forgot-email'), 2000);
      }
    } finally {
      setFpLoading(false);
    }
  };

  // ── Forgot password — Step 3: set new password ──────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    const e2 = {};
    if (!PASSWORD_REGEX.test(newPassword)) {
      e2.newPassword = 'Password must have min 8 chars, 1 letter, 1 number & 1 special char';
    }
    if (newPassword !== confirmNewPassword) {
      e2.confirmNewPassword = 'Passwords do not match';
    }
    setNewPwdErrors(e2);
    if (Object.keys(e2).length > 0) return;

    setResetting(true);
    try {
      const res = await api.post('/auth/reset-password', { email: fpEmail, resetToken, newPassword });
      toast.success(res.data.message);
      // Clean up and redirect to login
      setFpEmail(''); setFpOtp(''); setResetToken('');
      setNewPassword(''); setConfirmNewPassword('');
      setStep('form');
      navigate('/login');
    } catch (err) {
      const msg = err.response?.data?.message || 'Reset failed. Please start over.';
      if (err.response?.status === 400 && msg.includes('expired')) {
        toast.error(msg);
        setStep('forgot-email');
      } else {
        setNewPwdErrors({ newPassword: msg });
      }
    } finally {
      setResetting(false);
    }
  };

  // ─── Step title/subtitle helpers ────────────────────────────────────────────
  const stepTitle = () => {
    if (step === 'otp')             return 'Verify Your Email';
    if (step === 'forgot-email')    return 'Forgot Password?';
    if (step === 'forgot-otp')      return 'Enter Reset Code';
    if (step === 'reset-password')  return 'Set New Password';
    return type === 'login' ? 'Welcome Back' : 'Create Account';
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex">
      {/* ── Left decorative panel ── */}
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

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-dark-900">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-full bg-gold-gradient flex items-center justify-center mx-auto mb-4 shadow-gold">
              <span className="text-dark-900 font-bold text-lg font-serif">M</span>
            </div>
            <h1 className="font-display text-2xl text-white">{stepTitle()}</h1>

            {/* Subtitle row */}
            {step === 'form' && (
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
            )}

            {(step === 'forgot-email' || step === 'forgot-otp' || step === 'reset-password') && (
              <p className="text-dark-400 text-sm mt-1">
                {step === 'forgot-email'   && 'Enter your registered email to receive a reset code.'}
                {step === 'forgot-otp'     && `We sent a 6-digit code to `}
                {step === 'forgot-otp'     && <span className="text-gold-500">{fpEmail}</span>}
                {step === 'reset-password' && 'Choose a strong new password for your account.'}
              </p>
            )}
          </div>

          {/* ── Animated step content ── */}
          <AnimatePresence mode="wait">

            {/* ═══ REGISTRATION OTP ═══ */}
            {step === 'otp' && (
              <motion.form
                key="otp"
                variants={slideVariants}
                initial="initial" animate="animate" exit="exit"
                transition={{ duration: 0.2 }}
                onSubmit={handleVerifyOtp}
                className="space-y-4"
              >
                <div>
                  <label className="label-dark" htmlFor="reg-otp">6-Digit Verification Code</label>
                  <p className="text-dark-400 text-sm mb-3">
                    We sent an OTP to <span className="text-gold-500">{form.email}</span>
                  </p>
                  <div className="relative">
                    <FiKey size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400" />
                    <input
                      id="reg-otp"
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replaceAll(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit code"
                      className="input-dark pl-10 tracking-[0.5em] text-center text-lg"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={verifying || otp.length < 6}
                  className="btn-gold w-full py-3.5 mt-4 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {verifying ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                      Verifying…
                    </span>
                  ) : 'Verify Email'}
                </button>
              </motion.form>
            )}

            {/* ═══ FORGOT PASSWORD — STEP 1: Email ═══ */}
            {step === 'forgot-email' && (
              <motion.div
                key="forgot-email"
                variants={slideVariants}
                initial="initial" animate="animate" exit="exit"
                transition={{ duration: 0.2 }}
              >
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div>
                    <label className="label-dark" htmlFor="fp-email">Email Address</label>
                    <div className="relative">
                      <FiMail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400" />
                      <input
                        id="fp-email"
                        type="email"
                        value={fpEmail}
                        onChange={(e) => { setFpEmail(e.target.value); setFpEmailError(''); }}
                        placeholder="you@example.com"
                        className={`input-dark pl-10 ${fpEmailError ? 'border-red-500' : ''}`}
                        autoFocus
                        autoComplete="email"
                      />
                    </div>
                    {fpEmailError && (
                      <p className="text-red-400 text-xs mt-1">{fpEmailError}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={fpLoading}
                    className="btn-gold w-full py-3.5 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {fpLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                        Sending Code…
                      </span>
                    ) : 'Send Reset Code'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setStep('form'); setFpEmail(''); setFpEmailError(''); }}
                    className="w-full flex items-center justify-center gap-1.5 text-dark-400 hover:text-white text-sm transition-colors mt-1"
                  >
                    <FiArrowLeft size={14} /> Back to Sign In
                  </button>
                </form>
              </motion.div>
            )}

            {/* ═══ FORGOT PASSWORD — STEP 2: OTP Verify ═══ */}
            {step === 'forgot-otp' && (
              <motion.div
                key="forgot-otp"
                variants={slideVariants}
                initial="initial" animate="animate" exit="exit"
                transition={{ duration: 0.2 }}
              >
                <form onSubmit={handleForgotOtpSubmit} className="space-y-4">
                  <div>
                    <label className="label-dark" htmlFor="fp-otp">6-Digit Reset Code</label>
                    <div className="relative">
                      <FiShield size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400" />
                      <input
                        id="fp-otp"
                        type="text"
                        inputMode="numeric"
                        value={fpOtp}
                        onChange={(e) => { setFpOtp(e.target.value.replaceAll(/\D/g, '').slice(0, 6)); setFpOtpError(''); }}
                        placeholder="• • • • • •"
                        className={`input-dark pl-10 tracking-[0.5em] text-center text-lg ${fpOtpError ? 'border-red-500' : ''}`}
                        autoComplete="one-time-code"
                        autoFocus
                      />
                    </div>
                    {fpOtpError && (
                      <p className="text-red-400 text-xs mt-1">{fpOtpError}</p>
                    )}
                  </div>

                  {/* Expiry note */}
                  <p className="text-dark-500 text-xs text-center">
                    Code expires in <span className="text-dark-300">10 minutes</span>
                  </p>

                  <button
                    type="submit"
                    disabled={fpLoading || fpOtp.length < 6}
                    className="btn-gold w-full py-3.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {fpLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                        Verifying…
                      </span>
                    ) : 'Verify Code'}
                  </button>

                  {/* Resend + back */}
                  <div className="flex items-center justify-between pt-1">
                    <ResendButton onResend={handleResendOtp} loading={fpLoading} />
                    <button
                      type="button"
                      onClick={() => { setStep('forgot-email'); setFpOtp(''); setFpOtpError(''); }}
                      className="text-sm text-dark-400 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <FiArrowLeft size={13} /> Change email
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* ═══ FORGOT PASSWORD — STEP 3: New Password ═══ */}
            {step === 'reset-password' && (
              <motion.div
                key="reset-password"
                variants={slideVariants}
                initial="initial" animate="animate" exit="exit"
                transition={{ duration: 0.2 }}
              >
                {/* Security indicator */}
                <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                  <FiCheckCircle size={15} className="flex-shrink-0" />
                  <span>Identity verified — choose a new password</span>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-4">
                  {/* New password */}
                  <div>
                    <label className="label-dark" htmlFor="new-password">New Password</label>
                    <div className="relative">
                      <FiLock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400" />
                      <input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setNewPwdErrors(p => ({ ...p, newPassword: '' })); }}
                        placeholder="Min. 8 characters"
                        className={`input-dark pl-10 pr-10 ${newPwdErrors.newPassword ? 'border-red-500' : ''}`}
                        autoFocus
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors"
                        tabIndex={-1}
                      >
                        {showNewPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                      </button>
                    </div>
                    {newPwdErrors.newPassword && (
                      <p className="text-red-400 text-xs mt-1">{newPwdErrors.newPassword}</p>
                    )}
                    <PasswordStrength password={newPassword} />
                  </div>

                  {/* Confirm new password */}
                  <div>
                    <label className="label-dark" htmlFor="confirm-new-password">Confirm New Password</label>
                    <div className="relative">
                      <FiLock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400" />
                      <input
                        id="confirm-new-password"
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => { setConfirmNewPassword(e.target.value); setNewPwdErrors(p => ({ ...p, confirmNewPassword: '' })); }}
                        placeholder="Repeat your new password"
                        className={`input-dark pl-10 ${newPwdErrors.confirmNewPassword ? 'border-red-500' : ''}`}
                        autoComplete="new-password"
                      />
                    </div>
                    {newPwdErrors.confirmNewPassword && (
                      <p className="text-red-400 text-xs mt-1">{newPwdErrors.confirmNewPassword}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={resetting || !PASSWORD_REGEX.test(newPassword) || newPassword !== confirmNewPassword}
                    className="btn-gold w-full py-3.5 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {resetting ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                        Resetting Password…
                      </span>
                    ) : 'Reset Password'}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ═══ LOGIN / REGISTER FORM ═══ */}
            {step === 'form' && (
              <motion.div
                key="form"
                variants={slideVariants}
                initial="initial" animate="animate" exit="exit"
                transition={{ duration: 0.2 }}
              >
                {/* Auth error banner */}
                {error && (
                  <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <form id={`${type}-form`} onSubmit={handleSubmit} className="space-y-4">
                  {/* Name (register only) */}
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

                  {/* Email */}
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

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label-dark !mb-0">Password</label>
                      {/* Forgot password link — login only */}
                      {type === 'login' && (
                        <button
                          type="button"
                          onClick={() => {
                            setFpEmail(form.email); // pre-fill if typed
                            setFpEmailError('');
                            setStep('forgot-email');
                          }}
                          id="forgot-password-link"
                          className="text-xs text-gold-500 hover:text-gold-400 transition-colors"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
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
                        tabIndex={-1}
                      >
                        {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                      </button>
                    </div>
                    {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
                  </div>

                  {/* Confirm Password (register only) */}
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
                      {errors.confirmPassword && (
                        <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
                      )}
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
                        {type === 'login' ? 'Signing in…' : 'Creating account…'}
                      </span>
                    ) : (
                      type === 'login' ? 'Sign In' : 'Create Account'
                    )}
                  </button>

                  <div className="mt-6 flex flex-col gap-3">
                    <div className="relative flex items-center py-2">
                      <div className="flex-grow border-t border-dark-600"></div>
                      <span className="flex-shrink-0 mx-4 text-dark-400 text-sm">or continue with</span>
                      <div className="flex-grow border-t border-dark-600"></div>
                    </div>
                    
                    <div className="flex items-center justify-center w-full">
                      <GoogleLogin
                        onSuccess={async (credentialResponse) => {
                          const idToken = credentialResponse.credential;
                          const result = await dispatch(loginWithGoogle(idToken));
                          if (result.meta.requestStatus === 'fulfilled') {
                            toast.success(type === 'login' ? 'Welcome back! 💎' : 'Account linked/created!');
                            navigate(from, { replace: true });
                          }
                        }}
                        onError={() => toast.error('Google login failed')}
                        theme="filled_black"
                        shape="rectangular"
                        width="384"
                        text={type === 'login' ? "signin_with" : "signup_with"}
                      />
                    </div>
                    
                    <FacebookLogin
                      appId={import.meta.env.VITE_FACEBOOK_APP_ID || ''}
                      autoLoad={false}
                      fields="name,email,picture"
                      callback={async (response) => {
                        if (response.accessToken) {
                          const result = await dispatch(loginWithFacebook(response.accessToken));
                          if (result.meta.requestStatus === 'fulfilled') {
                            toast.success(type === 'login' ? 'Welcome back! 💎' : 'Account linked/created!');
                            navigate(from, { replace: true });
                          }
                        } else if (!response.status) {
                          toast.error('Facebook login failed or was cancelled');
                        }
                      }}
                      render={renderProps => (
                        <button
                          onClick={renderProps.onClick}
                          type="button"
                          disabled={loading}
                          className="w-full flex items-center justify-center gap-2 py-[10px] rounded border-none bg-[#1877F2] text-white hover:bg-[#166FE5] transition-colors shadow-sm"
                        >
                          <FaFacebookF size={18} />
                          <span className="font-medium text-sm">
                            {type === 'login' ? 'Sign in with Facebook' : 'Sign up with Facebook'}
                          </span>
                        </button>
                      )}
                    />
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export const Login = () => (
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
    <AuthPage type="login" />
  </GoogleOAuthProvider>
);

export const Register = () => (
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ''}>
    <AuthPage type="register" />
  </GoogleOAuthProvider>
);
