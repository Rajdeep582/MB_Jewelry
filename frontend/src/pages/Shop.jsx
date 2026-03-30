import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiGrid, FiList } from 'react-icons/fi';
import { useState } from 'react';
import { fetchProducts, selectProducts, selectProductsLoading, selectProductsPagination, selectProductsFilter, setFilters } from '../store/productSlice';
import ProductCard from '../components/shop/ProductCard';
import FilterSidebar from '../components/shop/FilterSidebar';
import { ProductCardSkeleton } from '../components/common/Skeletons';
import { debounce } from '../utils/helpers';

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

  useEffect(() => {
    document.title = 'Shop — M&B Jewelry';
    // Read URL params
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    if (type) dispatch(setFilters({ type }));
    if (category) dispatch(setFilters({ category }));
  }, []);

  useEffect(() => {
    dispatch(fetchProducts(filters));
  }, [dispatch, filters]);

  const debouncedSearch = useCallback(
    debounce((val) => dispatch(setFilters({ search: val })), 400),
    []
  );

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    debouncedSearch(e.target.value);
  };

  const handleSort = (e) => dispatch(setFilters({ sort: e.target.value }));
  const handlePage = (page) => {
    dispatch(setFilters({ page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <p className="section-subtitle mb-2">Discover</p>
          <h1 className="section-title">Our Jewelry Shop</h1>
          <div className="gold-divider mt-3 mx-0" />
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <input
            id="shop-search"
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search rings, necklaces, gold jewelry..."
            className="input-dark max-w-xl text-sm"
          />
        </div>

        <div className="flex gap-6 lg:gap-8">
          {/* Sidebar */}
          <FilterSidebar />

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <p className="text-dark-400 text-sm">
                {loading ? '...' : `${pagination.total} pieces found`}
              </p>
              <div className="flex items-center gap-3">
                <select
                  value={filters.sort}
                  onChange={handleSort}
                  className="input-dark text-sm py-2 w-auto pr-8"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <div className="hidden sm:flex gap-1">
                  <button
                    onClick={() => setView('grid')}
                    className={`p-2 rounded-lg transition-colors ${view === 'grid' ? 'bg-gold-500/15 text-gold-400' : 'text-dark-400 hover:text-white'}`}
                  >
                    <FiGrid size={16} />
                  </button>
                  <button
                    onClick={() => setView('list')}
                    className={`p-2 rounded-lg transition-colors ${view === 'list' ? 'bg-gold-500/15 text-gold-400' : 'text-dark-400 hover:text-white'}`}
                  >
                    <FiList size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Product Grid */}
            {loading ? (
              <div className={`grid gap-5 ${view === 'grid' ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
                {Array.from({ length: 9 }).map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-24">
                <div className="text-6xl mb-4">💍</div>
                <h3 className="text-white text-xl font-display mb-2">No products found</h3>
                <p className="text-dark-400 text-sm">Try adjusting your filters or search term</p>
              </div>
            ) : (
              <motion.div
                layout
                className={`grid gap-5 ${view === 'grid' ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}
              >
                {products.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </motion.div>
            )}

            {/* Pagination */}
            {!loading && pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePage(page)}
                    className={`w-9 h-9 rounded-lg text-sm transition-all ${
                      page === pagination.page
                        ? 'bg-gold-500 text-dark-900 font-bold'
                        : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700 border border-white/10'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
