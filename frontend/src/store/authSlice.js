import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

// ─── Async Thunks ────────────────────────────────────────────────────────────

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

export const loginAdmin = createAsyncThunk('auth/loginAdmin', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/admin-auth/login', data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

export const registerAdmin = createAsyncThunk('auth/registerAdmin', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/admin-auth/register', data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Registration failed');
  }
});

export const loginDP = createAsyncThunk('auth/loginDP', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/dp-auth/login', data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Login failed');
  }
});

export const registerDP = createAsyncThunk('auth/registerDP', async (data, { rejectWithValue }) => {
  try {
    const res = await api.post('/dp-auth/register', data);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Registration failed');
  }
});

export const loginWithGoogle = createAsyncThunk('auth/google', async (idToken, { rejectWithValue }) => {
  try {
    const res = await api.post('/auth/google', { idToken });
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Google login failed');
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async (_, { getState, rejectWithValue }) => {
  try {
    const role = getState().auth.user?.role;
    const endpoint = role === 'admin' ? '/admin-auth/logout'
      : role === 'delivery' ? '/dp-auth/logout'
      : '/auth/logout';
    await api.post(endpoint);
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const fetchCurrentUser = createAsyncThunk('auth/me', async (_, { getState, rejectWithValue }) => {
  try {
    const role = getState().auth.user?.role;
    const endpoint = role === 'admin' ? '/admin-auth/me'
      : role === 'delivery' ? '/dp-auth/me'
      : '/auth/me';
    const res = await api.get(endpoint);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

export const refreshAccessToken = createAsyncThunk('auth/refresh', async (_, { getState, rejectWithValue }) => {
  try {
    const role = getState().auth.user?.role;
    const endpoint = role === 'admin' ? '/admin-auth/refresh'
      : role === 'delivery' ? '/dp-auth/refresh'
      : '/auth/refresh';
    const res = await api.post(endpoint);
    return res.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message);
  }
});

// ─── Helpers (single source of truth for localStorage) ───────────────────────

const USER_KEY = 'mb_user';

// Access token is NEVER persisted to localStorage (XSS risk).
// Only user metadata is stored for UI persistence across reloads.
// The real access token lives in Redux memory only; a silent /refresh
// call on first 401 restores it from the httpOnly refresh cookie.
const persistUser = (user) => {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Storage quota exceeded or private mode — silently ignore
  }
};

const clearAuth = () => {
  localStorage.removeItem(USER_KEY);
};

const loadUserFromStorage = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    localStorage.removeItem(USER_KEY);
  }
  return null;
};

const user = loadUserFromStorage();
const accessToken = null; // always null on page load; restored via silent refresh

// ─── Slice ───────────────────────────────────────────────────────────────────

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
    // Single place to set credentials — all success cases use this
    setCredentials: (state, { payload }) => {
      state.user = payload.user;
      state.accessToken = payload.accessToken;
      persistUser(payload.user);
    },
    clearCredentials: (state) => {
      state.user = null;
      state.accessToken = null;
      clearAuth();
    },
    // Update user profile only — does not touch accessToken
    setUser: (state, { payload }) => {
      state.user = payload;
      try { localStorage.setItem(USER_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
    },
    setInitialized: (state) => {
      state.initialized = true;
    },
  },
  extraReducers: (builder) => {
    const handlePending = (state) => { state.loading = true; state.error = null; };
    const handleRejected = (state, { payload }) => { state.loading = false; state.error = payload; };

    builder
      // Register
      .addCase(registerUser.pending, handlePending)
      .addCase(registerUser.fulfilled, (state) => {
        state.loading = false;
        // Do not auto-login or set tokens — user must verify email first.
      })
      .addCase(registerUser.rejected, handleRejected)

      // Login
      .addCase(loginUser.pending, handlePending)
      .addCase(loginUser.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.user = payload.user;
        state.accessToken = payload.accessToken;
        persistUser(payload.user);
      })
      .addCase(loginUser.rejected, handleRejected)

      // Admin Login
      .addCase(loginAdmin.pending, handlePending)
      .addCase(loginAdmin.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.user = payload.user;
        state.accessToken = payload.accessToken;
        persistUser(payload.user);
      })
      .addCase(loginAdmin.rejected, handleRejected)

      // Admin Register
      .addCase(registerAdmin.pending, handlePending)
      .addCase(registerAdmin.fulfilled, (state) => { state.loading = false; })
      .addCase(registerAdmin.rejected, handleRejected)

      // DP Login
      .addCase(loginDP.pending, handlePending)
      .addCase(loginDP.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.user = payload.user;
        state.accessToken = payload.accessToken;
        persistUser(payload.user);
      })
      .addCase(loginDP.rejected, handleRejected)

      // DP Register
      .addCase(registerDP.pending, handlePending)
      .addCase(registerDP.fulfilled, (state) => { state.loading = false; })
      .addCase(registerDP.rejected, handleRejected)

      // Google Login
      .addCase(loginWithGoogle.pending, handlePending)
      .addCase(loginWithGoogle.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.user = payload.user;
        state.accessToken = payload.accessToken;
        persistUser(payload.user);
      })
      .addCase(loginWithGoogle.rejected, handleRejected)

      // Logout — always clear regardless of server response
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        clearAuth();
      })
      .addCase(logoutUser.rejected, (state) => {
        // Server logout failed (maybe already expired), but clear client state anyway
        state.user = null;
        state.accessToken = null;
        clearAuth();
      })

      // Fetch current user
      .addCase(fetchCurrentUser.fulfilled, (state, { payload }) => {
        state.user = payload.user;
        state.initialized = true;
        try {
          localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
        } catch {
          // Storage quota — silently ignore
        }
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.initialized = true;
      })

      // Refresh token
      .addCase(refreshAccessToken.fulfilled, (state, { payload }) => {
        state.accessToken = payload.accessToken;
        state.initialized = true;
      })
      .addCase(refreshAccessToken.rejected, (state) => {
        // Refresh failed — session truly expired, force logout
        state.user = null;
        state.accessToken = null;
        state.initialized = true;
        clearAuth();
      });
  },
});

export const { clearError, setCredentials, clearCredentials, setUser, setInitialized } = authSlice.actions;

// ─── Selectors ───────────────────────────────────────────────────────────────
export const selectUser = (state) => state.auth.user;
export const selectToken = (state) => state.auth.accessToken;
export const selectInitialized = (state) => state.auth.initialized;
export const selectIsAuthenticated = (state) => !!state.auth.user && !!state.auth.accessToken;
export const selectIsAdmin    = (state) => state.auth.user?.role === 'admin';
export const selectIsDelivery = (state) => state.auth.user?.role === 'delivery';
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;

export default authSlice.reducer;
