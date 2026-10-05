import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  FiTrendingUp, FiAlertTriangle, FiTrash2, FiTag, FiEdit3, FiInfo, FiArrowUpRight, FiArrowDownRight, FiCheck,
} from 'react-icons/fi';
import { categoryService, adminService, productService } from '../../services/services';
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

// Plausible ₹-per-gram band per metal — outside it the rate was probably typed for the other unit
const PER_GRAM_RANGE = { Gold: [1000, 60000], Silver: [20, 2000] };

const MATERIAL_DOT = {
  Gold: 'bg-gradient-to-br from-gold-300 to-gold-600',
  Silver: 'bg-gradient-to-br from-slate-200 to-slate-400',
  Diamond: 'bg-gradient-to-br from-sky-200 to-indigo-300',
};

/* ₹ with up to 2 decimals (rates like 1383.4 must not be rounded away) */
const inr = (n, dp = 2) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: dp })}`;
const perGram = (entry) => (entry.unit === 'kg' ? entry.livePrice / 1000 : entry.livePrice);

/** unitWarning — message when a rate looks typed for the wrong unit (e.g. a per-kg silver rate saved per gram). */
function unitWarning(material, unit, livePrice) {
  const range = PER_GRAM_RANGE[material];
  const lp = Number(livePrice);
  if (!range || !lp) return '';
  const g = unit === 'kg' ? lp / 1000 : lp;
  if (g > range[1]) return `High for ${material} per ${unit} — did you mean per ${unit === 'gram' ? 'kg' : 'gram'}?`;
  if (g < range[0]) return `Low for ${material} per ${unit} — did you mean per ${unit === 'gram' ? 'kg' : 'gram'}?`;
  return '';
}

function Field({ label, hint, children, className = '' }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-[11px] font-medium uppercase tracking-wider text-dark-400">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-dark-500 leading-tight">{hint}</p>}
    </div>
  );
}

/* Compact input — same look as the site's input-dark, tighter */
const inp = 'w-full h-10 px-3 rounded-xl bg-dark-900/70 border border-white/10 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-gold-500/70 focus:ring-1 focus:ring-gold-500/30 transition-colors';
const noSpin = '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

/** Input with a fixed prefix/suffix (₹ or %) */
function Adorned({ prefix, suffix, ...props }) {
  return (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dark-400 text-sm">{prefix}</span>}
      <input {...props} className={`${inp} ${noSpin} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-8' : ''}`} />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 text-sm">{suffix}</span>}
    </div>
  );
}

/** Segmented control */
function Segmented({ value, onChange, options }) {
  return (
    <div className="grid h-10 p-1 rounded-xl bg-dark-900/70 border border-white/10" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-lg text-xs font-medium transition-colors whitespace-nowrap px-2 ${
            value === o.value ? 'bg-gold-500/15 text-gold-300 border border-gold-500/30' : 'text-dark-400 hover:text-white border border-transparent'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CardHeader({ icon, title, subtitle, right }) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-white/5">
      <div className="w-8 h-8 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center shrink-0">
        <Icon size={14} className="text-gold-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-white font-semibold text-sm">{title}</p>
        <p className="text-dark-500 text-xs truncate">{subtitle}</p>
      </div>
      {right}
    </div>
  );
}

function ConfirmDialog({ tone = 'gold', title, children, confirmLabel, onConfirm, onCancel }) {
  const danger = tone === 'red';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-dark-800 border border-white/10 rounded-2xl p-5 max-w-sm w-full shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${danger ? 'bg-red-500/10 border-red-500/20' : 'bg-gold-500/10 border-gold-500/20'}`}>
            <FiAlertTriangle size={16} className={danger ? 'text-red-400' : 'text-gold-400'} />
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-sm mb-1">{title}</h3>
            <div className="text-dark-400 text-xs leading-relaxed">{children}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel}
            className="flex-1 px-3 py-2 rounded-xl text-xs text-dark-300 hover:text-white bg-dark-900 hover:bg-dark-700 border border-white/10 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            className={danger
              ? 'flex-1 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors'
              : 'flex-1 btn-gold !py-2 !text-xs !font-semibold hover:!translate-y-0'}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPricing() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [globalPricingData, setGlobalPricingData] = useState([]);
  const [globalForm, setGlobalForm] = useState(DEFAULT_GLOBAL_FORM);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingGlobalForm, setPendingGlobalForm] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [discountForm, setDiscountForm] = useState({ targetType: 'global', targetId: '', discountType: 'percentage', discountValue: '' });
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [confirmDiscount, setConfirmDiscount] = useState(false);

  const loadGlobalPricing = useCallback(async () => {
    try {
      const res = await adminService.getGlobalPricing();
      setGlobalPricingData(res.data.pricing);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    document.title = 'Pricing & Discounts — Admin';
    categoryService.getCategories().then((res) => setCategories(res.data.categories)).catch(() => {});
    loadGlobalPricing();
    // Product list for the "single product" discount picker (+ live prices for the preview)
    (async () => {
      const all = [];
      for (let page = 1; page <= 4; page += 1) {
        try {
          const res = await productService.getProducts({ page, limit: 50, sort: 'newest' });
          all.push(...(res.data.products || []));
          if (page >= (res.data.pagination?.pages || 1)) break;
        } catch { break; }
      }
      setProducts(all);
    })();
  }, [loadGlobalPricing]);

  /* ── Live rate form ─────────────────────────────────────────────────────── */
  const findEntry = (material, purity, unit) =>
    globalPricingData.find((p) => p.material === material && p.purity === purity && p.unit === unit);

  const handleGlobalMaterialChange = (material) => {
    const defaultPurity = PURITY_MAP[material][0];
    const existing = findEntry(material, defaultPurity, globalForm.unit);
    setGlobalForm({ ...globalForm, material, purity: defaultPurity, livePrice: existing?.livePrice ?? '', makingCharges: existing?.makingCharges ?? 12, gst: existing?.gst ?? 3 });
  };

  const handleGlobalPurityOrUnitChange = (field, value) => {
    const newForm = { ...globalForm, [field]: value };
    const existing = findEntry(newForm.material, newForm.purity, newForm.unit);
    setGlobalForm({ ...newForm, livePrice: existing?.livePrice ?? '', makingCharges: existing?.makingCharges ?? 12, gst: existing?.gst ?? 3 });
  };

  /** Click a rate card → load it into the form for editing */
  const editEntry = (entry) => {
    setGlobalForm({
      material: entry.material, purity: entry.purity, unit: entry.unit,
      livePrice: entry.livePrice, makingCharges: entry.makingCharges ?? 12, gst: entry.gst ?? 3,
    });
    document.getElementById('rate-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleGlobalSubmit = (e) => {
    e.preventDefault();
    const livePrice = Number(globalForm.livePrice);
    if (!globalForm.livePrice || Number.isNaN(livePrice) || livePrice <= 0) { toast.error('Enter a valid live price'); return; }
    if (globalForm.makingCharges === '' || globalForm.gst === '') { toast.error('Making % and GST % are required'); return; }
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

  const confirmDeleteGlobalPricing = async () => {
    const entry = deleteTarget;
    setDeleteTarget(null);
    try {
      await adminService.deleteGlobalPricing(entry._id);
      setGlobalPricingData((prev) => prev.filter((e) => e._id !== entry._id));
      toast.success('Pricing entry deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  /* Breakdown for 1 unit with the form values (what a product with these defaults would cost) */
  const breakdown = useMemo(() => {
    const lp = Number(globalForm.livePrice);
    if (!lp) return null;
    const mc = Number(globalForm.makingCharges) || 0;
    const gst = Number(globalForm.gst) || 0;
    const making = lp * (mc / 100);
    const shop = lp + making;
    const tax = shop * (gst / 100);
    return { lp, mc, gst, making, shop, tax, total: Math.round(shop + tax) };
  }, [globalForm.livePrice, globalForm.makingCharges, globalForm.gst]);

  const currentEntry = findEntry(globalForm.material, globalForm.purity, globalForm.unit);
  const changePct = currentEntry && Number(globalForm.livePrice) && Number(currentEntry.livePrice)
    ? ((Number(globalForm.livePrice) - currentEntry.livePrice) / currentEntry.livePrice) * 100
    : null;
  const formWarning = unitWarning(globalForm.material, globalForm.unit, globalForm.livePrice);

  /* ── Discounts ──────────────────────────────────────────────────────────── */
  const discountScope = useMemo(() => {
    if (discountForm.targetType === 'product') return products.filter((p) => p._id === discountForm.targetId);
    if (discountForm.targetType === 'category') return products.filter((p) => (p.category?._id || p.category) === discountForm.targetId);
    return products;
  }, [products, discountForm.targetType, discountForm.targetId]);

  const discountPreview = useMemo(() => {
    const sample = discountScope.find((p) => p.price > 0);
    const v = Number(discountForm.discountValue);
    if (!sample || discountForm.discountType === 'remove' || !(v > 0)) return null;
    const after = discountForm.discountType === 'percentage'
      ? Math.round(sample.price * (1 - v / 100))
      : Math.round(sample.price - v);
    return { name: sample.name, before: sample.price, after };
  }, [discountScope, discountForm.discountType, discountForm.discountValue]);

  const scopeLabel = (() => {
    if (discountForm.targetType === 'category') return categories.find((c) => c._id === discountForm.targetId)?.name || 'selected category';
    if (discountForm.targetType === 'product') return discountScope[0]?.name || 'selected product';
    return 'all products';
  })();

  const handleDiscountSubmit = (e) => {
    e.preventDefault();
    const value = Number(discountForm.discountValue);
    if (discountForm.discountType !== 'remove' && (Number.isNaN(value) || value <= 0)) { toast.error('Invalid discount value'); return; }
    if (discountForm.discountType === 'percentage' && value > 99) { toast.error('Percentage discount can be at most 99%'); return; }
    if (discountForm.targetType !== 'global' && !discountForm.targetId) {
      toast.error(discountForm.targetType === 'category' ? 'Choose a category' : 'Choose a product');
      return;
    }
    setConfirmDiscount(true);
  };

  const applyDiscount = async () => {
    setConfirmDiscount(false);
    setSavingDiscount(true);
    try {
      const res = await adminService.bulkUpdateDiscounts({ ...discountForm, discountValue: Number(discountForm.discountValue) });
      toast.success(res.data.message);
      setDiscountForm({ ...discountForm, discountValue: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSavingDiscount(false);
    }
  };

  const discountActionText = (() => {
    const v = Number(discountForm.discountValue);
    if (discountForm.discountType === 'remove') return `Remove discounts from ${scopeLabel}`;
    if (discountForm.discountType === 'percentage') return v ? `${v}% off ${scopeLabel}` : `Percent off ${scopeLabel}`;
    return v ? `${inr(v, 0)} off ${scopeLabel}` : `Amount off ${scopeLabel}`;
  })();

  const sortedRates = useMemo(
    () => [...globalPricingData].sort((a, b) =>
      GLOBAL_MATERIALS.indexOf(a.material) - GLOBAL_MATERIALS.indexOf(b.material)
      || String(a.purity).localeCompare(String(b.purity))
      || String(a.unit).localeCompare(String(b.unit))),
    [globalPricingData]
  );

  return (
    <div className="space-y-3">
      {/* Heading */}
      <div>
        <h1 className="font-display text-xl sm:text-2xl text-white">Pricing &amp; Discounts</h1>
        <p className="text-dark-400 text-sm mt-0.5">Live metal rates drive every product price · discounts follow the live rate</p>
      </div>

      {/* ── Live metal rates ── */}
      <div className="card p-0" id="rate-form">
        <CardHeader
          icon={FiTrendingUp}
          title="Live Metal Rates"
          subtitle="Saving re-prices matching products instantly"
          right={globalPricingData.length > 0 && (
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] text-dark-300">
              {globalPricingData.length} rate{globalPricingData.length === 1 ? '' : 's'}
            </span>
          )}
        />

        <form onSubmit={handleGlobalSubmit} className="p-4 sm:p-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          {/* Inputs */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
              <Field label="Unit">
                <Segmented
                  value={globalForm.unit}
                  onChange={(v) => handleGlobalPurityOrUnitChange('unit', v)}
                  options={[{ value: 'gram', label: 'per gram' }, { value: 'kg', label: 'per kg' }]}
                />
              </Field>
              <Field label={`Live rate / ${globalForm.unit}`}>
                <Adorned prefix="₹" type="number" min="0" step="0.01" required value={globalForm.livePrice}
                  onChange={(e) => setGlobalForm({ ...globalForm, livePrice: e.target.value })}
                  placeholder={globalForm.unit === 'kg' ? 'e.g. 92000' : 'e.g. 7250'} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Making charges">
                <Adorned suffix="%" type="number" min="0" step="0.1" required value={globalForm.makingCharges}
                  onChange={(e) => setGlobalForm({ ...globalForm, makingCharges: e.target.value })} />
              </Field>
              <Field label="GST">
                <Adorned suffix="%" type="number" min="0" step="0.1" required value={globalForm.gst}
                  onChange={(e) => setGlobalForm({ ...globalForm, gst: e.target.value })} />
              </Field>
            </div>

            <p className="flex items-start gap-1.5 text-[11px] text-dark-500 leading-relaxed">
              <FiInfo size={12} className="mt-0.5 shrink-0 text-dark-400" />
              <span>
                Metal defaults (12% / 3% unless changed). Products are priced with the making % and GST % saved on each
                product · GST here also prices custom-order quotes · shop prices exclude GST, added at checkout.
              </span>
            </p>

            {(currentEntry || formWarning) && (
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {currentEntry && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/10 text-dark-300">
                    <FiEdit3 size={11} className="text-gold-400" />
                    Updating current rate {inr(currentEntry.livePrice)}/{currentEntry.unit}
                    {changePct !== null && Math.abs(changePct) >= 0.01 && (
                      <span className={`inline-flex items-center gap-0.5 font-medium ${changePct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {changePct > 0 ? <FiArrowUpRight size={11} /> : <FiArrowDownRight size={11} />}
                        {Math.abs(changePct).toFixed(1)}%
                      </span>
                    )}
                  </span>
                )}
                {formWarning && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300">
                    <FiAlertTriangle size={11} /> {formWarning}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Price breakdown + save */}
          <div className="rounded-2xl border border-gold-500/15 bg-gradient-to-b from-gold-500/[0.06] to-transparent p-3.5 flex flex-col">
            <p className="text-[10px] uppercase tracking-[0.18em] text-gold-500/80 font-semibold mb-2">
              Per 1 {globalForm.unit} · {globalForm.material} {globalForm.purity}
            </p>
            {breakdown ? (
              <dl className="space-y-1.5 text-xs tabular-nums">
                <div className="flex justify-between"><dt className="text-dark-400">Metal rate</dt><dd className="text-dark-200">{inr(breakdown.lp)}</dd></div>
                <div className="flex justify-between"><dt className="text-dark-400">Making ({breakdown.mc}%)</dt><dd className="text-dark-200">+ {inr(breakdown.making)}</dd></div>
                <div className="flex justify-between pt-1.5 border-t border-white/5"><dt className="text-white font-medium">Shop price</dt><dd className="text-white font-medium">{inr(breakdown.shop, 0)}</dd></div>
                <div className="flex justify-between"><dt className="text-dark-400">GST ({breakdown.gst}%) at checkout</dt><dd className="text-dark-200">+ {inr(breakdown.tax)}</dd></div>
                <div className="flex justify-between items-baseline pt-1.5 border-t border-white/5">
                  <dt className="text-dark-300">Customer pays</dt>
                  <dd className="text-gold-400 font-bold text-base">{inr(breakdown.total, 0)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-dark-500 py-4 text-center">Enter a live rate to see the price breakdown</p>
            )}
            <button type="submit" disabled={savingGlobal}
              className="btn-gold w-full !py-2.5 !text-sm mt-3 hover:!translate-y-0 disabled:opacity-60">
              {savingGlobal ? 'Saving…' : currentEntry ? 'Update rate' : 'Save rate'}
            </button>
          </div>
        </form>

        {/* Current live rates */}
        {sortedRates.length > 0 && (
          <div className="px-4 sm:px-5 pb-4 pt-3.5 border-t border-white/5">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] text-dark-500 uppercase tracking-wider">Current live rates</p>
              <p className="text-[10px] text-dark-600">Click a rate to edit</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
              {sortedRates.map((entry) => {
                const selected = entry.material === globalForm.material && entry.purity === globalForm.purity && entry.unit === globalForm.unit;
                const warn = unitWarning(entry.material, entry.unit, entry.livePrice);
                const g = perGram(entry);
                return (
                  <div
                    key={entry._id || `${entry.material}-${entry.purity}-${entry.unit}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => editEntry(entry)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editEntry(entry); } }}
                    className={`group relative rounded-xl px-3 py-2.5 border cursor-pointer outline-none transition-colors focus-visible:border-gold-500/50 ${
                      selected ? 'border-gold-500/40 bg-gold-500/[0.06]' : 'border-white/[0.06] bg-dark-900/60 hover:border-gold-500/25'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${MATERIAL_DOT[entry.material] || 'bg-dark-500'}`} />
                      <p className="text-dark-300 text-xs font-medium truncate flex-1">{entry.material} · {entry.purity}</p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(entry); }}
                        aria-label={`Delete ${entry.material} ${entry.purity} per ${entry.unit} rate`}
                        className="p-1 -m-1 rounded-md text-dark-600 hover:text-red-400 hover:bg-red-500/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition"
                      >
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                    <p className="mt-1.5 text-gold-400 font-bold text-base tabular-nums leading-tight">
                      {inr(entry.livePrice)}<span className="text-dark-500 font-normal text-[11px] ml-1">/{entry.unit}</span>
                    </p>
                    <p className="text-[10px] text-dark-500 tabular-nums mt-0.5">
                      {entry.unit === 'kg' ? `≈ ${inr(g)}/gram` : `≈ ${inr(g * 1000, 0)}/kg`}
                      <span className="text-dark-600"> · MC {entry.makingCharges}% · GST {entry.gst}%</span>
                    </p>
                    {warn && (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-amber-300">
                        <FiAlertTriangle size={10} /> Check unit — {warn.split(' — ')[1]}
                      </p>
                    )}
                    {selected && <FiCheck size={12} className="absolute bottom-2 right-2 text-gold-400" aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Discount Manager ── */}
      <div className="card p-0">
        <CardHeader icon={FiTag} title="Discount Manager" subtitle="Kept as a % of the live price — follows rate changes" />
        <form onSubmit={handleDiscountSubmit} className="p-4 sm:p-5 space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="Apply to">
              <Segmented
                value={discountForm.targetType}
                onChange={(v) => setDiscountForm({ ...discountForm, targetType: v, targetId: '' })}
                options={[{ value: 'global', label: 'All products' }, { value: 'category', label: 'Category' }, { value: 'product', label: 'One product' }]}
              />
            </Field>
            {discountForm.targetType === 'category' && (
              <Field label="Category">
                <select value={discountForm.targetId} onChange={(e) => setDiscountForm({ ...discountForm, targetId: e.target.value })} className={inp} required>
                  <option value="">Choose a category…</option>
                  {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </Field>
            )}
            {discountForm.targetType === 'product' && (
              <Field label="Product">
                <select value={discountForm.targetId} onChange={(e) => setDiscountForm({ ...discountForm, targetId: e.target.value })} className={inp} required>
                  <option value="">Choose a product…</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}{p.productId ? ` · ${p.productId}` : ''}{p.price > 0 ? ` · ${inr(p.price, 0)}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end">
            <Field label="Discount">
              <Segmented
                value={discountForm.discountType}
                onChange={(v) => setDiscountForm({ ...discountForm, discountType: v })}
                options={[{ value: 'percentage', label: '% off' }, { value: 'flat', label: '₹ off' }, { value: 'remove', label: 'Remove' }]}
              />
            </Field>
            {discountForm.discountType !== 'remove' ? (
              <Field label={discountForm.discountType === 'percentage' ? 'Percent off (max 99)' : 'Amount off'}>
                <Adorned
                  prefix={discountForm.discountType === 'flat' ? '₹' : undefined}
                  suffix={discountForm.discountType === 'percentage' ? '%' : undefined}
                  type="number" min="0.01" step="0.01" required
                  max={discountForm.discountType === 'percentage' ? 99 : undefined}
                  value={discountForm.discountValue}
                  onChange={(e) => setDiscountForm({ ...discountForm, discountValue: e.target.value })}
                  placeholder={discountForm.discountType === 'percentage' ? 'e.g. 10' : 'e.g. 1500'}
                />
              </Field>
            ) : (
              <div className="h-10 flex items-center text-xs text-dark-400">Clears the discount on {scopeLabel}.</div>
            )}
            <button type="submit" disabled={savingDiscount}
              className="btn-gold h-10 !py-0 !px-5 !text-sm hover:!translate-y-0 disabled:opacity-60 whitespace-nowrap">
              {savingDiscount ? 'Applying…' : 'Apply'}
            </button>
          </div>

          {/* What will happen */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-dark-400">
            <span className="inline-flex items-center gap-1.5">
              <FiTag size={11} className="text-gold-500" />
              <span className="text-dark-200">{discountActionText}</span>
              {discountForm.targetType !== 'product' && products.length > 0 && (
                <span className="text-dark-500">({discountScope.length} product{discountScope.length === 1 ? '' : 's'} in the shop)</span>
              )}
            </span>
            {discountPreview && (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <span className="text-dark-500">e.g. {discountPreview.name}:</span>
                <span className="line-through text-dark-500">{inr(discountPreview.before, 0)}</span>
                <span className={discountPreview.after > 0 ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
                  {discountPreview.after > 0 ? inr(discountPreview.after, 0) : 'not allowed (≤ ₹0)'}
                </span>
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Confirm: save rate */}
      {showConfirm && pendingGlobalForm && (
        <ConfirmDialog
          title={findEntry(pendingGlobalForm.material, pendingGlobalForm.purity, pendingGlobalForm.unit) ? 'Update live rate?' : 'Add live rate?'}
          confirmLabel="Yes, save rate"
          onConfirm={confirmGlobalSave}
          onCancel={() => { setShowConfirm(false); setPendingGlobalForm(null); }}
        >
          <p>
            <span className="text-gold-400 font-medium">{pendingGlobalForm.material} {pendingGlobalForm.purity}</span>{' '}
            at <span className="text-white font-medium">{inr(pendingGlobalForm.livePrice)}/{pendingGlobalForm.unit}</span>
            {' '}· making {pendingGlobalForm.makingCharges}% · GST {pendingGlobalForm.gst}%.
          </p>
          <p className="mt-1.5">Every {pendingGlobalForm.material} {pendingGlobalForm.purity} product is re-priced immediately.</p>
          {unitWarning(pendingGlobalForm.material, pendingGlobalForm.unit, pendingGlobalForm.livePrice) && (
            <p className="mt-2 text-amber-300 flex items-start gap-1.5">
              <FiAlertTriangle size={12} className="mt-0.5 shrink-0" />
              {unitWarning(pendingGlobalForm.material, pendingGlobalForm.unit, pendingGlobalForm.livePrice)}
            </p>
          )}
        </ConfirmDialog>
      )}

      {/* Confirm: delete rate */}
      {deleteTarget && (
        <ConfirmDialog
          tone="red"
          title="Delete this live rate?"
          confirmLabel="Delete rate"
          onConfirm={confirmDeleteGlobalPricing}
          onCancel={() => setDeleteTarget(null)}
        >
          <p>
            <span className="text-white font-medium">{deleteTarget.material} {deleteTarget.purity}</span>{' '}
            ({inr(deleteTarget.livePrice)}/{deleteTarget.unit}). Products of this metal can&apos;t be re-priced until a rate is added again.
          </p>
        </ConfirmDialog>
      )}

      {/* Confirm: discount */}
      {confirmDiscount && (
        <ConfirmDialog
          tone={discountForm.discountType === 'remove' ? 'red' : 'gold'}
          title={discountForm.discountType === 'remove' ? 'Remove discounts?' : 'Apply discount?'}
          confirmLabel={discountForm.discountType === 'remove' ? 'Remove' : 'Apply discount'}
          onConfirm={applyDiscount}
          onCancel={() => setConfirmDiscount(false)}
        >
          <p className="text-dark-200">{discountActionText}.</p>
          <p className="mt-1.5">Shown on the shop with a strike-through price and charged at checkout.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
