import { useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiChevronDown, FiCheck, FiSliders } from 'react-icons/fi';
import { selectProductsFilter, selectProductsPagination, selectProductsLoading } from '../../store/productSlice';
import { categoryService } from '../../services/services';
import { debounce } from '../../utils/helpers';

const MATERIALS = ['Gold', 'Silver', 'Diamond'];
const PURITIES = ['22K', '18K', '14K', 'Normal', 'Hallmarked'];
// Quick price ranges (₹) — one tap instead of typing min/max
const PRICE_PRESETS = [
  { label: 'Under ₹10k',   min: '',       max: '10000' },
  { label: '₹10k – ₹50k',  min: '10000',  max: '50000' },
  { label: '₹50k – ₹1L',   min: '50000',  max: '100000' },
  { label: 'Above ₹1L',    min: '100000', max: '' },
];

/** Number of active filters (search excluded — it has its own box). */
function countActiveFilters(f) {
  return (f.category ? 1 : 0)
    + (f.material ? 1 : 0)
    + (f.purity ? f.purity.split(',').filter(Boolean).length : 0)
    + (f.minPrice || f.maxPrice ? 1 : 0);
}

function FilterSection({ title, children, badge = 0 }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-white/[0.07] py-4 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="group flex items-center justify-between w-full text-left"
      >
        <span className="flex items-center gap-2 font-jakarta text-[11px] font-semibold text-dark-200 uppercase tracking-[0.18em] group-hover:text-white transition-colors">
          {title}
          {badge > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-gold-500 text-dark-900 text-[10px] font-bold flex items-center justify-center tracking-normal">{badge}</span>
          )}
        </span>
        <FiChevronDown
          size={14}
          className={`text-dark-500 group-hover:text-gold-400 transition-all duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

FilterSection.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  badge: PropTypes.number,
};

/** One selectable row — radio (single choice) or checkbox (multi choice) look. */
function OptionRow({ label, selected, onClick, multi = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-lg font-jakarta text-sm transition-colors duration-200 ${
        selected ? 'text-gold-300 bg-gold-500/[0.08]' : 'text-dark-300 hover:text-white hover:bg-white/[0.04]'
      }`}
    >
      <span className={`flex-shrink-0 flex items-center justify-center w-4 h-4 border transition-all duration-200 ${multi ? 'rounded' : 'rounded-full'} ${
        selected ? 'bg-gold-500 border-gold-500' : 'border-dark-500 group-hover:border-white/50'
      }`}>
        {selected && (multi
          ? <FiCheck size={11} className="text-dark-900" strokeWidth={3} />
          : <span className="w-1.5 h-1.5 rounded-full bg-dark-900" />)}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

OptionRow.propTypes = {
  label: PropTypes.string.isRequired,
  selected: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  multi: PropTypes.bool,
};

/**
 * FilterSidebar — desktop sticky panel + mobile bottom-sheet drawer.
 * The mobile drawer is opened by the "Filters" button in the Shop toolbar (mobileOpen / onMobileClose).
 */
export default function FilterSidebar({ mobileOpen = false, onMobileClose = () => {} }) {
  const filters = useSelector(selectProductsFilter);
  const pagination = useSelector(selectProductsPagination);
  const loading = useSelector(selectProductsLoading);
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const activeCount = countActiveFilters(filters);

  const [minPrice, setMinPrice] = useState(filters.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice || '');

  useEffect(() => {
    categoryService.getCategories().then((res) => setCategories(res.data.categories || [])).catch(() => {});
  }, []);

  // Close the mobile drawer with Escape
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onMobileClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onMobileClose]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMinPrice(filters.minPrice || '');
     
    setMaxPrice(filters.maxPrice || '');
  }, [filters.minPrice, filters.maxPrice]);

  const handleChange = (key, value) => {
    // ── Diamond disabled: redirect to Coming Soon instead of filtering ──
    if (key === 'material' && value === 'Diamond') {
      navigate('/diamond-coming-soon');
      return;
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (filters[key] === value) next.delete(key);
      else if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page');
      return next;
    });
  };

  const debouncedPriceChange = useMemo(
    () => debounce((key, val) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (val) next.set(key, val);
        else next.delete(key);
        next.delete('page');
        return next;
      });
    }, 600),
    [setSearchParams]
  );

  const handleMinChange = (e) => {
    setMinPrice(e.target.value);
    debouncedPriceChange('minPrice', e.target.value);
  };

  const handleMaxChange = (e) => {
    setMaxPrice(e.target.value);
    debouncedPriceChange('maxPrice', e.target.value);
  };

  // Clears filters but keeps the search term and sort order
  const handleReset = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams();
      if (prev.get('search')) next.set('search', prev.get('search'));
      if (prev.get('sort')) next.set('sort', prev.get('sort'));
      return next;
    });
  };

  const applyPricePreset = (preset) => {
    const isActive = (filters.minPrice || '') === preset.min && (filters.maxPrice || '') === preset.max;
    setMinPrice(isActive ? '' : preset.min);
    setMaxPrice(isActive ? '' : preset.max);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      ['minPrice', 'maxPrice'].forEach((k) => next.delete(k));
      if (!isActive) {
        if (preset.min) next.set('minPrice', preset.min);
        if (preset.max) next.set('maxPrice', preset.max);
      }
      next.delete('page');
      return next;
    });
  };

  const handlePurityChange = (purity) => {
    const currentPurities = filters.purity ? filters.purity.split(',') : [];
    const isChecked = currentPurities.includes(purity);
    const newPurities = isChecked
      ? currentPurities.filter((p) => p !== purity)
      : [...currentPurities, purity];
    const updatedValue = newPurities.join(',');
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (updatedValue) next.set('purity', updatedValue);
      else next.delete('purity');
      next.delete('page');
      return next;
    });
  };

  const currentPurities = filters.purity ? filters.purity.split(',') : [];

  const renderFilterContent = () => (
    <div>
      {/* Price Range */}
      <FilterSection title="Price Range" badge={filters.minPrice || filters.maxPrice ? 1 : 0}>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRICE_PRESETS.map((preset) => {
            const active = (filters.minPrice || '') === preset.min && (filters.maxPrice || '') === preset.max;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPricePreset(preset)}
                aria-pressed={active}
                className={`font-jakarta px-2.5 py-1 rounded-full text-xs border transition-all duration-200 ${
                  active
                    ? 'bg-gold-500/15 border-gold-500/60 text-gold-300'
                    : 'border-white/10 text-dark-300 hover:border-gold-500/40 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="Min ₹"
            aria-label="Minimum price"
            value={minPrice}
            onChange={handleMinChange}
            className="input-dark !bg-dark-900/60 text-sm py-2 px-3 flex-1 min-w-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-dark-600 text-xs">–</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="Max ₹"
            aria-label="Maximum price"
            value={maxPrice}
            onChange={handleMaxChange}
            className="input-dark !bg-dark-900/60 text-sm py-2 px-3 flex-1 min-w-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
      </FilterSection>

      {/* Material */}
      <FilterSection title="Material" badge={filters.material ? 1 : 0}>
        {MATERIALS.map((m) => (
          <OptionRow key={m} label={m === 'Diamond' ? 'Diamond · soon' : m} selected={filters.material === m} onClick={() => handleChange('material', m)} />
        ))}
      </FilterSection>

      {/* Category */}
      {categories.length > 0 && (
        <FilterSection title="Category" badge={filters.category ? 1 : 0}>
          {categories.map((cat) => (
            <OptionRow key={cat._id} label={cat.name} selected={filters.category === cat._id} onClick={() => handleChange('category', cat._id)} />
          ))}
        </FilterSection>
      )}

      {/* Purity */}
      <FilterSection title="Purity" badge={currentPurities.length}>
        {PURITIES.map((purity) => (
          <OptionRow key={purity} multi label={purity} selected={currentPurities.includes(purity)} onClick={() => handlePurityChange(purity)} />
        ))}
      </FilterSection>
    </div>
  );

  const header = (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-jakarta text-white text-base font-semibold pt-0 leading-tight">
        <FiSliders size={15} className="text-gold-500" />
        Filters
        {activeCount > 0 && (
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-gold-500 text-dark-900 text-[11px] font-bold flex items-center justify-center">{activeCount}</span>
        )}
      </h2>
      {activeCount > 0 && (
        <button type="button" onClick={handleReset} className="font-jakarta text-xs text-dark-400 hover:text-gold-400 transition-colors">
          Clear all
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 xl:w-[17rem] flex-shrink-0">
        <div className="sticky top-24 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-dark-800 to-dark-900 shadow-card">
          <div className="px-5 pt-5 pb-3 border-b border-white/[0.07]">{header}</div>
          <div className="px-5 pb-2 max-h-[calc(100vh-11rem)] overflow-y-auto scrollbar-hide" data-lenis-prevent="true">
            {renderFilterContent()}
          </div>
        </div>
      </aside>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 lg:hidden"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="fixed inset-x-0 bottom-0 z-50 lg:hidden max-h-[85vh] flex flex-col rounded-t-3xl border-t border-gold-500/20 bg-dark-900 shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
            >
              <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15" aria-hidden="true" />
              <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-3 border-b border-white/[0.07]">
                <div className="flex-1">{header}</div>
                <button type="button" onClick={onMobileClose} aria-label="Close filters" className="p-1.5 -mr-1.5 rounded-full text-dark-400 hover:text-white hover:bg-white/5">
                  <FiX size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5" data-lenis-prevent="true">
                {renderFilterContent()}
              </div>
              <div className="px-5 py-3.5 border-t border-white/[0.07] bg-dark-900 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
                <button type="button" onClick={onMobileClose} className="btn-gold w-full py-3 text-sm">
                  {loading ? 'Updating…' : `Show ${pagination.total ?? 0} piece${pagination.total === 1 ? '' : 's'}`}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

FilterSidebar.propTypes = {
  mobileOpen: PropTypes.bool,
  onMobileClose: PropTypes.func,
};
