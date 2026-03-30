import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { FiUser, FiMapPin, FiPlus, FiTrash2, FiEdit3, FiCheck } from 'react-icons/fi';
import { selectUser, setCredentials } from '../store/authSlice';
import { userService } from '../services/services';
import toast from 'react-hot-toast';

export default function Profile() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [newAddr, setNewAddr] = useState({
    fullName: '', phone: '', addressLine1: '', addressLine2: '',
    city: '', state: '', pincode: '', country: 'India', isDefault: false,
  });

  useEffect(() => {
    document.title = 'My Profile — M&B Jewelry';
    userService.getProfile().then((res) => {
      setProfile(res.data.user);
      setForm({ name: res.data.user.name, phone: res.data.user.phone || '' });
    });
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await userService.updateProfile(form);
      setProfile(res.data.user);
      dispatch(setCredentials({ user: res.data.user, accessToken: localStorage.getItem('mb_access_token') }));
      toast.success('Profile updated!');
      setEditing(false);
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    try {
      const res = await userService.addAddress(newAddr);
      setProfile((p) => ({ ...p, addresses: res.data.addresses }));
      toast.success('Address added!');
      setShowAddrForm(false);
      setNewAddr({ fullName: '', phone: '', addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', country: 'India', isDefault: false });
    } catch {
      toast.error('Failed to add address');
    }
  };

  const handleDeleteAddress = async (addrId) => {
    try {
      const res = await userService.deleteAddress(addrId);
      setProfile((p) => ({ ...p, addresses: res.data.addresses }));
      toast.success('Address removed');
    } catch {
      toast.error('Failed to remove address');
    }
  };

  if (!profile) return (
    <div className="min-h-screen pt-28 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="section-title">My Profile</h1>
          <div className="gold-divider mt-3 mx-0" />
        </div>

        {/* Profile Card */}
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gold-gradient flex items-center justify-center text-dark-900 text-2xl font-bold">
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-white font-display text-xl">{profile.name}</h2>
                <p className="text-dark-400 text-sm">{profile.email}</p>
                <span className={`badge mt-1 ${profile.role === 'admin' ? 'badge-gold' : 'bg-dark-700 text-dark-300 border border-white/10'}`}>
                  {profile.role}
                </span>
              </div>
            </div>
            <button
              onClick={() => setEditing(!editing)}
              className="p-2 text-dark-400 hover:text-gold-400 transition-colors"
            >
              <FiEdit3 size={16} />
            </button>
          </div>

          {editing ? (
            <form onSubmit={handleUpdateProfile} className="space-y-3">
              <div>
                <label className="label-dark">Full Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-dark text-sm"
                  required
                />
              </div>
              <div>
                <label className="label-dark">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="input-dark text-sm"
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn-gold text-sm py-2.5">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="btn-dark text-sm py-2.5">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-dark-500 text-xs uppercase tracking-wider mb-1">Phone</p>
                <p className="text-dark-300">{profile.phone || 'Not set'}</p>
              </div>
              <div>
                <p className="text-dark-500 text-xs uppercase tracking-wider mb-1">Member since</p>
                <p className="text-dark-300">
                  {new Date(profile.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Address Book */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <FiMapPin className="text-gold-500" />
              <h2 className="font-display text-xl text-white">Address Book</h2>
            </div>
            <button
              onClick={() => setShowAddrForm(!showAddrForm)}
              className="flex items-center gap-1.5 text-sm text-gold-500 hover:text-gold-400 transition-colors"
            >
              <FiPlus size={14} /> Add Address
            </button>
          </div>

          {/* Add Address Form */}
          {showAddrForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              onSubmit={handleAddAddress}
              className="mb-5 p-4 rounded-xl bg-dark-800 border border-white/10"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { name: 'fullName', label: 'Full Name', col: 2 },
                  { name: 'phone', label: 'Phone' },
                  { name: 'addressLine1', label: 'Address Line 1', col: 2 },
                  { name: 'addressLine2', label: 'Address Line 2 (optional)', col: 2 },
                  { name: 'city', label: 'City' },
                  { name: 'state', label: 'State' },
                  { name: 'pincode', label: 'PIN Code' },
                ].map(({ name, label, col }) => (
                  <div key={name} className={col === 2 ? 'sm:col-span-2' : ''}>
                    <label className="label-dark">{label}</label>
                    <input
                      value={newAddr[name]}
                      onChange={(e) => setNewAddr({ ...newAddr, [name]: e.target.value })}
                      className="input-dark text-sm"
                    />
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newAddr.isDefault}
                  onChange={(e) => setNewAddr({ ...newAddr, isDefault: e.target.checked })}
                  className="accent-gold-500"
                />
                <span className="text-dark-400 text-sm">Set as default address</span>
              </label>
              <div className="flex gap-3 mt-4">
                <button type="submit" className="btn-gold text-sm py-2">Save Address</button>
                <button type="button" onClick={() => setShowAddrForm(false)} className="btn-dark text-sm py-2">Cancel</button>
              </div>
            </motion.form>
          )}

          {/* Address list */}
          {profile.addresses?.length === 0 ? (
            <p className="text-dark-400 text-sm text-center py-6">No addresses saved yet</p>
          ) : (
            <div className="space-y-3">
              {profile.addresses.map((addr) => (
                <div key={addr._id} className="flex items-start justify-between p-4 rounded-xl bg-dark-800 border border-white/10">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white text-sm font-medium">{addr.fullName}</p>
                      {addr.isDefault && <span className="badge badge-gold text-xs">Default</span>}
                    </div>
                    <p className="text-dark-400 text-xs">{addr.addressLine1}, {addr.city}, {addr.state} — {addr.pincode}</p>
                    <p className="text-dark-500 text-xs">{addr.phone}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteAddress(addr._id)}
                    className="p-1.5 text-dark-500 hover:text-red-400 transition-colors"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
