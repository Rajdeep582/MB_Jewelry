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

// Rejects with { message, status }. status 401/403 = session really over; 0 (network), 429 or 5xx
// = temporary problem (server restarting, offline) → the user must NOT be signed out for that.
// Call through refreshSession() in services/api.js so only one refresh is ever in flight.
export const refreshAccessToken = createAsyncThunk('auth/refresh', async (_, { getState, rejectWithValue }) => {
  try {
    const role = getState().auth.user?.role;
    const endpoint = role === 'admin' ? '/admin-auth/refresh'
      : role === 'delivery' ? '/dp-auth/refresh'
      : '/auth/refresh';
    const res = await api.post(endpoint);
    return res.data;
  } catch (err) {
    return rejectWithValue({ message: err.response?.data?.message, status: err.response?.status ?? 0 });
  }
});

const isSessionOver = (payload) => payload?.status === 401 || payload?.status === 403;

// ─── Helpers (single source of truth for localStorage) ───────────────────────

// One key per portal (customer / admin / delivery), matching the per-portal refresh cookies,
// so signing in to the admin panel in another tab never replaces the shop's signed-in user.
const STORAGE_KEYS = { user: 'mb_user', admin: 'mb_admin_user', delivery: 'mb_dp_user' };
const portalOf = (role) => (role === 'admin' || role === 'delivery' ? role : 'user');
const keyFor = (role) => STORAGE_KEYS[portalOf(role)];
const portalFromPath = () => {
  const path = typeof window === 'undefined' ? '/' : window.location.pathname;
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/delivery')) return 'delivery';
  return 'user';
};

// Access token is NEVER persisted to localStorage (XSS risk).
// Only user metadata is stored for UI persistence across reloads.
// The real access token lives in Redux memory only; a silent /refresh
// call on page load restores it from the httpOnly refresh cookie.
const persistUser = (user) => {
  if (!user) return;
  try {
    localStorage.setItem(keyFor(user.role), JSON.stringify(user));
  } catch {
    // Storage quota exceeded or private mode — silently ignore
  }
};

const clearAuth = (role) => {
  try { localStorage.removeItem(keyFor(role)); } catch { /* ignore */ }
};

const readKey = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return null;
  }
};

const loadUserFromStorage = () => {
  const portal = portalFromPath();
  let stored = readKey(STORAGE_KEYS[portal]);
  if (stored && portalOf(stored.role) !== portal) stored = null;
  // Migrate admin/delivery users saved under the old shared 'mb_user' key
  if (!stored && portal !== 'user') {
    const legacy = readKey(STORAGE_KEYS.user);
    if (legacy && portalOf(legacy.role) === portal) {
      stored = legacy;
      persistUser(legacy);
      try { localStorage.removeItem(STORAGE_KEYS.user); } catch { /* ignore */ }
    }
  }
  return stored;
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
      clearAuth(state.user?.role);
      state.user = null;
      state.accessToken = null;
    },
    // Update user profile only — does not touch accessToken
    setUser: (state, { payload }) => {
      state.user = payload;
      persistUser(payload);
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
        clearAuth(state.user?.role);
        state.user = null;
        state.accessToken = null;
      })
      .addCase(logoutUser.rejected, (state) => {
        // Server logout failed (maybe already expired), but clear client state anyway
        clearAuth(state.user?.role);
        state.user = null;
        state.accessToken = null;
      })

      // Fetch current user
      .addCase(fetchCurrentUser.fulfilled, (state, { payload }) => {
        state.user = payload.user;
        state.initialized = true;
        persistUser(payload.user);
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.initialized = true;
      })

      // Refresh token
      .addCase(refreshAccessToken.fulfilled, (state, { payload }) => {
        state.accessToken = payload.accessToken;
        state.initialized = true;
      })
      .addCase(refreshAccessToken.rejected, (state, { payload }) => {
        // Only a definite auth failure ends the session. A network error / server restart / 429
        // keeps the user signed in (the app retries); signing out there caused random logouts.
        if (!isSessionOver(payload)) return;
        clearAuth(state.user?.role);
        state.user = null;
        state.accessToken = null;
        state.initialized = true;
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
