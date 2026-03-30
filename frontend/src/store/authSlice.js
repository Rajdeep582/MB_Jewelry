import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

// Async thunks
export const registerUser = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/register', data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Registration failed');
  }
});

export const loginUser = createAsyncThunk('auth/login', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/login', data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await api.post('/auth/logout');
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const fetchCurrentUser = createAsyncThunk('auth/me', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/auth/me');
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const refreshAccessToken = createAsyncThunk('auth/refresh', async (_, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/refresh');
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

// Load persisted auth from localStorage
const loadAuthFromStorage = () => {
  try {
    const token = localStorage.getItem('mb_access_token');
    const user = localStorage.getItem('mb_user');
    if (token && user) return { accessToken: token, user: JSON.parse(user) };
  } catch (e) {}
  return { accessToken: null, user: null };
};

const { accessToken, user } = loadAuthFromStorage();

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user,
    accessToken,
    loading: false,
    error: null,
    initialized: false,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCredentials: (state, { payload }) => {
      state.user = payload.user;
      state.accessToken = payload.accessToken;
      localStorage.setItem('mb_access_token', payload.accessToken);
      localStorage.setItem('mb_user', JSON.stringify(payload.user));
    },
    clearCredentials: (state) => {
      state.user = null;
      state.accessToken = null;
      localStorage.removeItem('mb_access_token');
      localStorage.removeItem('mb_user');
    },
  },
  extraReducers: (builder) => {
    const handlePending = (state) => { state.loading = true; state.error = null; };
    const handleRejected = (state, { payload }) => { state.loading = false; state.error = payload; };

    builder
      // Register
      .addCase(registerUser.pending, handlePending)
      .addCase(registerUser.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.user = payload.user;
        state.accessToken = payload.accessToken;
        localStorage.setItem('mb_access_token', payload.accessToken);
        localStorage.setItem('mb_user', JSON.stringify(payload.user));
      })
      .addCase(registerUser.rejected, handleRejected)
      // Login
      .addCase(loginUser.pending, handlePending)
      .addCase(loginUser.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.user = payload.user;
        state.accessToken = payload.accessToken;
        localStorage.setItem('mb_access_token', payload.accessToken);
        localStorage.setItem('mb_user', JSON.stringify(payload.user));
      })
      .addCase(loginUser.rejected, handleRejected)
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        localStorage.removeItem('mb_access_token');
        localStorage.removeItem('mb_user');
      })
      // Fetch current user
      .addCase(fetchCurrentUser.fulfilled, (state, { payload }) => {
        state.user = payload.user;
        state.initialized = true;
        localStorage.setItem('mb_user', JSON.stringify(payload.user));
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.initialized = true;
      })
      // Refresh token
      .addCase(refreshAccessToken.fulfilled, (state, { payload }) => {
        state.accessToken = payload.accessToken;
        localStorage.setItem('mb_access_token', payload.accessToken);
      });
  },
});

export const { clearError, setCredentials, clearCredentials } = authSlice.actions;

// Selectors
export const selectUser = (state) => state.auth.user;
export const selectToken = (state) => state.auth.accessToken;
export const selectIsAuthenticated = (state) => !!state.auth.user && !!state.auth.accessToken;
export const selectIsAdmin = (state) => state.auth.user?.role === 'admin';
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;

export default authSlice.reducer;
