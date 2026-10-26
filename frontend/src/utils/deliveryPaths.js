/**
 * Delivery-partner portal URLs — single source of truth.
 * The portal lives at an unlisted path (not "/delivery") so it isn't reachable by guessing.
 * Set VITE_DELIVERY_PATH (Netlify env) to change it — e.g. if the URL ever leaks — then redeploy.
 * Format: "/" + 6–64 letters, digits, "-" or "_". Missing/invalid → the default below.
 * Note: "/api/delivery/..." backend endpoints are unrelated and must not change.
 */
const DEFAULT_DELIVERY_BASE = '/deliveryPartner010203';
const SECRET_PATH = /^\/[A-Za-z0-9_-]{6,64}$/;

const fromEnv = (import.meta.env.VITE_DELIVERY_PATH || '').trim().replace(/\/+$/, '');

export const DELIVERY_BASE     = SECRET_PATH.test(fromEnv) ? fromEnv : DEFAULT_DELIVERY_BASE;
export const DELIVERY_LOGIN    = `${DELIVERY_BASE}/login`;
export const DELIVERY_REGISTER = `${DELIVERY_BASE}/register`;
