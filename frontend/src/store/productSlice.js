import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import DEMO_PRODUCTS from '../data/demoProducts';
import api from '../services/api';

export const fetchProducts = createAsyncThunk('products/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const res = await api.get('/products', { params });
    // If API returns products use them, otherwise fall back to demo data
    if (res.data?.products?.length > 0) return res.data;
    // Fallback: filter + paginate demo products locally
    return buildDemoPage(params);
  } catch {
    return buildDemoPage(params);
  }
});

export const fetchProduct = createAsyncThunk('products/fetchOne', async (id, { rejectWithValue }) => {
  try {
    const res = await api.get(`/products/${id}`);
    return res.data.product;
  } catch {
    // Fall back to local demo data
    const demo = DEMO_PRODUCTS.find((p) => p._id === id);
    if (demo) return demo;
    return rejectWithValue('Product not found');
  }
});

export const fetchFeaturedProducts = createAsyncThunk('products/fetchFeatured', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/products', { params: { featured: true, limit: 8 } });
    if (res.data?.products?.length > 0) return res.data.products;
    return DEMO_PRODUCTS.filter((p) => p.featured).slice(0, 8);
  } catch {
    return DEMO_PRODUCTS.filter((p) => p.featured).slice(0, 8);
  }
});

// ── Helper: filter & paginate DEMO_PRODUCTS locally ──────────────────────
function buildDemoPage(params = {}) {
  const { 
    search = '', category = '', material = '', type = '', 
    minPrice = '', maxPrice = '', sort = '', page = 1, limit = 12,
    purity = '', isHallmarked = ''
  } = params;
  let list = [...DEMO_PRODUCTS];

  if (search) {
    const q = search.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q) || p.material.toLowerCase().includes(q));
  }
  if (material) list = list.filter((p) => p.material.toLowerCase() === material.toLowerCase());
  if (type)     list = list.filter((p) => p.type.toLowerCase() === type.toLowerCase());
  if (minPrice) list = list.filter((p) => (p.discountedPrice || p.price) >= Number(minPrice));
  if (maxPrice) list = list.filter((p) => (p.discountedPrice || p.price) <= Number(maxPrice));
  
  if (purity) {
    const purities = purity.split(',').map(p => p.trim());
    list = list.filter(p => purities.includes(p.purity));
  }
  if (isHallmarked === 'true') {
    list = list.filter(p => p.isHallmarked === true);
  }

  if (sort === 'price-asc')  list.sort((a, b) => (a.discountedPrice || a.price) - (b.discountedPrice || b.price));
  if (sort === 'price-desc') list.sort((a, b) => (b.discountedPrice || b.price) - (a.discountedPrice || a.price));
  if (sort === 'rating')     list.sort((a, b) => b.averageRating - a.averageRating);
  if (sort === 'popular')    list.sort((a, b) => b.numReviews - a.numReviews);

  const total = list.length;
  const lim = Number(limit) || 12;
  const pages = Math.max(1, Math.ceil(total / lim));
  const p = Math.min(Number(page) || 1, pages);
  const products = list.slice((p - 1) * lim, p * lim);

  return { products, pagination: { total, page: p, pages, limit: lim } };
}

const productSlice = createSlice({
  name: 'products',
  initialState: {
    items: [],
    featured: [],
    current: null,
    pagination: { total: 0, page: 1, pages: 1, limit: 12 },
    filters: {
      search: '',
      category: '',
      material: '',
      type: '',
      purity: '',
      isHallmarked: '',
      minPrice: '',
      maxPrice: '',
      sort: '',
      page: 1,
    },
    loading: false,
    currentLoading: false,
    error: null,
  },
  reducers: {
    setFilters: (state, { payload }) => {
      state.filters = { ...state.filters, ...payload, page: payload.page || 1 };
    },
    resetFilters: (state) => {
      state.filters = { search: '', category: '', material: '', type: '', purity: '', isHallmarked: '', minPrice: '', maxPrice: '', sort: '', page: 1 };
    },
    clearCurrentProduct: (state) => {
      state.current = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchProducts.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.items = payload.products;
        state.pagination = payload.pagination;
      })
      .addCase(fetchProducts.rejected, (state, { payload }) => { state.loading = false; state.error = payload; })

      .addCase(fetchProduct.pending, (state) => { state.currentLoading = true; state.error = null; })
      .addCase(fetchProduct.fulfilled, (state, { payload }) => { state.currentLoading = false; state.current = payload; })
      .addCase(fetchProduct.rejected, (state, { payload }) => { state.currentLoading = false; state.error = payload; })

      .addCase(fetchFeaturedProducts.fulfilled, (state, { payload }) => { state.featured = payload; });
  },
});

export const { setFilters, resetFilters, clearCurrentProduct } = productSlice.actions;

export const selectProducts = (state) => state.products.items;
export const selectFeaturedProducts = (state) => state.products.featured;
export const selectCurrentProduct = (state) => state.products.current;
export const selectProductsPagination = (state) => state.products.pagination;
export const selectProductsFilter = (state) => state.products.filters;
export const selectProductsLoading = (state) => state.products.loading;

export default productSlice.reducer;
