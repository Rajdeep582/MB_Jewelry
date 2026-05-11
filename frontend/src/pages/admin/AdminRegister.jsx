import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { registerAdmin, selectAuthLoading, selectAuthError, clearError } from '../../store/authSlice';
import { FiMail, FiLock, FiUser, FiKey, FiEye, FiEyeOff, FiShield } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';

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
      <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center card p-8">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-white font-semibold text-lg mb-2">Email verified!</h2>
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
      <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold-gradient shadow-[0_0_24px_rgba(212,175,55,0.3)] mb-4">
              <FiShield size={22} className="text-dark-900" />
            </div>
            <h1 className="font-display text-2xl text-white">Verify Email</h1>
            <p className="text-dark-500 text-sm mt-1">OTP sent to <span className="text-gold-400">{pendingEmail}</span></p>
          </div>

          <div className="card p-6 border border-white/8">
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
    <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold-gradient shadow-[0_0_24px_rgba(212,175,55,0.3)] mb-4">
            <span className="text-dark-900 font-bold text-lg tracking-tight">MB</span>
          </div>
          <h1 className="font-display text-2xl text-white">Admin Portal</h1>
          <p className="text-dark-500 text-sm mt-1">Create Admin Account</p>
        </div>

        <div className="card p-6 border border-white/8">
          <h2 className="text-white font-semibold text-lg mb-5">Register</h2>

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
