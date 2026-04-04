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

export const logoutUser = createAsyncThunk('auth/logout', async (_, { rejectWithValue }) => {
  try {
    await api.post('/auth/logout');
  } catch (err) {
    // Even if server logout fails, we still clear client state
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

// ─── Helpers (single source of truth for localStorage) ───────────────────────

const STORAGE_KEYS = {
  token: 'mb_access_token',
  user: 'mb_user',
};

const persistAuth = (accessToken, user) => {
  try {
    localStorage.setItem(STORAGE_KEYS.token, accessToken);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  } catch (e) {
    // Storage quota exceeded or private mode — silently ignore
  }
};

const clearAuth = () => {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
};

const loadAuthFromStorage = () => {
  try {
    const token = localStorage.getItem(STORAGE_KEYS.token);
    const user = localStorage.getItem(STORAGE_KEYS.user);
    if (token && user) return { accessToken: token, user: JSON.parse(user) };
  } catch (e) {
    // Corrupt storage — clear it
    clearAuth();
  }
  return { accessToken: null, user: null };
};

const { accessToken, user } = loadAuthFromStorage();

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
      persistAuth(payload.accessToken, payload.user);
    },
    clearCredentials: (state) => {
      state.user = null;
      state.accessToken = null;
      clearAuth();
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
        persistAuth(payload.accessToken, payload.user);
      })
      .addCase(registerUser.rejected, handleRejected)

      // Login
      .addCase(loginUser.pending, handlePending)
      .addCase(loginUser.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.user = payload.user;
        state.accessToken = payload.accessToken;
        persistAuth(payload.accessToken, payload.user);
      })
      .addCase(loginUser.rejected, handleRejected)

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
          localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(payload.user));
        } catch (e) {}
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.initialized = true;
      })

      // Refresh token
      .addCase(refreshAccessToken.fulfilled, (state, { payload }) => {
        state.accessToken = payload.accessToken;
        try {
          localStorage.setItem(STORAGE_KEYS.token, payload.accessToken);
        } catch (e) {}
      })
      .addCase(refreshAccessToken.rejected, (state) => {
        // Refresh failed — session truly expired, force logout
        state.user = null;
        state.accessToken = null;
        clearAuth();
      });
  },
});

export const { clearError, setCredentials, clearCredentials } = authSlice.actions;

// ─── Selectors ───────────────────────────────────────────────────────────────
export const selectUser = (state) => state.auth.user;
export const selectToken = (state) => state.auth.accessToken;
export const selectIsAuthenticated = (state) => !!state.auth.user && !!state.auth.accessToken;
export const selectIsAdmin = (state) => state.auth.user?.role === 'admin';
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;

export default authSlice.reducer;
