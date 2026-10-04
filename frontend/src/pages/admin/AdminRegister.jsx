import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { registerAdmin, selectAuthLoading, selectAuthError, clearError } from '../../store/authSlice';
import { FiMail, FiLock, FiUser, FiKey, FiEye, FiEyeOff, FiShield } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';
import BrandLogo from '../../components/common/BrandLogo';

export default function AdminRegister() {
  const dispatch  = useDispatch();
  const loading   = useSelector(selectAuthLoading);
  const authError = useSelector(selectAuthError);

  const [form, setForm]       = useState({ name: '', email: '', password: '', confirmPassword: '', secret: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdError, setPwdError] = useState('');

  // OTP step
  const [step, setStep]         = useState('register'); // 'register' | 'otp' | 'done'
  const [pendingEmail, setPendingEmail] = useState('');
  const [otp, setOtp]           = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');

  const set = (k) => (e) => {
    dispatch(clearError());
    setPwdError('');
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setPwdError('Passwords do not match.');
      return;
    }
    const result = await dispatch(registerAdmin({ name: form.name, email: form.email, password: form.password, secret: form.secret }));
    if (registerAdmin.fulfilled.match(result)) {
      setPendingEmail(result.payload.email || form.email);
      setStep('otp');
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setOtpLoading(true);
    setOtpError('');
    try {
      await api.post('/admin-auth/verify-email', { email: pendingEmail, otp: otp.trim() });
      setStep('done');
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Verification failed.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResend = async () => {
    setOtpError('');
    try {
      await api.post('/admin-auth/resend-otp', { email: pendingEmail });
      toast.success('New OTP sent to your email.');
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Failed to resend OTP.');
    }
  };

  if (step === 'done') {
    return (
      <div className="relative min-h-screen bg-dark-950 flex items-center justify-center px-4 py-10 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_0%,rgba(212,175,55,0.14),transparent_70%)]" aria-hidden="true" />
        <div className="relative w-full max-w-sm text-center card p-8">
          <div className="flex justify-center mb-5"><BrandLogo size="md" to="/" /></div>
          <div className="text-4xl mb-4">✅</div>
          <h2 className="font-jakarta text-white font-semibold text-lg leading-tight pt-0 mb-2">Email verified!</h2>
          <p className="text-dark-400 text-sm mb-5">Your admin account is ready. Sign in to continue.</p>
          <Link to="/admin/login" className="btn-gold py-2.5 px-6 text-sm font-semibold">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="relative min-h-screen bg-dark-950 flex items-center justify-center px-4 py-10 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_0%,rgba(212,175,55,0.14),transparent_70%)]" aria-hidden="true" />
        <div className="relative w-full max-w-md">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-5"><BrandLogo size="md" to="/" /></div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gold-500/25 bg-gold-500/[0.06] text-gold-400 text-[10px] uppercase tracking-[0.25em] font-semibold">
              <FiShield size={11} /> Admin Portal
            </span>
            <h1 className="font-['Cormorant_Garamond',Georgia,serif] text-white text-[1.75rem] font-semibold leading-tight pt-0 mt-3">Verify Email</h1>
            <p className="text-dark-500 text-sm mt-1">OTP sent to <span className="text-gold-400">{pendingEmail}</span></p>
          </div>

          <div className="card p-6 border border-white/[0.08]">
            <p className="text-dark-400 text-sm mb-5">Enter the 6-digit code from your email. Valid for 10 minutes.</p>

            {otpError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {otpError}
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => { setOtpError(''); setOtp(e.target.value.replace(/\D/g, '')); }}
                placeholder="000000"
                autoFocus
                className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-3 text-2xl text-center text-white tracking-[0.5em] font-mono placeholder-dark-700 focus:outline-none focus:border-gold-500/50 transition-colors"
              />

              <button
                type="submit"
                disabled={otpLoading || otp.length !== 6}
                className="w-full btn-gold py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {otpLoading ? 'Verifying…' : 'Verify Email'}
              </button>
            </form>

            <button
              onClick={handleResend}
              className="w-full text-center text-dark-500 hover:text-gold-400 text-xs mt-4 transition-colors"
            >
              Didn&apos;t receive it? Resend OTP
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-dark-950 flex items-center justify-center px-4 py-10 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_0%,rgba(212,175,55,0.14),transparent_70%)]" aria-hidden="true" />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-5"><BrandLogo size="md" to="/" /></div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gold-500/25 bg-gold-500/[0.06] text-gold-400 text-[10px] uppercase tracking-[0.25em] font-semibold">
            <FiShield size={11} /> Admin Portal
          </span>
          <h1 className="font-['Cormorant_Garamond',Georgia,serif] text-white text-[1.75rem] font-semibold leading-tight pt-0 mt-3">Create Admin Account</h1>
        </div>

        <div className="card p-6 border border-white/[0.08]">
          <h2 className="font-jakarta text-white font-semibold text-base leading-tight pt-0 mb-4">Register</h2>

          {authError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {authError}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-dark-400 uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <FiUser size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
                <input
                  type="text" value={form.name} onChange={set('name')} required
                  placeholder="Admin Name"
                  className="w-full bg-dark-800 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-gold-500/50 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-dark-400 uppercase tracking-wider">Email</label>
              <div className="relative">
                <FiMail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
                <input
                  type="email" value={form.email} onChange={set('email')} required
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
                  type={showPwd ? 'text' : 'password'} value={form.password} onChange={set('password')}
                  required minLength={8} placeholder="Min 8 characters"
                  className="w-full bg-dark-800 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-gold-500/50 transition-colors"
                />
                <button type="button" onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300">
                  {showPwd ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-dark-400 uppercase tracking-wider">Confirm Password</label>
              <div className="relative">
                <FiLock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
                <input
                  type={showConfirmPwd ? 'text' : 'password'} value={form.confirmPassword} onChange={set('confirmPassword')}
                  required placeholder="Re-enter password"
                  className={`w-full bg-dark-800 border rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-dark-600 focus:outline-none transition-colors ${
                    pwdError ? 'border-red-500/50' : 'border-white/10 focus:border-gold-500/50'
                  }`}
                />
                <button type="button" onClick={() => setShowConfirmPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300">
                  {showConfirmPwd ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                </button>
              </div>
              {pwdError && <p className="text-red-400 text-xs">{pwdError}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-dark-400 uppercase tracking-wider">Registration Secret</label>
              <div className="relative">
                <FiKey size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
                <input
                  type="password" value={form.secret} onChange={set('secret')} required
                  placeholder="Secret key"
                  className="w-full bg-dark-800 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-gold-500/50 transition-colors"
                />
              </div>
              <p className="text-dark-600 text-xs">Provided by system owner</p>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full btn-gold py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-dark-600 text-xs mt-5">
            Already have account?{' '}
            <Link to="/admin/login" className="text-gold-500 hover:text-gold-400 transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
