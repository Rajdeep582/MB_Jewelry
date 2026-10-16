/**
 * Admin panel URLs — single source of truth.
 * The panel lives at an unlisted path (not "/admin") so it isn't reachable by guessing.
 * Note: "/api/admin/..." and "/api/admin-auth/..." backend endpoints are unrelated and must not change.
 */
export const ADMIN_BASE     = '/mbAdmin010203';
export const ADMIN_LOGIN    = `${ADMIN_BASE}/login`;
export const ADMIN_REGISTER = `${ADMIN_BASE}/register`;
