import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowLeft, FiKey, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';

/**
 * StaffForgotPassword — 3-step password reset for the Admin and Delivery Partner portals.
 *   1. email      → POST {apiBase}/forgot-password   (6-digit code emailed)
 *   2. otp        → POST {apiBase}/verify-reset-otp  (returns a one-time resetToken)
 *   3. password   → POST {apiBase}/reset-password    (new + confirm password)
 * Same password rules as sign-up. On success the parent shows the sign-in form again.
 */
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const RESEND_SECONDS = 60;

const STEP_META = {
  email:    { title: 'Forgot password?',   sub: 'Enter your registered email and we’ll send you a 6-digit code.' },
  otp:      { title: 'Enter reset code',   sub: null },
  password: { title: 'Set a new password', sub: 'Choose a strong password you haven’t used before.' },
};

const errMsg = (err, fallback) => {
  const d = err?.response?.data;
  if (Array.isArray(d?.errors) && d.errors.length) return d.errors[0].message;
  return d?.message || fallback;
};

function PasswordChecks({ password }) {
  if (!password) return null;
  const checks = [
    ['8+ chars', password.length >= 8],
    ['Letter', /[A-Za-z]/.test(password)],
    ['Number', /\d/.test(password)],
    ['Special (@$!%*#?&)', /[@$!%*#?&]/.test(password)],
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
      {checks.map(([label, ok]) => (
        <span key={label} className={`text-[11px] flex items-center gap-1 ${ok ? 'text-emerald-400' : 'text-dark-500'}`}>
          {ok ? '✓' : '○'} {label}
        </span>
      ))}
    </div>
  );
}
PasswordChecks.propTypes = { password: PropTypes.string };

export default function StaffForgotPassword({ apiBase, initialEmail = '', onBack }) {
  const [step, setStep]           = useState('email');
  const [email, setEmail]         = useState(initialEmail);
  const [otp, setOtp]             = useState('');
  const [resetToken, setToken]    = useState('');
  const [pwd, setPwd]             = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState('');
  const [cooldown, setCooldown]   = useState(0);

  // Resend countdown
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const go = (next) => { setError(''); setStep(next); };

  const sendCode = async (e) => {
    e?.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(addr)) { setError('Enter a valid email address.'); return; }
    setBusy(true); setError('');
    try {
      await api.post(`${apiBase}/forgot-password`, { email: addr });
      setEmail(addr);
      setOtp('');
      setCooldown(RESEND_SECONDS);
      toast.success('If this email is registered, a reset code is on its way.');
      go('otp');
    } catch (err) {
      setError(errMsg(err, 'Could not send the code. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) { setError('Enter the 6-digit code from your email.'); return; }
    setBusy(true); setError('');
    try {
      const res = await api.post(`${apiBase}/verify-reset-otp`, { email, otp });
      setToken(res.data.resetToken);
      go('password');
    } catch (err) {
      setError(errMsg(err, 'Invalid code. Please try again.'));
      setOtp('');
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!PASSWORD_REGEX.test(pwd)) { setError('Password needs 8+ characters with a letter, a number and a special character (@$!%*#?&).'); return; }
    if (pwd !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      await api.post(`${apiBase}/reset-password`, { email, resetToken, newPassword: pwd });
      toast.success('Password updated. Sign in with your new password.');
      onBack(email);
    } catch (err) {
      const data = err?.response?.data;
      setError(errMsg(err, 'Could not update the password. Please start again.'));
      if (data?.code === 'RESET_EXPIRED') { setToken(''); setPwd(''); setConfirm(''); go('email'); }
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'w-full bg-dark-800/80 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/15 transition-all';
  const labelCls = 'block text-[11px] text-dark-400 uppercase tracking-wider font-medium mb-1.5';
  const btnCls = 'w-full btn-gold py-3 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed';
  const spinner = <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />;
  const stepIndex = ['email', 'otp', 'password'].indexOf(step);
  const meta = STEP_META[step];

  return (
    <div>
      {/* Header + progress */}
      <div className="text-center">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500/10 border border-gold-500/20 text-gold-400">
          <FiKey size={18} />
        </span>
        <h2 className="font-jakarta text-white text-lg font-semibold leading-tight pt-0">{meta.title}</h2>
        <p className="text-dark-400 text-xs mt-1.5 leading-relaxed">
          {step === 'otp' ? <>We sent a 6-digit code to <span className="text-gold-400 break-all">{email}</span>. It expires in 10 minutes.</> : meta.sub}
        </p>
        <div className="flex justify-center gap-1.5 mt-4" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-1 rounded-full transition-all duration-300 ${i <= stepIndex ? 'w-8 bg-gold-500' : 'w-4 bg-white/10'}`} />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div role="alert" className="mt-5 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }} className="mt-5">
          {step === 'email' && (
            <form onSubmit={sendCode} className="space-y-4" noValidate>
              <div>
                <label htmlFor="fp-email" className={labelCls}>Registered email</label>
                <div className="relative">
                  <FiMail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
                  <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email" inputMode="email" autoCapitalize="none" placeholder="you@example.com" className={inputCls} autoFocus />
                </div>
              </div>
              <button type="submit" disabled={busy} className={btnCls}>
                {busy ? <span className="flex items-center justify-center gap-2">{spinner} Sending…</span> : 'Send reset code'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={verifyCode} className="space-y-4" noValidate>
              <div>
                <label htmlFor="fp-otp" className={labelCls}>6-digit code</label>
                <input id="fp-otp" value={otp} onChange={(e) => setOtp(e.target.value.replaceAll(/\D/g, '').slice(0, 6))}
                  inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" maxLength={6} autoFocus
                  className="w-full bg-dark-800/80 border border-white/10 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-[0.5em] text-white placeholder-dark-600 focus:outline-none focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/15 transition-all" />
              </div>
              <button type="submit" disabled={busy || otp.length !== 6} className={btnCls}>
                {busy ? <span className="flex items-center justify-center gap-2">{spinner} Verifying…</span> : 'Verify code'}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => go('email')} className="text-dark-400 hover:text-white transition-colors">Change email</button>
                <button type="button" onClick={() => sendCode()} disabled={busy || cooldown > 0}
                  className="text-gold-400 hover:text-gold-300 disabled:text-dark-600 disabled:cursor-not-allowed transition-colors">
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={savePassword} className="space-y-4" noValidate>
              <div>
                <label htmlFor="fp-new" className={labelCls}>New password</label>
                <div className="relative">
                  <FiLock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
                  <input id="fp-new" type={showPwd ? 'text' : 'password'} value={pwd} onChange={(e) => setPwd(e.target.value)}
                    autoComplete="new-password" placeholder="••••••••" className={`${inputCls} pr-11`} autoFocus />
                  <button type="button" onClick={() => setShowPwd((v) => !v)} aria-label={showPwd ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2.5 text-dark-500 hover:text-gold-400 transition-colors">
                    {showPwd ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
                <PasswordChecks password={pwd} />
              </div>
              <div>
                <label htmlFor="fp-confirm" className={labelCls}>Confirm new password</label>
                <div className="relative">
                  <FiLock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-500" />
                  <input id="fp-confirm" type={showPwd ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password" placeholder="••••••••" className={inputCls} />
                </div>
                {confirm && (
                  <p className={`text-[11px] mt-1.5 flex items-center gap-1 ${confirm === pwd ? 'text-emerald-400' : 'text-red-400'}`}>
                    {confirm === pwd ? <><FiCheckCircle size={11} /> Passwords match</> : 'Passwords do not match'}
                  </p>
                )}
              </div>
              <button type="submit" disabled={busy} className={btnCls}>
                {busy ? <span className="flex items-center justify-center gap-2">{spinner} Updating…</span> : 'Update password'}
              </button>
            </form>
          )}
        </motion.div>
      </AnimatePresence>

      <button type="button" onClick={() => onBack()} className="mt-5 w-full inline-flex items-center justify-center gap-1.5 text-xs text-dark-400 hover:text-gold-400 transition-colors">
        <FiArrowLeft size={12} /> Back to sign in
      </button>
    </div>
  );
}

StaffForgotPassword.propTypes = {
  apiBase: PropTypes.oneOf(['/admin-auth', '/dp-auth']).isRequired,
  initialEmail: PropTypes.string,
  onBack: PropTypes.func.isRequired,
};
