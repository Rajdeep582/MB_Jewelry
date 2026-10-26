/**
 * Admin panel URLs — single source of truth.
 * The panel lives at an unlisted path (not "/admin") so it isn't reachable by guessing.
 * Set VITE_ADMIN_PATH (Netlify env) to change it — e.g. if the URL ever leaks — then redeploy.
 * Format: "/" + 6–64 letters, digits, "-" or "_". Missing/invalid → the default below.
 * Note: "/api/admin/..." and "/api/admin-auth/..." backend endpoints are unrelated and must not change.
 */
const DEFAULT_ADMIN_BASE = '/mbAdmin010203';
const SECRET_PATH = /^\/[A-Za-z0-9_-]{6,64}$/;

const fromEnv = (import.meta.env.VITE_ADMIN_PATH || '').trim().replace(/\/+$/, '');

export const ADMIN_BASE     = SECRET_PATH.test(fromEnv) ? fromEnv : DEFAULT_ADMIN_BASE;
export const ADMIN_LOGIN    = `${ADMIN_BASE}/login`;
export const ADMIN_REGISTER = `${ADMIN_BASE}/register`;
