import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUser, FiMapPin, FiPlus, FiTrash2, FiEdit3, FiCheck,
  FiShoppingBag, FiHeart, FiShield, FiSmartphone
} from 'react-icons/fi';
import { setCredentials } from '../store/authSlice';
import { addToCart, openCart } from '../store/cartSlice';
import { userService } from '../services/services';
import { resolveImageUrl, formatPrice } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function Profile() {
  const dispatch = useDispatch();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({ 
    firstName: '', lastName: '', gender: '', phone: '', alternateEmail: ''
  });

  const [showAddrForm, setShowAddrForm] = useState(false);
  const [newAddr, setNewAddr] = useState({
    fullName: '', phone: '', addressLine1: '', addressLine2: '',
    city: '', state: '', pincode: '', country: 'India', isDefault: false,
  });

  useEffect(() => {
    document.title = 'My Profile — M&B Jewelry';
    userService.getProfile()
      .then((profRes) => {
        const user = profRes.data.user;
        setProfile(user);
        
        const nameParts = (user.name || '').trim().split(' ');
        const fName = nameParts[0] || '';
        const lName = nameParts.slice(1).join(' ') || '';

      setForm({ 
        firstName: fName,
        lastName: lName,
        gender: user.gender || '',
        phone: user.phone || '',
        alternateEmail: user.alternateEmail || ''
      });
      setLoading(false);
    });
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fullName = `${form.firstName} ${form.lastName}`.trim();
      const payload = {
        name: fullName,
        phone: form.phone,
        alternateEmail: form.alternateEmail,
        gender: form.gender
      };

      const res = await userService.updateProfile(payload);
      setProfile(res.data.user);
      dispatch(setCredentials({ user: res.data.user, accessToken: localStorage.getItem('mb_access_token') }));
      toast.success('Profile details saved!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update profile');
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

  const handleRemoveWishlist = async (productId) => {
    // Optimistic UI update
    setProfile(prev => ({
      ...prev,
      wishlist: prev.wishlist.filter(p => p._id !== productId)
    }));
    
    try {
      const res = await userService.toggleWishlist(productId);
      dispatch(setCredentials({ user: res.data.user, accessToken: localStorage.getItem('mb_access_token') }));
      toast.success('Removed from saved items');
    } catch {
      toast.error('Failed to remove item');
      // In a real app we'd fetch profile again to rollback, but for now it's okay
    }
  };

  const handleAddToCart = (product) => {
    if (product.stock === 0) {
      toast.error('Product is out of stock');
      return;
    }
    dispatch(addToCart({ ...product, quantity: 1 }));
    dispatch(openCart());
    toast.success(`${product.name} added to cart!`, { icon: '💎' });
  };

  if (loading) return (
    <div className="min-h-screen pt-28 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
    </div>
  );

  // Profile completion calculation
  const calculateCompletion = () => {
    let score = 0;
    if (profile?.name) score += 20;
    if (profile?.email) score += 20;
    if (profile?.phone) score += 20;
    if (profile?.alternateEmail) score += 10;
    if (profile?.addresses?.length > 0) score += 30;
    return Math.min(score, 100);
  };
  const completion = calculateCompletion();

  return (
    <div className="min-h-screen pt-24 pb-20 bg-dark-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="mb-8">
          <h1 className="section-title">My Profile</h1>
          <div className="gold-divider mt-3 mx-0" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT SIDEBAR - MAIN PROFILE CARD */}
          <div className="lg:col-span-4 space-y-6">
            <div className="card p-6 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500/5 rounded-bl-full -z-10" />
              
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-24 h-24 rounded-full bg-gold-gradient p-1 mb-4">
                  <div className="w-full h-full rounded-full bg-dark-900 flex items-center justify-center text-gold-400 text-3xl font-bold font-display">
                    {profile?.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                </div>
                <h2 className="text-white font-display text-2xl">{profile?.name || 'User'}</h2>

                <p className="text-dark-400 text-sm mb-3">{profile?.email}</p>
                <span className={`badge ${profile?.role === 'admin' ? 'badge-gold' : 'bg-dark-700 text-dark-300 border border-white/10'}`}>
                  {(profile?.role || 'user').toUpperCase()}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mb-6 bg-dark-800 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-dark-300 font-medium uppercase tracking-wider">Profile Completion</span>
                  <span className="text-xs text-gold-400 font-bold">{completion}%</span>
                </div>
                <div className="h-1.5 w-full bg-dark-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gold-gradient transition-all duration-1000 ease-out"
                    style={{ width: `${completion}%` }}
                  />
                </div>
                {completion < 100 && (
                  <p className="text-[10px] text-dark-500 mt-2">Add phone and address to complete your profile.</p>
                )}
              </div>
            </div>

            {/* Account Details Quick Stats */}
            <div className="card p-6 border border-white/5">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2"><FiShield className="text-gold-500"/> Account Details</h3>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between border-b border-white/5 pb-3">
                  <span className="text-dark-400">Status</span>
                  <span className="text-green-400 flex items-center gap-1"><FiCheck size={12}/> {profile?.isVerified ? 'Verified' : 'Active'}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-3">
                  <span className="text-dark-400">Member Since</span>
                  <span className="text-white">{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Unknown'}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-3">
                  <span className="text-dark-400">Linked Providers</span>
                  <span className="text-white capitalize">{profile?.providers?.map(p => p.providerType)?.join(', ') || 'Email'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - CONTENT SECTIONS */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* PERMANENT USER DETAILS FORM */}
            <div className="card p-6 border border-white/5">
              <h3 className="text-white font-display text-xl mb-6 flex items-center gap-2"><FiUser className="text-gold-500"/> User Details</h3>
              <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="label-dark">First Name</label>
                  <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input-dark text-sm" required />
                </div>
                <div>
                  <label className="label-dark">Last Name</label>
                  <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input-dark text-sm" required />
                </div>
                <div>
                  <label className="label-dark">Gender</label>
                  <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="input-dark text-sm appearance-none">
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label-dark">Phone Number</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-dark text-sm" placeholder="+91 98765 43210" />
                </div>

                <div>
                  <label className="label-dark">Alternate Email</label>
                  <input type="email" value={form.alternateEmail} onChange={(e) => setForm({ ...form, alternateEmail: e.target.value })} className="input-dark text-sm" placeholder="Optional" />
                </div>
                <div className="md:col-span-2 pt-2">
                  <button type="submit" disabled={saving} className="btn-gold text-sm py-2.5 px-8 w-full sm:w-auto">
                    {saving ? 'Saving Details...' : 'Save Details'}
                  </button>
                </div>
              </form>
            </div>

            {/* ADDRESS BOOK */}
            <div className="card p-6 border border-white/5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-display text-xl flex items-center gap-2"><FiMapPin className="text-gold-500"/> Address Book</h3>
                <button
                  onClick={() => setShowAddrForm(!showAddrForm)}
                  className="flex items-center gap-1.5 text-sm text-gold-500 hover:text-gold-400 transition-colors bg-gold-500/10 px-3 py-1.5 rounded-lg"
                >
                  <FiPlus size={14} /> Add New
                </button>
              </div>

              {/* Add Address Form */}
              <AnimatePresence>
                {showAddrForm && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleAddAddress}
                    className="mb-6 p-5 rounded-2xl bg-dark-800 border border-gold-500/20 overflow-hidden"
                  >
                    <h4 className="text-white text-sm font-medium mb-4">New Delivery Address</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        { name: 'fullName', label: 'Full Name', col: 2 },
                        { name: 'phone', label: 'Phone Number' },
                        { name: 'pincode', label: 'PIN Code' },
                        { name: 'addressLine1', label: 'Street Address', col: 2 },
                        { name: 'addressLine2', label: 'Apartment/Suite (optional)', col: 2 },
                        { name: 'city', label: 'City' },
                        { name: 'state', label: 'State' },
                      ].map(({ name, label, col }) => (
                        <div key={name} className={col === 2 ? 'sm:col-span-2' : ''}>
                          <label className="label-dark text-xs">{label}</label>
                          <input value={newAddr[name]} onChange={(e) => setNewAddr({ ...newAddr, [name]: e.target.value })} className="input-dark text-sm py-2" required={name !== 'addressLine2'} />
                        </div>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 mt-4 cursor-pointer w-max">
                      <input type="checkbox" checked={newAddr.isDefault} onChange={(e) => setNewAddr({ ...newAddr, isDefault: e.target.checked })} className="accent-gold-500 w-4 h-4" />
                      <span className="text-white text-sm">Set as default address</span>
                    </label>
                    <div className="flex gap-3 mt-5">
                      <button type="submit" className="btn-gold text-sm py-2 px-6">Save Address</button>
                      <button type="button" onClick={() => setShowAddrForm(false)} className="btn-dark text-sm py-2 px-6">Cancel</button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Address list Grid */}
              {!profile?.addresses || profile.addresses.length === 0 ? (
                <div className="text-center py-8 bg-dark-800 rounded-xl border border-white/5">
                  <FiMapPin className="text-dark-500 text-4xl mx-auto mb-3" />
                  <p className="text-dark-300 text-sm">No saved addresses.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profile.addresses.map((addr) => (
                    <div key={addr._id} className="relative p-5 rounded-2xl bg-dark-800 border border-white/5 hover:border-white/10 transition-colors flex flex-col h-full">
                      {addr.isDefault && (
                        <div className="absolute top-4 right-4">
                          <span className="badge badge-gold text-[10px] uppercase tracking-wider">Default</span>
                        </div>
                      )}
                      <h4 className="text-white font-medium mb-1 pr-16">{addr.fullName}</h4>
                      <p className="text-dark-400 text-sm mb-3 flex items-center gap-2"><FiSmartphone size={12}/> {addr.phone}</p>
                      
                      <div className="text-dark-300 text-sm leading-relaxed mb-4 flex-1">
                        <p>{addr.addressLine1}</p>
                        {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                        <p>{addr.city}, {addr.state} {addr.pincode}</p>
                      </div>

                      <div className="flex items-center gap-3 pt-3 border-t border-white/5 mt-auto">
                        <button className="text-dark-400 hover:text-white text-sm font-medium transition-colors">Edit</button>
                        <div className="w-px h-3 bg-white/10" />
                        <button onClick={() => handleDeleteAddress(addr._id)} className="text-dark-400 hover:text-red-400 text-sm font-medium transition-colors">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* WISHLIST */}
            <div className="card p-6 border border-white/5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-display text-xl flex items-center gap-2"><FiHeart className="text-gold-500"/> Saved Items</h3>
              </div>
              {profile?.wishlist && profile.wishlist.length > 0 ? (
                <div className="space-y-4">
                  {profile.wishlist.map(product => (
                    <div key={product._id} className="group flex flex-col sm:flex-row items-center gap-5 p-4 bg-dark-800 rounded-2xl border border-white/5 hover:border-gold-500/30 transition-all">
                      <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-dark-900 border border-white/5">
                        <img 
                          src={resolveImageUrl(product?.images?.[0]?.url)} 
                          alt={product.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                        />
                      </div>
                      
                      <div className="flex-1 text-center sm:text-left">
                        <p className="text-dark-400 text-[10px] uppercase tracking-wider mb-1">{product.material} · {product.type}</p>
                        <h4 className="text-white font-medium text-sm sm:text-base mb-2 group-hover:text-gold-400 transition-colors">{product.name}</h4>
                        <div className="flex items-center justify-center sm:justify-start gap-2">
                          <span className="text-gold-400 font-medium text-sm sm:text-base">{formatPrice(product.discountedPrice || product.price)}</span>
                          {product.discountedPrice && <span className="text-dark-500 text-xs line-through">{formatPrice(product.price)}</span>}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t border-white/5 sm:border-t-0">
                        <button 
                          onClick={() => handleAddToCart(product)} 
                          className="flex-1 sm:flex-none py-2.5 px-6 rounded-xl bg-gold-500/10 text-gold-500 hover:bg-gold-500 hover:text-dark-900 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <FiShoppingBag size={14} /> Add to Cart
                        </button>
                        <button 
                          onClick={() => handleRemoveWishlist(product._id)} 
                          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-dark-900 text-dark-400 hover:text-red-400 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 transition-all" 
                          title="Remove from saved"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-dark-800 rounded-xl border border-white/5">
                  <FiHeart className="text-dark-500 text-4xl mx-auto mb-3" />
                  <p className="text-dark-300 text-sm">Your wishlist is empty.</p>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
