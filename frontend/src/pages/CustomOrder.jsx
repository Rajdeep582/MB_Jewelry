import { useState, useCallback, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUpload, FiX, FiChevronRight, FiChevronLeft,
  FiMapPin, FiCheckCircle, FiStar, FiInfo,
} from 'react-icons/fi';
import { selectUser } from '../store/authSlice';
import { customOrderService, userService } from '../services/services';
import { formatDate, BLANK_ADDRESS, REQUIRED_ADDR_FIELDS } from '../utils/helpers';
import toast from 'react-hot-toast';
import AddressSelector from '../components/common/AddressSelector';

// ─── Config ───────────────────────────────────────────────────────────────────
const JEWELRY_TYPES = ['Ring', 'Necklace', 'Earrings', 'Bracelet', 'Pendant', 'Anklet', 'Bangle', 'Bala'];
const MATERIALS     = ['Gold', 'Silver', 'Diamond'];
const PURITY_MAP    = {
  Gold:    ['22K', '18K'],
  Silver:  ['Hallmark', 'Normal'],
  Diamond: ['22K', '18K', '14K'],
};

// ─── Step Indicator ───────────────────────────────────────────────────────────
const STEPS = ['Design', 'Images', 'Delivery', 'Review'];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`flex flex-col items-center`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${
              i < current  ? 'bg-gold-500 border-gold-500 text-dark-900'
            : i === current ? 'border-gold-500 text-gold-400 bg-gold-500/10'
            : 'border-dark-600 text-dark-600'
            }`}>
              {i < current ? <FiCheckCircle size={14} /> : i + 1}
            </div>
            <p className={`text-xs mt-1 hidden sm:block ${i <= current ? 'text-gold-400' : 'text-dark-600'}`}>{s}</p>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-10 sm:w-16 h-0.5 mb-4 transition-all duration-300 ${i < current ? 'bg-gold-500' : 'bg-dark-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Option Button ────────────────────────────────────────────────────────────
function OptionBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 cursor-pointer
        ${active
          ? 'bg-gold-500/15 border-gold-500 text-gold-400 shadow-gold'
          : 'border-white/10 text-dark-400 hover:border-white/30 hover:text-white'
        }`}
    >
      {children}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CustomOrder() {
  const navigate = useNavigate();
  const user     = useSelector(selectUser);

  const [step, setStep]   = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Design
  const [form, setForm] = useState({
    type: '', material: '', purity: 'None',
    description: '', fingerSize: '', neckSize: '',
    wristSize: '', weight: '', budget: '',
  });

  // Step 2: Images
  const [images, setImages]       = useState([]); // File objects
  const [previews, setPreviews]   = useState([]);  // base64 data URLs
  const fileInputRef              = useRef(null);

  // Step 3: Delivery
  const [addresses,      setAddresses]      = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState(null);
  const [showNewAddr,    setShowNewAddr]    = useState(false);
  const [newAddr,        setNewAddr]        = useState({ ...BLANK_ADDRESS, fullName: user?.name || '' });
  const [addrLoading,    setAddrLoading]    = useState(false);
  const [preferredDate,  setPreferredDate]  = useState('');

  useEffect(() => {
    document.title = 'Custom Jewelry — M&B Jewelry';
  }, []);

  // Load saved addresses when reaching step 2
  useEffect(() => {
    if (step === 2 && addresses.length === 0) {
      setAddrLoading(true);
      userService.getProfile()
        .then((res) => {
          const addrs = res.data.user?.addresses || [];
          setAddresses(addrs);
          const def = addrs.find((a) => a.isDefault) ?? addrs[0];
          if (def) setSelectedAddrId(def._id);
          else setShowNewAddr(true);
        })
        .catch(() => setShowNewAddr(true))
        .finally(() => setAddrLoading(false));
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Image handling ──────────────────────────────────────────────────────────
  const handleFileAdd = (files) => {
    const remaining = 4 - images.length;
    if (remaining <= 0) { toast.error('Maximum 4 reference images allowed'); return; }
    const toAdd = Array.from(files).slice(0, remaining);
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const valid = toAdd.filter((f) => {
      if (!validTypes.includes(f.type)) { toast.error(`${f.name}: only JPEG/PNG/WebP allowed`); return false; }
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name}: max 10MB per image`); return false; }
      return true;
    });
    setImages((p) => [...p, ...valid]);
    valid.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (e) => setPreviews((p) => [...p, e.target.result]);
      reader.readAsDataURL(f);
    });
  };

  const removeImage = (idx) => {
    setImages((p)   => p.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFileAdd(e.dataTransfer.files);
  };

  // ── Address helpers ─────────────────────────────────────────────────────────
  const getSelectedAddress = useCallback(() => {
    if (showNewAddr) return newAddr;
    return addresses.find((a) => a._id === selectedAddrId) ?? null;
  }, [showNewAddr, newAddr, addresses, selectedAddrId]);

  const validateAddress = useCallback((addr) => {
    for (const f of REQUIRED_ADDR_FIELDS) {
      if (!addr[f]?.trim()) {
        toast.error(`Please fill in: ${f.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        return false;
      }
    }
    if (!/^\d{6}$/.test(addr.pincode)) { toast.error('PIN code must be 6 digits'); return false; }
    if (!/^[6-9]\d{9}$/.test(addr.phone.replace(/\s/g, ''))) {
      toast.error('Please enter a valid 10-digit Indian mobile number'); return false;
    }
    return true;
  }, []);

  // ── Step validation ─────────────────────────────────────────────────────────

  const goNext = () => {
    if (step === 0) {
      if (!form.type)     { toast.error('Please select a jewelry type'); return; }
      if (!form.material) { toast.error('Please select a material'); return; }
      if (form.description.trim().length < 20) { toast.error('Please write a description (at least 20 characters)'); return; }
    }
    if (step === 2) {
      const addr = getSelectedAddress();
      if (!addr) { toast.error('Please select or add a delivery address'); return; }
      if (!validateAddress(addr)) return;
    }
    setStep((s) => s + 1);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const addr = getSelectedAddress();
    if (!addr || !validateAddress(addr)) return;

    setSubmitting(true);
    try {
      const fd = new FormData();
      // Fields
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      // Shipping address
      Object.entries(addr).forEach(([k, v]) => fd.append(`shippingAddress[${k}]`, v));
      if (preferredDate) fd.append('preferredDeliveryDate', preferredDate);
      // Images
      images.forEach((img) => fd.append('referenceImages', img));

      await customOrderService.create(fd);
      toast.success('Custom order submitted! We\'ll send you a quote within 24–48 hours. 💎', { duration: 6000 });
      navigate('/custom-orders');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render Steps ────────────────────────────────────────────────────────────
  const addr = getSelectedAddress();

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="section-subtitle mb-3">Bespoke Craftsmanship</p>
          <h1 className="section-title mb-4">Design Your Custom Jewelry</h1>
          <div className="gold-divider mx-auto mt-2 mb-4" />
          <p className="text-dark-400 text-sm max-w-xl mx-auto">
            Share your vision and we'll craft a one-of-a-kind piece. Our skilled artisans will review
            your request and send a personalised quote within 24–48 hours.
          </p>
        </div>

        <StepIndicator current={step} />

        <AnimatePresence mode="wait">
          {/* ── STEP 0: Design Details ─────────────────────────────────────── */}
          {step === 0 && (
            <motion.div key="step0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="card p-6 space-y-6">
              <h2 className="font-display text-xl text-white">Design Details</h2>

              {/* Jewelry Type */}
              <div>
                <label className="label-dark">Jewelry Type <span className="text-red-400">*</span></label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {JEWELRY_TYPES.map((t) => (
                    <OptionBtn key={t} active={form.type === t} onClick={() => setForm((f) => ({ ...f, type: t }))}>
                      {t}
                    </OptionBtn>
                  ))}
                </div>
              </div>

              {/* Material */}
              <div>
                <label className="label-dark">Material <span className="text-red-400">*</span></label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {MATERIALS.map((m) => (
                    <OptionBtn key={m} active={form.material === m} onClick={() => setForm((f) => ({ ...f, material: m, purity: 'None' }))}>
                      {m}
                    </OptionBtn>
                  ))}
                </div>
              </div>

              {/* Purity — dynamic options based on selected material */}
              {form.material && PURITY_MAP[form.material] && (
                <div>
                  <label className="label-dark">Purity</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {PURITY_MAP[form.material].map((p) => (
                      <OptionBtn key={p} active={form.purity === p} onClick={() => setForm((f) => ({ ...f, purity: p }))}>
                        {p}
                      </OptionBtn>
                    ))}
                  </div>
                </div>
              )}

              {/* Measurements (contextual) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {form.type === 'Ring' && (
                  <div>
                    <label className="label-dark">Finger Size <span className="text-dark-500 font-normal">(e.g. 16, US 7)</span></label>
                    <input value={form.fingerSize} onChange={(e) => setForm((f) => ({ ...f, fingerSize: e.target.value }))} className="input-dark" placeholder="Optional" />
                  </div>
                )}
                {['Necklace', 'Pendant'].includes(form.type) && (
                  <div>
                    <label className="label-dark">Neck Size <span className="text-dark-500 font-normal">(e.g. 45 cm)</span></label>
                    <input value={form.neckSize} onChange={(e) => setForm((f) => ({ ...f, neckSize: e.target.value }))} className="input-dark" placeholder="Optional" />
                  </div>
                )}
                {['Bracelet', 'Bangle', 'Anklet'].includes(form.type) && (
                  <div>
                    <label className="label-dark">Wrist / Ankle Size <span className="text-dark-500 font-normal">(cm)</span></label>
                    <input value={form.wristSize} onChange={(e) => setForm((f) => ({ ...f, wristSize: e.target.value }))} className="input-dark" placeholder="Optional" />
                  </div>
                )}
                <div>
                  <label className="label-dark">Estimated Weight <span className="text-dark-500 font-normal">(e.g. 8–10g)</span></label>
                  <input value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} className="input-dark" placeholder="Optional" />
                </div>
                <div>
                  <label className="label-dark">Budget Range <span className="text-dark-500 font-normal">(e.g. ₹15,000 – ₹25,000)</span></label>
                  <input value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} className="input-dark" placeholder="Optional" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="label-dark">Design Description <span className="text-red-400">*</span></label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="input-dark resize-none"
                  rows={5}
                  maxLength={2000}
                  placeholder="Describe your dream piece in detail — style, occasion, engravings, gemstones, finish (matte/polished), etc. The more detail, the better our quote will be."
                />
                <p className={`text-xs mt-1 text-right ${form.description.length > 1900 ? 'text-red-400' : 'text-dark-500'}`}>
                  {form.description.length}/2000
                </p>
              </div>
            </motion.div>
          )}

          {/* ── STEP 1: Reference Images ───────────────────────────────────── */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="card p-6 space-y-5">
              <div>
                <h2 className="font-display text-xl text-white">Reference Images</h2>
                <p className="text-dark-400 text-sm mt-1">Upload up to 4 images to help us understand your vision. Optional but highly recommended.</p>
              </div>

              {/* Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => images.length < 4 && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 ${
                  images.length < 4 ? 'border-white/20 hover:border-gold-500/50 cursor-pointer hover:bg-gold-500/5' : 'border-white/10 opacity-50'
                }`}
              >
                <FiUpload className="mx-auto text-dark-400 mb-3" size={32} />
                <p className="text-white text-sm font-medium">
                  {images.length < 4 ? 'Drag & drop or click to upload' : 'Maximum 4 images uploaded'}
                </p>
                <p className="text-dark-500 text-xs mt-1">JPEG, PNG, WebP — max 10MB each</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileAdd(e.target.files)}
                />
              </div>

              {/* Previews */}
              {previews.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {previews.map((src, i) => (
                    <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-dark-700">
                      <img src={src} alt={`ref-${i}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <FiX size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="glass-gold rounded-xl p-3 flex items-start gap-2 text-xs text-gold-300">
                <FiInfo className="flex-shrink-0 mt-0.5" size={14} />
                <p>You can skip this step. Images help our artisans understand your vision better and provide a more accurate quote.</p>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: Delivery ───────────────────────────────────────────── */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="card p-6 space-y-5">
              <div className="flex items-center gap-2">
                <FiMapPin className="text-gold-500" size={18} />
                <h2 className="font-display text-xl text-white">Delivery Details</h2>
              </div>

              {addrLoading ? (
                <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 rounded-xl skeleton bg-dark-700/50" />)}</div>
              ) : (
                <AddressSelector
                  addresses={addresses}
                  selectedAddrId={selectedAddrId}
                  setSelectedAddrId={setSelectedAddrId}
                  showNewAddr={showNewAddr}
                  setShowNewAddr={setShowNewAddr}
                  newAddr={newAddr}
                  setNewAddr={setNewAddr}
                  addrLoading={addrLoading}
                />
              )}

              {/* Preferred delivery date */}
              <div>
                <label className="label-dark">Preferred Delivery Date <span className="text-dark-500 font-normal">(optional)</span></label>
                <input
                  type="date"
                  value={preferredDate}
                  min={new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="input-dark"
                />
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: Review & Submit ────────────────────────────────────── */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              {/* Design Summary */}
              <div className="card p-5">
                <h3 className="font-display text-lg text-white mb-4 flex items-center gap-2"><FiStar className="text-gold-500" /> Design Summary</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Type',     form.type],
                    ['Material', form.material],
                    ['Purity',   form.purity],
                    form.fingerSize && ['Finger Size', form.fingerSize],
                    form.neckSize && ['Neck Size', form.neckSize],
                    form.wristSize && ['Wrist Size', form.wristSize],
                    form.weight   && ['Est. Weight', form.weight],
                    form.budget   && ['Budget',      form.budget],
                  ].filter(Boolean).map(([k, v]) => (
                    <div key={k}>
                      <p className="text-dark-500 text-xs">{k}</p>
                      <p className="text-white font-medium">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-dark-500 text-xs mb-1">Description</p>
                  <p className="text-dark-300 text-sm leading-relaxed">{form.description}</p>
                </div>
              </div>

              {/* Images Summary */}
              {previews.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-white font-medium mb-3">Reference Images ({previews.length})</h3>
                  <div className="flex gap-2 flex-wrap">
                    {previews.map((src, i) => (
                      <div key={i} className="w-16 h-16 rounded-lg overflow-hidden bg-dark-700">
                        <img src={src} alt={`ref-${i}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Address Summary */}
              {addr && (
                <div className="card p-5">
                  <h3 className="text-white font-medium mb-2 flex items-center gap-2"><FiMapPin size={14} className="text-gold-500" /> Delivery Address</h3>
                  <p className="text-dark-300 text-sm">{addr.fullName}</p>
                  <p className="text-dark-400 text-sm">{addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''}</p>
                  <p className="text-dark-400 text-sm">{addr.city}, {addr.state} — {addr.pincode}</p>
                  <p className="text-dark-500 text-sm">{addr.phone}</p>
                  {preferredDate && <p className="text-dark-500 text-xs mt-2">Preferred by: {formatDate(preferredDate)}</p>}
                </div>
              )}

              {/* Info banner */}
              <div className="glass-gold rounded-2xl p-4 flex items-start gap-3">
                <FiInfo className="text-gold-500 mt-0.5 flex-shrink-0" size={18} />
                <div>
                  <p className="text-white text-sm font-medium mb-1">What happens next?</p>
                  <p className="text-dark-400 text-xs leading-relaxed">
                    Our artisans will review your request and send a personalised quote within <strong className="text-white">24–48 hours</strong>.
                    You'll see the quote on your Custom Orders page. Once you accept and pay, we begin crafting your piece.
                    No payment is taken today.
                  </p>
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-gold w-full py-4 text-base disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                    Submitting…
                  </span>
                ) : (
                  <>💎 Submit Custom Order Request</>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className={`flex gap-3 mt-6 ${step === 0 ? 'justify-end' : 'justify-between'}`}>
          {step > 0 && step < 3 && (
            <button onClick={() => setStep((s) => s - 1)} className="btn-dark flex items-center gap-2 py-3 px-5">
              <FiChevronLeft size={16} /> Back
            </button>
          )}
          {step < 3 && (
            <button onClick={goNext} className="btn-gold flex items-center gap-2 py-3 px-6 ml-auto">
              {step === 2 ? 'Review Order' : 'Continue'} <FiChevronRight size={16} />
            </button>
          )}
          {step === 3 && (
            <button onClick={() => setStep(2)} className="btn-dark flex items-center gap-2 py-3 px-5">
              <FiChevronLeft size={16} /> Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
