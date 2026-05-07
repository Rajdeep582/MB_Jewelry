import { useEffect, useState, useCallback } from 'react';
import { FiPercent, FiDollarSign, FiTrendingUp, FiAlertTriangle, FiTrash2 } from 'react-icons/fi';
import { categoryService, adminService } from '../../services/services';
import toast from 'react-hot-toast';

const MATERIALS = ['Gold', 'Silver', 'Platinum', 'Rose Gold', 'Diamond', 'Gemstone', 'Mixed'];

const GLOBAL_MATERIALS = ['Gold', 'Silver', 'Diamond'];

const PURITY_MAP = {
  Gold: ['22K', '18K'],
  Silver: ['Normal', 'Hallmarked'],
  Diamond: ['22K', '18K', '14K'],
};

const DEFAULT_GLOBAL_FORM = {
  material: 'Gold',
  purity: '22K',
  unit: 'gram',
  livePrice: '',
  makingCharges: 12,
  gst: 3,
};

export default function AdminPricing() {
  const [categories, setCategories] = useState([]);
  const [globalPricingData, setGlobalPricingData] = useState([]);
  const [globalForm, setGlobalForm] = useState(DEFAULT_GLOBAL_FORM);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingGlobalForm, setPendingGlobalForm] = useState(null);

  const [pricingForm, setPricingForm] = useState({
    material: '',
    category: '',
    operation: 'percentage',
    amount: '',
  });

  const [discountForm, setDiscountForm] = useState({
    targetType: 'global',
    targetId: '',
    discountType: 'percentage',
    discountValue: '',
  });

  const loadGlobalPricing = useCallback(async () => {
    try {
      const res = await adminService.getGlobalPricing();
      setGlobalPricingData(res.data.pricing);
    } catch {
      // non-critical, ignore
    }
  }, []);

  useEffect(() => {
    document.title = 'Pricing & Discounts — Admin';
    categoryService.getCategories().then((res) => setCategories(res.data.categories));
    loadGlobalPricing();
  }, [loadGlobalPricing]);

  // When material changes, reset purity and load existing entry if any
  const handleGlobalMaterialChange = (material) => {
    const defaultPurity = PURITY_MAP[material][0];
    const existing = globalPricingData.find(
      (p) => p.material === material && p.purity === defaultPurity && p.unit === globalForm.unit
    );
    setGlobalForm({
      ...globalForm,
      material,
      purity: defaultPurity,
      livePrice: existing?.livePrice ?? '',
      makingCharges: existing?.makingCharges ?? 12,
      gst: existing?.gst ?? 3,
    });
  };

  // When purity or unit changes, load existing entry if any
  const handleGlobalPurityOrUnitChange = (field, value) => {
    const newForm = { ...globalForm, [field]: value };
    const existing = globalPricingData.find(
      (p) => p.material === newForm.material && p.purity === newForm.purity && p.unit === newForm.unit
    );
    setGlobalForm({
      ...newForm,
      livePrice: existing?.livePrice ?? '',
      makingCharges: existing?.makingCharges ?? 12,
      gst: existing?.gst ?? 3,
    });
  };

  const handleGlobalSubmit = (e) => {
    e.preventDefault();
    const livePrice = Number(globalForm.livePrice);
    if (!globalForm.livePrice || isNaN(livePrice) || livePrice < 0) {
      toast.error('Enter a valid live price');
      return;
    }
    setPendingGlobalForm({ ...globalForm, livePrice, makingCharges: Number(globalForm.makingCharges), gst: Number(globalForm.gst) });
    setShowConfirm(true);
  };

  const confirmGlobalSave = async () => {
    setShowConfirm(false);
    setSavingGlobal(true);
    try {
      const res = await adminService.setGlobalPricing(pendingGlobalForm);
      toast.success(res.data.message);
      await loadGlobalPricing();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save global pricing');
    } finally {
      setSavingGlobal(false);
      setPendingGlobalForm(null);
    }
  };

  const handleDeleteGlobalPricing = async (id) => {
    try {
      await adminService.deleteGlobalPricing(id);
      setGlobalPricingData((prev) => prev.filter((e) => e._id !== id));
      toast.success('Pricing entry deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handlePricingSubmit = async (e) => {
    e.preventDefault();
    if (!pricingForm.material && !pricingForm.category) {
      toast.error('Must specify a Material or Category');
      return;
    }
    const amount = Number(pricingForm.amount);
    if (isNaN(amount) || amount === 0) {
      toast.error('Invalid amount');
      return;
    }
    try {
      const res = await adminService.bulkUpdatePricing({ ...pricingForm, amount });
      toast.success(res.data.message);
      setPricingForm({ ...pricingForm, amount: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const handleDiscountSubmit = async (e) => {
    e.preventDefault();
    const value = Number(discountForm.discountValue);
    if (discountForm.discountType !== 'remove' && (isNaN(value) || value <= 0)) {
      toast.error('Invalid discount value');
      return;
    }
    if (discountForm.targetType !== 'global' && !discountForm.targetId) {
      toast.error('Target ID is required for product/category');
      return;
    }
    try {
      const res = await adminService.bulkUpdateDiscounts({ ...discountForm, discountValue: value });
      toast.success(res.data.message);
      setDiscountForm({ ...discountForm, discountValue: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  // Preview calculated price (for display only)
  const previewPrice = (() => {
    const lp = Number(globalForm.livePrice);
    if (!lp) return null;
    const withMaking = lp * (1 + Number(globalForm.makingCharges) / 100);
    return Math.round(withMaking * (1 + Number(globalForm.gst) / 100));
  })();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl text-white">Pricing &amp; Discounts</h1>
        <p className="text-dark-400 text-sm">Bulk update base prices and storewide discounts</p>
      </div>

      {/* === GLOBAL JEWELRY SETTINGS === */}
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gold-500/10 text-gold-400 flex items-center justify-center border border-gold-500/20">
            <FiTrendingUp size={20} />
          </div>
          <div>
            <h2 className="font-display text-lg text-white">Global Jewelry Settings</h2>
            <p className="text-dark-400 text-xs">Set live rates by material, making charges, and GST</p>
          </div>
        </div>

        <form onSubmit={handleGlobalSubmit} className="space-y-4">
          {/* Row 1: Material / Purity / Live Price + Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label-dark">Material</label>
              <select
                value={globalForm.material}
                onChange={(e) => handleGlobalMaterialChange(e.target.value)}
                className="input-dark"
              >
                {GLOBAL_MATERIALS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-dark">Purity</label>
              <select
                value={globalForm.purity}
                onChange={(e) => handleGlobalPurityOrUnitChange('purity', e.target.value)}
                className="input-dark"
              >
                {PURITY_MAP[globalForm.material].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-dark">Live Price</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={globalForm.livePrice}
                  onChange={(e) => setGlobalForm({ ...globalForm, livePrice: e.target.value })}
                  placeholder="e.g. 1383.4"
                  className="input-dark flex-1 min-w-0"
                />
                <select
                  value={globalForm.unit}
                  onChange={(e) => handleGlobalPurityOrUnitChange('unit', e.target.value)}
                  className="input-dark w-24 flex-shrink-0"
                >
                  <option value="gram">/ gram</option>
                  <option value="kg">/ kg</option>
                </select>
              </div>
            </div>
          </div>

          {/* Row 2: Making Charges / GST / Price Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="label-dark">Making Charges (%)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={globalForm.makingCharges}
                onChange={(e) => setGlobalForm({ ...globalForm, makingCharges: e.target.value })}
                className="input-dark"
              />
            </div>
            <div>
              <label className="label-dark">GST (%)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={globalForm.gst}
                onChange={(e) => setGlobalForm({ ...globalForm, gst: e.target.value })}
                className="input-dark"
              />
            </div>
            {previewPrice && (
              <div className="text-sm text-dark-400 pb-2">
                Final price per {globalForm.unit}:{' '}
                <span className="text-gold-400 font-semibold">
                  ₹{previewPrice.toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={savingGlobal}
              className="btn-gold px-6 py-2.5 disabled:opacity-60"
            >
              {savingGlobal ? 'Saving...' : 'Save Global Settings'}
            </button>
          </div>
        </form>

        {/* Confirmation modal */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center flex-shrink-0">
                  <FiAlertTriangle size={20} className="text-gold-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Update Live Pricing?</h3>
                  <p className="text-dark-400 text-sm">
                    Updating live pricing will immediately recalculate prices for all matching{' '}
                    <span className="text-gold-400 font-medium">
                      {pendingGlobalForm?.material} · {pendingGlobalForm?.purity} · {pendingGlobalForm?.unit}
                    </span>{' '}
                    products. This cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowConfirm(false); setPendingGlobalForm(null); }}
                  className="px-4 py-2 rounded-lg text-sm text-dark-400 hover:text-white bg-dark-700 hover:bg-dark-600 border border-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmGlobalSave}
                  className="btn-gold px-5 py-2 text-sm"
                >
                  Yes, Update Pricing
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Current rates summary */}
        {globalPricingData.length > 0 && (
          <div className="mt-5 pt-4 border-t border-white/10">
            <div className="mb-3">
              <p className="text-xs text-dark-500 uppercase tracking-wider">Current Live Rates</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {globalPricingData.map((entry) => (
                <div
                  key={`${entry.material}-${entry.purity}-${entry.unit}`}
                  className="relative bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs group"
                >
                  <button
                    onClick={() => handleDeleteGlobalPricing(entry._id)}
                    className="absolute top-1.5 right-1.5 text-dark-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete entry"
                  >
                    <FiTrash2 size={11} />
                  </button>
                  <p className="text-dark-400">{entry.material} · {entry.purity}</p>
                  <p className="text-gold-400 font-semibold mt-0.5">
                    ₹{Number(entry.livePrice).toLocaleString('en-IN')} / {entry.unit}
                  </p>
                  <p className="text-dark-600 mt-0.5">MC {entry.makingCharges}% · GST {entry.gst}%</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* === PRICING MODULE === */}
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <FiDollarSign size={20} />
            </div>
            <div>
              <h2 className="font-display text-lg text-white">Bulk Base Pricing</h2>
              <p className="text-dark-400 text-xs">Increase or decrease global material rates</p>
            </div>
          </div>

          <form onSubmit={handlePricingSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-dark">By Material</label>
                <select value={pricingForm.material} onChange={(e) => setPricingForm({ ...pricingForm, material: e.target.value })} className="input-dark">
                  <option value="">Any</option>
                  {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label-dark">By Category</label>
                <select value={pricingForm.category} onChange={(e) => setPricingForm({ ...pricingForm, category: e.target.value })} className="input-dark">
                  <option value="">Any</option>
                  {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-dark">Operation</label>
                <select value={pricingForm.operation} onChange={(e) => setPricingForm({ ...pricingForm, operation: e.target.value })} className="input-dark">
                  <option value="percentage">Percentage (%)</option>
                  <option value="flat">Flat Amount (₹)</option>
                </select>
              </div>
              <div>
                <label className="label-dark">Value (e.g. 10 or -10)</label>
                <input type="number" required value={pricingForm.amount} onChange={(e) => setPricingForm({ ...pricingForm, amount: e.target.value })} placeholder="+/- Amount" className="input-dark" />
              </div>
            </div>
            <button type="submit" className="btn-gold w-full mt-4 py-2.5">Apply Price Update</button>
          </form>
        </div>

        {/* === DISCOUNT MODULE === */}
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <FiPercent size={20} />
            </div>
            <div>
              <h2 className="font-display text-lg text-white">Discount Manager</h2>
              <p className="text-dark-400 text-xs">Apply flat/percentage discounts globally</p>
            </div>
          </div>

          <form onSubmit={handleDiscountSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-dark">Target Scope</label>
                <select value={discountForm.targetType} onChange={(e) => setDiscountForm({ ...discountForm, targetType: e.target.value })} className="input-dark">
                  <option value="global">Global (All Products)</option>
                  <option value="category">Specific Category</option>
                  <option value="product">Specific Product ID</option>
                </select>
              </div>
              {discountForm.targetType === 'category' && (
                <div>
                  <label className="label-dark">Category</label>
                  <select value={discountForm.targetId} onChange={(e) => setDiscountForm({ ...discountForm, targetId: e.target.value })} className="input-dark" required>
                    <option value="">Select Category</option>
                    {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {discountForm.targetType === 'product' && (
                <div>
                  <label className="label-dark">Product ID</label>
                  <input type="text" value={discountForm.targetId} onChange={(e) => setDiscountForm({ ...discountForm, targetId: e.target.value })} placeholder="64b1f..." className="input-dark" required />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-dark">Discount Type</label>
                <select value={discountForm.discountType} onChange={(e) => setDiscountForm({ ...discountForm, discountType: e.target.value })} className="input-dark">
                  <option value="percentage">Percentage (%)</option>
                  <option value="flat">Flat Amount (₹)</option>
                  <option value="remove">Remove Discounts</option>
                </select>
              </div>
              {discountForm.discountType !== 'remove' && (
                <div>
                  <label className="label-dark">Value (Positive)</label>
                  <input type="number" min="0" step="0.01" required value={discountForm.discountValue} onChange={(e) => setDiscountForm({ ...discountForm, discountValue: e.target.value })} placeholder="e.g. 15" className="input-dark" />
                </div>
              )}
            </div>
            <button type="submit" className="btn-gold w-full mt-4 py-2.5">Update Discounts</button>
          </form>
        </div>

      </div>
    </div>
  );
}
