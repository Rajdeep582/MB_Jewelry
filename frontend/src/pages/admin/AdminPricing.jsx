import { useEffect, useState, useCallback } from 'react';
import { FiPercent, FiTrendingUp, FiAlertTriangle, FiTrash2, FiTag } from 'react-icons/fi';
import { categoryService, adminService } from '../../services/services';
import toast from 'react-hot-toast';

const GLOBAL_MATERIALS = ['Gold', 'Silver', 'Diamond'];
const PURITY_MAP = {
  Gold: ['22K', '18K'],
  Silver: ['Normal', 'Hallmarked'],
  Diamond: ['22K', '18K', '14K'],
};

const DEFAULT_GLOBAL_FORM = {
  material: 'Gold', purity: '22K', unit: 'gram',
  livePrice: '', makingCharges: 12, gst: 3,
};

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="label-dark !text-xs !mb-0">{label}</label>
      {children}
    </div>
  );
}

/* Compact input — same bg/border as site's input-dark but py-2 instead of py-3 */
const inp = "w-full px-3 py-2 rounded-xl bg-dark-800 border border-white/10 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500/30 transition-all";

export default function AdminPricing() {
  const [categories, setCategories] = useState([]);
  const [globalPricingData, setGlobalPricingData] = useState([]);
  const [globalForm, setGlobalForm] = useState(DEFAULT_GLOBAL_FORM);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingGlobalForm, setPendingGlobalForm] = useState(null);

  const [discountForm, setDiscountForm] = useState({ targetType: 'global', targetId: '', discountType: 'percentage', discountValue: '' });

  const loadGlobalPricing = useCallback(async () => {
    try {
      const res = await adminService.getGlobalPricing();
      setGlobalPricingData(res.data.pricing);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    document.title = 'Pricing & Discounts — Admin';
    categoryService.getCategories().then((res) => setCategories(res.data.categories));
    loadGlobalPricing();
  }, [loadGlobalPricing]);

  const handleGlobalMaterialChange = (material) => {
    const defaultPurity = PURITY_MAP[material][0];
    const existing = globalPricingData.find(
      (p) => p.material === material && p.purity === defaultPurity && p.unit === globalForm.unit
    );
    setGlobalForm({ ...globalForm, material, purity: defaultPurity, livePrice: existing?.livePrice ?? '', makingCharges: existing?.makingCharges ?? 12, gst: existing?.gst ?? 3 });
  };

  const handleGlobalPurityOrUnitChange = (field, value) => {
    const newForm = { ...globalForm, [field]: value };
    const existing = globalPricingData.find(
      (p) => p.material === newForm.material && p.purity === newForm.purity && p.unit === newForm.unit
    );
    setGlobalForm({ ...newForm, livePrice: existing?.livePrice ?? '', makingCharges: existing?.makingCharges ?? 12, gst: existing?.gst ?? 3 });
  };

  const handleGlobalSubmit = (e) => {
    e.preventDefault();
    const livePrice = Number(globalForm.livePrice);
    if (!globalForm.livePrice || isNaN(livePrice) || livePrice < 0) { toast.error('Enter a valid live price'); return; }
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

  const handleDiscountSubmit = async (e) => {
    e.preventDefault();
    const value = Number(discountForm.discountValue);
    if (discountForm.discountType !== 'remove' && (isNaN(value) || value <= 0)) { toast.error('Invalid discount value'); return; }
    if (discountForm.targetType !== 'global' && !discountForm.targetId) { toast.error('Target ID is required'); return; }
    try {
      const res = await adminService.bulkUpdateDiscounts({ ...discountForm, discountValue: value });
      toast.success(res.data.message);
      setDiscountForm({ ...discountForm, discountValue: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Update failed'); }
  };

  const previewPrice = (() => {
    const lp = Number(globalForm.livePrice);
    if (!lp) return null;
    const withMaking = lp * (1 + Number(globalForm.makingCharges) / 100);
    return Math.round(withMaking * (1 + Number(globalForm.gst) / 100));
  })();

  return (
    <div className="space-y-3">
      {/* Heading */}
      <div>
        <h1 className="font-display text-xl text-white">Pricing &amp; Discounts</h1>
        <p className="text-dark-400 text-sm">Manage live rates, bulk pricing, and storewide discounts</p>
      </div>

      {/* ── Global Jewelry Settings ── */}
      <div className="card p-0">
        {/* Card header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center shrink-0">
            <FiTrendingUp size={15} className="text-gold-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Global Jewelry Settings</p>
            <p className="text-dark-500 text-xs">Live rates by material, making charges &amp; GST</p>
          </div>
        </div>

        <form onSubmit={handleGlobalSubmit} className="p-5 space-y-3">
          {/* Row 1: Material | Purity | Live Price | Unit */}
          <div className="grid grid-cols-4 gap-3">
            <Field label="Material">
              <select value={globalForm.material} onChange={(e) => handleGlobalMaterialChange(e.target.value)} className={inp}>
                {GLOBAL_MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Purity">
              <select value={globalForm.purity} onChange={(e) => handleGlobalPurityOrUnitChange('purity', e.target.value)} className={inp}>
                {PURITY_MAP[globalForm.material].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Live Price (₹)">
              <input type="number" min="0" step="0.01" required value={globalForm.livePrice}
                onChange={(e) => setGlobalForm({ ...globalForm, livePrice: e.target.value })}
                placeholder="e.g. 1383.4" className={`${inp} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
            </Field>
            <Field label="Unit">
              <select value={globalForm.unit} onChange={(e) => handleGlobalPurityOrUnitChange('unit', e.target.value)} className={inp}>
                <option value="gram">/ gram</option>
                <option value="kg">/ kg</option>
              </select>
            </Field>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-3 gap-3 items-end">
            <Field label="Making Charges (%)">
              <input type="number" min="0" step="0.1" value={globalForm.makingCharges}
                onChange={(e) => setGlobalForm({ ...globalForm, makingCharges: e.target.value })} className={inp} />
            </Field>
            <Field label="GST (%)">
              <input type="number" min="0" step="0.1" value={globalForm.gst}
                onChange={(e) => setGlobalForm({ ...globalForm, gst: e.target.value })} className={inp} />
            </Field>
            <div className="flex items-end gap-2">
              {previewPrice && (
                <div className="flex-1 bg-gold-500/5 border border-gold-500/20 rounded-xl px-3 py-2 text-center">
                  <p className="text-[10px] text-dark-500 uppercase tracking-wider">Final / {globalForm.unit}</p>
                  <p className="text-gold-400 font-bold text-sm mt-0.5">₹{previewPrice.toLocaleString('en-IN')}</p>
                </div>
              )}
              <button type="submit" disabled={savingGlobal}
                className="btn-gold !px-4 !py-2 !text-sm disabled:opacity-60 whitespace-nowrap">
                {savingGlobal ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>

        {/* Live rates grid */}
        {globalPricingData.length > 0 && (
          <div className="px-5 pb-4 border-t border-white/5 pt-4">
            <p className="text-xs text-dark-500 uppercase tracking-wider mb-2.5">Current Live Rates</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {globalPricingData.map((entry) => (
                <div key={`${entry.material}-${entry.purity}-${entry.unit}`}
                  className="relative bg-dark-900/60 border border-white/5 rounded-xl px-3 py-2.5 group hover:border-gold-500/20 transition-colors">
                  <button onClick={() => handleDeleteGlobalPricing(entry._id)}
                    className="absolute top-1.5 right-1.5 text-dark-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete">
                    <FiTrash2 size={10} />
                  </button>
                  <p className="text-dark-400 text-[11px]">{entry.material} · {entry.purity}</p>
                  <p className="text-gold-400 font-bold text-sm mt-1">
                    ₹{Number(entry.livePrice).toLocaleString('en-IN')}
                    <span className="text-dark-500 font-normal text-[10px] ml-1">/{entry.unit}</span>
                  </p>
                  <p className="text-dark-600 text-[10px] mt-1">MC {entry.makingCharges}% · GST {entry.gst}%</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Discount Manager ── */}
      <div className="card p-0">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5">
            <div className="w-8 h-8 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center shrink-0">
              <FiTag size={14} className="text-gold-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Discount Manager</p>
              <p className="text-dark-500 text-xs">Apply discounts globally or per category</p>
            </div>
          </div>
          <form onSubmit={handleDiscountSubmit} className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Target Scope">
                <select value={discountForm.targetType} onChange={(e) => setDiscountForm({ ...discountForm, targetType: e.target.value })} className={inp}>
                  <option value="global">Global (All Products)</option>
                  <option value="category">Specific Category</option>
                  <option value="product">Specific Product ID</option>
                </select>
              </Field>
              {discountForm.targetType === 'category' && (
                <Field label="Category">
                  <select value={discountForm.targetId} onChange={(e) => setDiscountForm({ ...discountForm, targetId: e.target.value })} className={inp} required>
                    <option value="">Select Category</option>
                    {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </Field>
              )}
              {discountForm.targetType === 'product' && (
                <Field label="Product ID">
                  <input type="text" value={discountForm.targetId}
                    onChange={(e) => setDiscountForm({ ...discountForm, targetId: e.target.value })}
                    placeholder="64b1f…" className={inp} required />
                </Field>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Discount Type">
                <select value={discountForm.discountType} onChange={(e) => setDiscountForm({ ...discountForm, discountType: e.target.value })} className={inp}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="flat">Flat Amount (₹)</option>
                  <option value="remove">Remove Discounts</option>
                </select>
              </Field>
              {discountForm.discountType !== 'remove' && (
                <Field label="Value (positive)">
                  <input type="number" min="0" step="0.01" required value={discountForm.discountValue}
                    onChange={(e) => setDiscountForm({ ...discountForm, discountValue: e.target.value })}
                    placeholder="e.g. 15" className={inp} />
                </Field>
              )}
            </div>
            <button type="submit" className="btn-gold w-full !py-2 !text-sm mt-1">Update Discounts</button>
          </form>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 border border-white/5 rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center shrink-0">
                <FiAlertTriangle size={16} className="text-gold-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm mb-1">Update Live Pricing?</h3>
                <p className="text-dark-400 text-xs leading-relaxed">
                  Immediately recalculates prices for all matching{' '}
                  <span className="text-gold-400 font-medium">
                    {pendingGlobalForm?.material} · {pendingGlobalForm?.purity} · /{pendingGlobalForm?.unit}
                  </span>{' '}
                  products. Cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowConfirm(false); setPendingGlobalForm(null); }}
                className="flex-1 px-3 py-2 rounded-xl text-xs text-dark-400 hover:text-white bg-dark-900 hover:bg-dark-700 border border-white/5 transition-colors">
                Cancel
              </button>
              <button onClick={confirmGlobalSave} className="flex-1 btn-gold !py-2 !text-xs !font-semibold">
                Yes, Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
