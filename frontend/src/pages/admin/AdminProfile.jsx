import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { FiUser, FiMail, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { setUser } from '../../store/authSlice';

export default function AdminProfile() {
  const dispatch  = useDispatch();
  const admin     = useSelector(s => s.auth.user);

  // ── Name editing ──────────────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [name,        setName]        = useState(admin?.name || '');
  const [savingName,  setSavingName]  = useState(false);

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSavingName(true);
    try {
      const res = await api.patch('/admin-auth/profile/name', { name: name.trim() });
      dispatch(setUser(res.data.user));
      toast.success('Name updated.');
      setEditingName(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update name.');
    } finally { setSavingName(false); }
  };

  // ── Email change ──────────────────────────────────────────────────────────
  const [emailStep,   setEmailStep]   = useState('idle'); // idle | otp
  const [newEmail,    setNewEmail]    = useState('');
  const [otp,         setOtp]         = useState('');
  const [sendingOtp,  setSendingOtp]  = useState(false);
  const [verifying,   setVerifying]   = useState(false);

  const handleRequestEmailChange = async () => {
    if (!newEmail.trim()) return;
    setSendingOtp(true);
    try {
      const res = await api.post('/admin-auth/profile/request-email-change', { newEmail: newEmail.trim() });
      toast.success(res.data.message);
      setEmailStep('otp');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP.');
    } finally { setSendingOtp(false); }
  };

  const handleConfirmEmailChange = async () => {
    if (!otp.trim()) return;
    setVerifying(true);
    try {
      const res = await api.post('/admin-auth/profile/confirm-email-change', { otp: otp.trim() });
      dispatch(setUser(res.data.user));
      toast.success(res.data.message);
      setEmailStep('idle');
      setNewEmail('');
      setOtp('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP.');
    } finally { setVerifying(false); }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 py-2">
      <div>
        <h1 className="text-2xl font-bold text-white">My Profile</h1>
        <p className="text-dark-500 text-sm mt-0.5">Manage your admin account details</p>
      </div>

      {/* Avatar + info */}
      <div className="card p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
          <span className="text-gold-400 text-xl font-bold">{admin?.name?.[0]?.toUpperCase() || 'A'}</span>
        </div>
        <div>
          <p className="text-white font-semibold text-lg leading-tight">{admin?.name}</p>
          <p className="text-dark-400 text-sm">{admin?.email}</p>
          <span className="inline-flex items-center gap-1 text-[10px] mt-1 bg-gold-500/10 border border-gold-500/20 text-gold-400 px-2 py-0.5 rounded-full font-medium">
            Administrator
          </span>
        </div>
      </div>

      {/* Edit Name */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiUser size={15} className="text-gold-400" />
            <h2 className="text-white font-semibold">Display Name</h2>
          </div>
          {!editingName && (
            <button onClick={() => { setEditingName(true); setName(admin?.name || ''); }}
              className="flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300 bg-gold-500/10 hover:bg-gold-500/15 border border-gold-500/20 px-3 py-1.5 rounded-lg transition-all">
              <FiEdit2 size={11} /> Edit
            </button>
          )}
        </div>

        {editingName ? (
          <div className="space-y-3">
            <input
              className="input-dark w-full"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSaveName()}
            />
            <div className="flex gap-2">
              <button onClick={handleSaveName} disabled={savingName || !name.trim()}
                className="btn-gold flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-60">
                <FiCheck size={13} /> {savingName ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditingName(false)}
                className="btn-dark flex items-center gap-1.5 px-4 py-2 text-sm">
                <FiX size={13} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-dark-300 text-sm">{admin?.name}</p>
        )}
      </div>

      {/* Change Email */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FiMail size={15} className="text-gold-400" />
          <h2 className="text-white font-semibold">Email Address</h2>
        </div>
        <p className="text-dark-400 text-sm">Current: <span className="text-dark-200">{admin?.email}</span></p>

        {emailStep === 'idle' && (
          <div className="space-y-3">
            <input
              className="input-dark w-full"
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="New email address"
              onKeyDown={e => e.key === 'Enter' && handleRequestEmailChange()}
            />
            <button onClick={handleRequestEmailChange} disabled={sendingOtp || !newEmail.trim()}
              className="btn-gold flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-60">
              {sendingOtp ? 'Sending OTP…' : 'Send Verification OTP'}
            </button>
          </div>
        )}

        {emailStep === 'otp' && (
          <div className="space-y-3">
            <p className="text-sm text-dark-400">OTP sent to <span className="text-gold-400">{newEmail}</span>. Enter it below.</p>
            <input
              className="input-dark w-full font-mono tracking-widest text-lg text-center"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={handleConfirmEmailChange} disabled={verifying || otp.length !== 6}
                className="btn-gold flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-60">
                <FiCheck size={13} /> {verifying ? 'Verifying…' : 'Confirm'}
              </button>
              <button onClick={() => { setEmailStep('idle'); setOtp(''); }}
                className="btn-dark flex items-center gap-1.5 px-4 py-2 text-sm">
                <FiX size={13} /> Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
