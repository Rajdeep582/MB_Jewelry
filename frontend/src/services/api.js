import axios from 'axios';
import { store } from '../store/store';
import { refreshAccessToken } from '../store/authSlice';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // send cookies (refresh token)
  timeout: 15000,
});

/**
 * Read a cookie value by name from document.cookie.
 * The backend sets csrfToken with httpOnly:false so the browser can read it here.
 */
const getCookie = (name) => {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
};

// CSRF token echoed by the API in the X-CSRF-Token response header. In production the API
// is on another domain, so its cookie is invisible to document.cookie — this copy is what
// gets sent back. (Same-origin/dev setups can still read the cookie.)
let csrfTokenMem = null;
const rememberCsrf = (headers) => {
  const t = headers?.['x-csrf-token'];
  if (t) csrfTokenMem = t;
};
const currentCsrf = () => csrfTokenMem || getCookie('csrfToken');

// Public auth endpoints never need (or trigger) a token refresh.
const NO_REFRESH_URL = /\/(refresh|login|register|google|verify-otp|resend-otp|forgot-password|verify-reset-otp|reset-password)(\?|$)/;
const isAuthFailure = (status) => status === 401 || status === 403;

// ─── Session refresh (single-flight) ─────────────────────────────────────────
// Every caller — page load, an expiring token, a 401 — shares ONE in-flight refresh request.
// Refresh tokens are single-use, so two parallel refreshes from the same tab must never happen.
let refreshPromise = null;

/**
 * refreshSession — resolves with a fresh access token.
 * Rejects with err.status = 401/403 when the session is really over (the auth slice has then
 * already signed the user out), or err.status = 0/5xx/429 for a temporary failure (server
 * restarting, network drop) — in that case the user stays signed in and the next call retries.
 */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = store.dispatch(refreshAccessToken())
      .then((action) => {
        if (refreshAccessToken.fulfilled.match(action)) return action.payload.accessToken;
        const err = new Error(action.payload?.message || 'Session refresh failed');
        err.status = action.payload?.status ?? 0;
        throw err;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

/** True when the JWT expires within `skewMs` (decoded locally, signature not needed). */
const expiresSoon = (token, skewMs = 30000) => {
  try {
    const part = token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
    const { exp } = JSON.parse(atob(part));
    return typeof exp === 'number' && exp * 1000 - Date.now() < skewMs;
  } catch {
    return false;
  }
};

// Request interceptor — attach access token (refreshing it first if about to expire) + CSRF token
api.interceptors.request.use(
  async (config) => {
    // 1. Attach JWT access token. Refreshing *before* it expires avoids a 401 in the middle of
    //    a large upload (e.g. custom-order photos), which the browser can surface as a network error.
    let token = store.getState().auth.accessToken;
    if (token && !NO_REFRESH_URL.test(config.url || '') && expiresSoon(token)) {
      try {
        token = await refreshSession();
      } catch {
        token = store.getState().auth.accessToken; // temporary failure → try with what we have
      }
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 2. Attach CSRF token for every state-mutating request (POST, PUT, DELETE, PATCH)
    //    The backend's validateCsrf middleware requires the cookie value to be echoed
    //    back in the x-csrf-token header (Double Submit Cookie pattern).
    const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
    if (!SAFE_METHODS.includes((config.method || 'GET').toUpperCase())) {
      const csrfToken = currentCsrf();
      if (csrfToken) {
        config.headers['x-csrf-token'] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — CSRF seeding + silent refresh on 401
api.interceptors.response.use(
  (response) => { rememberCsrf(response.headers); return response; },
  async (error) => {
    rememberCsrf(error.response?.headers);
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    // ── CSRF auto-seed: if the cookie was not yet set (e.g. first page load),
    //    the backend returns 403 "Invalid or missing CSRF token".
    //    Fix: hit GET /health to seed the cookie, then retry the original request once.
    if (
      error.response?.status === 403 &&
      error.response?.data?.message === 'Invalid or missing CSRF token' &&
      !originalRequest._csrfRetry
    ) {
      originalRequest._csrfRetry = true;
      try {
        // Any GET to the backend triggers attachCsrfCookie middleware
        const seed = await axios.get(`${API_URL}/health`, { withCredentials: true });
        rememberCsrf(seed.headers);
        // Re-read the now-seeded token and inject it
        const freshCsrf = currentCsrf();
        if (freshCsrf) {
          originalRequest.headers['x-csrf-token'] = freshCsrf;
        }
        return api(originalRequest);
      } catch {
        // Seed failed — fall through and reject normally
      }
    }

    // ── JWT access token expired: refresh once, then retry the original request ──
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !NO_REFRESH_URL.test(originalRequest.url || '') &&
      store.getState().auth.user
    ) {
      originalRequest._retry = true;
      try {
        const newToken = await refreshSession();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        // Session over → the auth slice already signed the user out.
        // Temporary failure → the user stays signed in; the caller shows its own error.
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export { isAuthFailure };
export default api;
