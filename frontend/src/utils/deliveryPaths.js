/**
 * Delivery-partner portal URLs — single source of truth.
 * The portal lives at an unlisted path (not "/delivery") so it isn't reachable by guessing.
 * Note: "/api/delivery/..." backend endpoints are unrelated and must not change.
 */
export const DELIVERY_BASE     = '/deliveryPartner010203';
export const DELIVERY_LOGIN    = `${DELIVERY_BASE}/login`;
export const DELIVERY_REGISTER = `${DELIVERY_BASE}/register`;
