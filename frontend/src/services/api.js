import axios from 'axios';
import { store } from '../store/store';
import { clearCredentials, refreshAccessToken } from '../store/authSlice';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
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

// Request interceptor — attach access token + CSRF token
api.interceptors.request.use(
  (config) => {
    // 1. Attach JWT access token
    const token = store.getState().auth.accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 2. Attach CSRF token for every state-mutating request (POST, PUT, DELETE, PATCH)
    //    The backend's validateCsrf middleware requires the cookie value to be echoed
    //    back in the x-csrf-token header (Double Submit Cookie pattern).
    const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
    if (!SAFE_METHODS.includes((config.method || 'GET').toUpperCase())) {
      const csrfToken = getCookie('csrfToken');
      if (csrfToken) {
        config.headers['x-csrf-token'] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 and refresh token
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

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
        await axios.get(
          (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') + '/health',
          { withCredentials: true }
        );
        // Re-read the now-seeded cookie and inject it
        const freshCsrf = getCookie('csrfToken');
        if (freshCsrf) {
          originalRequest.headers['x-csrf-token'] = freshCsrf;
        }
        return api(originalRequest);
      } catch {
        // Seed failed — fall through and reject normally
      }
    }

    // ── JWT access token expired: attempt silent refresh ──────────────────
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const result = await store.dispatch(refreshAccessToken());
        const newToken = result.payload?.accessToken;

        if (!newToken) throw new Error('Refresh failed');

        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        store.dispatch(clearCredentials());
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
