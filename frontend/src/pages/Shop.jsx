import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiGrid, FiList, FiSearch, FiX, FiSliders, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useState, useRef } from 'react';
import { fetchProducts, selectProducts, selectProductsLoading, selectProductsPagination, selectProductsFilter, setFilters } from '../store/productSlice';
import ProductCard from '../components/shop/ProductCard';
import FilterSidebar from '../components/shop/FilterSidebar';
import { ProductCardSkeleton } from '../components/common/Skeletons';
import { debounce, formatPrice } from '../utils/helpers';
import { categoryService } from '../services/services';

const SORT_OPTIONS = [
  { value: '', label: 'Newest First' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Highest Rated' },
];

export default function Shop() {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const products = useSelector(selectProducts);
  const loading = useSelector(selectProductsLoading);
  const pagination = useSelector(selectProductsPagination);
  const filters = useSelector(selectProductsFilter);
  const [search, setSearch] = useState(filters.search || '');
  const [view, setView] = useState('grid');
  const location = useLocation();
  const searchInputRef = useRef(null);
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categories, setCategories] = useState([]);

  // Category names for the active-filter chips
  useEffect(() => {
    categoryService.getCategories().then((res) => setCategories(res.data.categories || [])).catch(() => {});
  }, []);

  // ── Diamond disabled: redirect /shop?material=Diamond → Coming Soon page ──
  useEffect(() => {
    if (searchParams.get('material') === 'Diamond') {
      navigate('/diamond-coming-soon', { replace: true });
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    if (location.state?.focusSearch && searchInputRef.current) {
      // Small timeout to ensure DOM is ready and scrolling is done
      setTimeout(() => {
        searchInputRef.current.focus();
        // Clear state so it doesn't refocus on re-renders
        window.history.replaceState({}, document.title);
      }, 100);
    }
  }, [location.state]);

  useEffect(() => {
    document.title = 'Shop — M.B. JEWELLERS';
    
    // Parse ALL possible filters from URL perfectly
    const newFilters = {
      category: searchParams.get('category') || '',
      material: searchParams.get('material') || '',
      search: searchParams.get('search') || '',
      purity: searchParams.get('purity') || '',
      minPrice: searchParams.get('minPrice') || '',
      maxPrice: searchParams.get('maxPrice') || '',
      sort: searchParams.get('sort') || '',
      page: Number(searchParams.get('page')) || 1,
    };
    
    // Only update local search input if it doesn't match the URL (e.g. external link or reset)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(newFilters.search);
    
    // Update Redux state and fetch products in one go to prevent race conditions
    dispatch(setFilters(newFilters));
    dispatch(fetchProducts(newFilters));
  }, [searchParams, dispatch]);

  const debouncedSearch = useMemo(
    () => debounce((val) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (val) next.set('search', val);
        else next.delete('search');
        next.set('page', '1');
        return next;
      });
    }, 400),
    [setSearchParams]
  );

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    debouncedSearch(e.target.value);
  };

  const handleSort = (e) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (e.target.value) next.set('sort', e.target.value);
      else next.delete('sort');
      next.set('page', '1');
      return next;
    });
  };

  const clearSearch = () => {
    setSearch('');
    debouncedSearch('');
    searchInputRef.current?.focus();
  };

  const updateParams = (mutate) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      mutate(next);
      next.delete('page');
      return next;
    });
  };

  // Active filters shown as removable chips above the grid
  const chips = [];
  if (filters.material) chips.push({ key: 'material', label: filters.material, remove: () => updateParams((n) => n.delete('material')) });
  if (filters.category) {
    const cat = categories.find((c) => c._id === filters.category);
    chips.push({ key: 'category', label: cat?.name || 'Category', remove: () => updateParams((n) => n.delete('category')) });
  }
  (filters.purity ? filters.purity.split(',').filter(Boolean) : []).forEach((pu) => {
    chips.push({
      key: `purity-${pu}`,
      label: pu,
      remove: () => updateParams((n) => {
        const rest = (n.get('purity') || '').split(',').filter((x) => x && x !== pu);
        if (rest.length) n.set('purity', rest.join(',')); else n.delete('purity');
      }),
    });
  });
  if (filters.minPrice || filters.maxPrice) {
    let label = `${formatPrice(Number(filters.minPrice || 0))} – ${formatPrice(Number(filters.maxPrice || 0))}`;
    if (!filters.maxPrice) label = `Above ${formatPrice(Number(filters.minPrice))}`;
    else if (!filters.minPrice) label = `Under ${formatPrice(Number(filters.maxPrice))}`;
    chips.push({ key: 'price', label, remove: () => updateParams((n) => { n.delete('minPrice'); n.delete('maxPrice'); }) });
  }
  const filterCount = chips.length;
  const clearFilters = () => setSearchParams((prev) => {
    const next = new URLSearchParams();
    if (prev.get('search')) next.set('search', prev.get('search'));
    if (prev.get('sort')) next.set('sort', prev.get('sort'));
    return next;
  });

  // Page heading follows the material in view (navbar Gold / Silver links)
  let heading = 'All Jewellery';
  let blurb = 'Handcrafted gold and silver pieces — hallmarked, certified and made to be treasured.';
  if (filters.material === 'Gold') {
    heading = 'Gold Collection';
    blurb = 'BIS-hallmarked 22K and 18K gold, crafted by hand in our workshop.';
  } else if (filters.material === 'Silver') {
    heading = 'Silver Collection';
    blurb = 'Hallmarked sterling and oxidised silver for every day and every occasion.';
  }

  const handlePage = (page) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', page);
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen pt-24 sm:pt-28 pb-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(212,175,55,0.08),transparent_70%)]" aria-hidden="true" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-7 sm:mb-9">
          <p className="font-jakarta text-[11px] font-semibold tracking-[0.3em] text-gold-500 uppercase mb-2">Discover</p>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold text-white leading-tight pt-0">{heading}</h1>
          <div className="flex items-center gap-3 mt-4" aria-hidden="true">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-gold-500/70" />
            <span className="w-1.5 h-1.5 rotate-45 bg-gold-400 shadow-[0_0_10px_rgba(212,175,55,0.7)]" />
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-gold-500/70" />
          </div>
          <p className="font-jakarta text-dark-400 text-sm mt-3 max-w-xl">{blurb}</p>
        </div>

        <div className="flex gap-6 xl:gap-8">
          {/* Sidebar */}
          <FilterSidebar mobileOpen={filtersOpen} onMobileClose={() => setFiltersOpen(false)} />

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Search Bar */}
            <div className="mb-4 relative group">
              <FiSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-500 group-focus-within:text-gold-400 transition-colors pointer-events-none" />
              <input
                id="shop-search"
                ref={searchInputRef}
                type="text"
                enterKeyHint="search"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search rings, necklaces, gold jewellery…"
                aria-label="Search products"
                className="input-dark w-full font-jakarta text-sm py-3.5 pl-11 pr-11"
              />
              {search && (
                <button type="button" onClick={clearSearch} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-dark-400 hover:text-white hover:bg-white/5 transition-colors">
                  <FiX size={14} />
                </button>
              )}
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="font-jakarta text-dark-400 text-sm whitespace-nowrap">
                {loading ? 'Loading…' : (
                  <><span className="text-white font-semibold">{pagination.total}</span> {pagination.total === 1 ? 'piece' : 'pieces'}</>
                )}
              </p>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Mobile: open filter sheet */}
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  className="lg:hidden inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-dark-800 px-3 py-2 font-jakarta text-sm text-dark-200 hover:border-gold-500/40 hover:text-white transition-colors"
                >
                  <FiSliders size={14} className="text-gold-500" />
                  Filters
                  {filterCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-gold-500 text-dark-900 text-[10px] font-bold flex items-center justify-center">{filterCount}</span>
                  )}
                </button>
                <label htmlFor="shop-sort" className="sr-only">Sort products</label>
                <select
                  id="shop-sort"
                  value={filters.sort}
                  onChange={handleSort}
                  className="input-dark font-jakarta text-sm py-2 pl-3 pr-8 w-auto min-w-0 max-w-[11rem] sm:max-w-none cursor-pointer"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <div className="hidden sm:flex items-center gap-0.5 rounded-xl border border-white/10 bg-dark-800 p-0.5">
                  <button
                    type="button"
                    onClick={() => setView('grid')}
                    aria-label="Grid view"
                    aria-pressed={view === 'grid'}
                    className={`p-2 rounded-lg transition-colors ${view === 'grid' ? 'bg-gold-500/15 text-gold-400' : 'text-dark-400 hover:text-white'}`}
                  >
                    <FiGrid size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    aria-label="List view"
                    aria-pressed={view === 'list'}
                    className={`p-2 rounded-lg transition-colors ${view === 'list' ? 'bg-gold-500/15 text-gold-400' : 'text-dark-400 hover:text-white'}`}
                  >
                    <FiList size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Active filter chips */}
            {filterCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-5">
                {chips.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={c.remove}
                    aria-label={`Remove filter ${c.label}`}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-gold-500/35 bg-gold-500/[0.08] pl-3 pr-2 py-1 font-jakarta text-xs font-medium text-gold-300 hover:border-gold-500/70 hover:bg-gold-500/15 transition-colors"
                  >
                    {c.label}
                    <FiX size={12} className="text-gold-500/70 group-hover:text-gold-300" />
                  </button>
                ))}
                <button type="button" onClick={clearFilters} className="font-jakarta text-xs text-dark-400 hover:text-gold-400 transition-colors ml-1">
                  Clear all
                </button>
              </div>
            )}

            {/* Product Grid */}
            {loading ? (
              <div className={`grid gap-3 sm:gap-5 ${view === 'grid' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
                {Array.from({ length: 9 }, (_, n) => n).map((n) => <ProductCardSkeleton key={n} />)}
              </div>
            ) : products.length === 0 ? (
              <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-dark-800 to-dark-900 text-center px-6 py-16 sm:py-20">
                <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-72 h-72 rounded-full bg-gold-500/[0.07] blur-3xl" />
                <div className="relative mx-auto mb-5 w-16 h-16 rounded-full border border-gold-500/30 bg-gold-500/[0.06] flex items-center justify-center">
                  <FiSearch size={24} className="text-gold-400" />
                </div>
                <h3 className="relative font-serif text-white text-2xl font-semibold mb-2">No pieces match</h3>
                <p className="relative font-jakarta text-dark-400 text-sm mb-6">Try a different search or remove a filter.</p>
                {(filterCount > 0 || search) && (
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setSearchParams(new URLSearchParams()); }}
                    className="relative btn-outline-gold text-sm py-2.5 px-6"
                  >
                    Clear search &amp; filters
                  </button>
                )}
              </div>
            ) : (
              <motion.div
                layout
                className={`grid gap-3 sm:gap-5 ${view === 'grid' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}
              >
                {products.map((product) => (
                  <ProductCard key={product._id} product={product} view={view} />
                ))}
              </motion.div>
            )}

            {/* Pagination */}
            {!loading && pagination.pages > 1 && (
              <div role="navigation" className="flex items-center justify-center gap-1.5 sm:gap-2 mt-12" aria-label="Pagination">
                <button
                  type="button"
                  onClick={() => handlePage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  aria-label="Previous page"
                  className="w-9 h-9 rounded-full flex items-center justify-center border border-white/10 text-dark-300 hover:border-gold-500/50 hover:text-gold-400 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <FiChevronLeft size={16} />
                </button>
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => handlePage(page)}
                    aria-current={page === pagination.page ? 'page' : undefined}
                    className={`w-9 h-9 rounded-full font-jakarta text-sm transition-all ${
                      page === pagination.page
                        ? 'bg-gold-500 text-dark-900 font-bold shadow-gold'
                        : 'border border-white/10 text-dark-300 hover:text-white hover:border-gold-500/40'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handlePage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  aria-label="Next page"
                  className="w-9 h-9 rounded-full flex items-center justify-center border border-white/10 text-dark-300 hover:border-gold-500/50 hover:text-gold-400 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <FiChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
