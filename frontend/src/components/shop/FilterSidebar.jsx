import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { FiFilter, FiX, FiChevronDown } from 'react-icons/fi';
import { setFilters, resetFilters, selectProductsFilter } from '../../store/productSlice';
import { categoryService } from '../../services/services';
import { debounce } from '../../utils/helpers';

const MATERIALS = ['Gold', 'Silver', 'Platinum', 'Rose Gold', 'Diamond', 'Gemstone', 'Mixed'];
const TYPES = ['Ring', 'Necklace', 'Earrings', 'Bracelet', 'Pendant', 'Anklet', 'Bangle', 'Brooch', 'Set'];

function FilterSection({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-white/10 py-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="text-sm font-semibold text-white uppercase tracking-wider">{title}</span>
        <FiChevronDown
          size={14}
          className={`text-dark-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
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
            <div className="mt-3 space-y-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FilterSidebar() {
  const dispatch = useDispatch();
  const filters = useSelector(selectProductsFilter);
  const [categories, setCategories] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [minPrice, setMinPrice] = useState(filters.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice || '');

  useEffect(() => {
    categoryService.getCategories().then((res) => setCategories(res.data.categories));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMinPrice(filters.minPrice || '');
     
    setMaxPrice(filters.maxPrice || '');
  }, [filters.minPrice, filters.maxPrice]);

  const handleChange = (key, value) => {
    dispatch(setFilters({ [key]: filters[key] === value ? '' : value }));
  };

  const debouncedPriceChange = useMemo(
    () => debounce((key, val) => {
      dispatch(setFilters({ [key]: val }));
    }, 600),
    [dispatch]
  );

  const handleMinChange = (e) => {
    setMinPrice(e.target.value);
    debouncedPriceChange('minPrice', e.target.value);
  };

  const handleMaxChange = (e) => {
    setMaxPrice(e.target.value);
    debouncedPriceChange('maxPrice', e.target.value);
  };

  const handleReset = () => {
    dispatch(resetFilters());
  };

  const renderFilterContent = () => (
    <div>
      {/* Price Range */}
      <FilterSection title="Price Range">
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min ₹"
            value={minPrice}
            onChange={handleMinChange}
            className="input-dark text-sm py-2 flex-1"
          />
          <input
            type="number"
            placeholder="Max ₹"
            value={maxPrice}
            onChange={handleMaxChange}
            className="input-dark text-sm py-2 flex-1"
          />
        </div>
      </FilterSection>

      {/* Category */}
      <FilterSection title="Category">
        {categories.map((cat) => (
          <button
            key={cat._id}
            onClick={() => handleChange('category', cat._id)}
            className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${
              filters.category === cat._id
                ? 'text-gold-400 bg-gold-500/10'
                : 'text-dark-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className={`w-3 h-3 rounded-full border flex-shrink-0 transition-all ${
              filters.category === cat._id
                ? 'bg-gold-500 border-gold-500'
                : 'border-dark-500'
            }`} />
            {cat.name}
          </button>
        ))}
      </FilterSection>

      {/* Material */}
      <FilterSection title="Material">
        {MATERIALS.map((m) => (
          <button
            key={m}
            onClick={() => handleChange('material', m)}
            className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${
              filters.material === m
                ? 'text-gold-400 bg-gold-500/10'
                : 'text-dark-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className={`w-3 h-3 rounded-full border flex-shrink-0 transition-all ${
              filters.material === m ? 'bg-gold-500 border-gold-500' : 'border-dark-500'
            }`} />
            {m}
          </button>
        ))}
      </FilterSection>

      {/* Purity & Hallmark */}
      <FilterSection title="Purity & Assurance">
        <div className="space-y-2">
          {['24K', '22K'].map((purity) => {
            const currentPurities = filters.purity ? filters.purity.split(',') : [];
            const isChecked = currentPurities.includes(purity);
            // Highlight commonly searched purities if the material matches
            const highlight = (filters.material === 'Gold' && (purity === '22K' || purity === '24K'));

            return (
              <label 
                key={purity} 
                className="flex items-center gap-2 cursor-pointer w-fit group"
                onClick={(e) => {
                  e.preventDefault(); // prevent double fires if wrapping an input
                  // Toggle logic for comma-separated string
                  let newPurities = [...currentPurities];
                  if (isChecked) {
                    newPurities = newPurities.filter(p => p !== purity);
                  } else {
                    newPurities.push(purity);
                  }
                  dispatch(setFilters({ purity: newPurities.join(',') }));
                }}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                  isChecked ? 'bg-gold-500 border-gold-500' : 'border-dark-500 group-hover:border-white/50 bg-dark-900'
                }`}>
                  {isChecked && <svg className="w-3 h-3 text-dark-900" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className={`text-sm transition-colors ${isChecked ? 'text-white' : (highlight ? 'text-gold-200' : 'text-dark-400')} group-hover:text-white`}>
                  {purity}
                </span>
              </label>
            );
          })}

          <div className="pt-2 mt-2 border-t border-white/5">
            <label 
              className="flex items-center justify-between cursor-pointer w-full group"
              onClick={(e) => {
                e.preventDefault();
                dispatch(setFilters({ isHallmarked: filters.isHallmarked === 'true' ? '' : 'true' }));
              }}
            >
              <span className={`text-sm transition-colors ${filters.isHallmarked === 'true' ? 'text-white font-medium' : 'text-dark-400'} group-hover:text-white`}>
                BIS Hallmarked
              </span>
              <div className={`w-8 h-4 rounded-full flex items-center px-0.5 transition-colors ${
                filters.isHallmarked === 'true' ? 'bg-gold-500' : 'bg-dark-600'
              }`}>
                <div className={`w-3 h-3 rounded-full bg-white transition-transform ${filters.isHallmarked === 'true' ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </label>
          </div>
        </div>
      </FilterSection>

      {/* Type */}
      <FilterSection title="Type">
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => handleChange('type', t)}
              className={`px-3 py-1 rounded-full text-xs transition-all border ${
                filters.type === t
                  ? 'bg-gold-500/15 border-gold-500/50 text-gold-400'
                  : 'border-white/10 text-dark-400 hover:border-white/30 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Reset */}
      <button
        onClick={handleReset}
        className="mt-4 text-sm text-dark-400 hover:text-red-400 flex items-center gap-1.5 transition-colors"
      >
        <FiX size={14} /> Clear all filters
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="card p-5 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-white text-lg">Filters</h2>
            <FiFilter size={16} className="text-gold-500" />
          </div>
          {renderFilterContent()}
        </div>
      </aside>

      {/* Mobile Filter Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30 btn-gold shadow-gold-lg flex items-center gap-2 text-sm"
      >
        <FiFilter size={14} /> Filters
      </button>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-80 z-50 glass overflow-y-auto p-5 lg:hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-white text-lg">Filters</h2>
                <button onClick={() => setMobileOpen(false)} className="p-1 text-dark-400 hover:text-white">
                  <FiX size={20} />
                </button>
              </div>
              {renderFilterContent()}
              <button
                onClick={() => setMobileOpen(false)}
                className="btn-gold w-full mt-6"
              >
                Apply Filters
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
