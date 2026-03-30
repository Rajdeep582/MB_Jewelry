import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

export const fetchProducts = createAsyncThunk('products/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const res = await api.get('/products', { params });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load products');
  }
});

export const fetchProduct = createAsyncThunk('products/fetchOne', async (id, { rejectWithValue }) => {
  try {
    const res = await api.get(`/products/${id}`);
    return res.data.product;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Product not found');
  }
});

export const fetchFeaturedProducts = createAsyncThunk('products/fetchFeatured', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/products', { params: { featured: true, limit: 8 } });
    return res.data.products;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

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
      state.filters = { search: '', category: '', material: '', type: '', minPrice: '', maxPrice: '', sort: '', page: 1 };
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
