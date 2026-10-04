/**
 * shippingRates.js — PIN-code → delivery area → shipping charge (₹).
 *
 * SINGLE SOURCE OF TRUTH for shipping. The backend uses this mapping to price every
 * order; the frontend only displays what the backend returns.
 *
 * To add a new delivery area or change a charge, edit SHIPPING_ZONES below.
 * Charges are whole rupees. A PIN code that is not listed is NOT deliverable —
 * there is deliberately no default/fallback charge.
 */

const SHIPPING_ZONES = Object.freeze({
  '700131': Object.freeze({ area: 'New Barrackpore', charge: 200 }),
  '700129': Object.freeze({ area: 'Madhyamgram',     charge: 300 }),
  '700124': Object.freeze({ area: 'Barasat',         charge: 500 }),
});

// Indian PIN codes: 6 digits, first digit 1-9.
const PINCODE_REGEX = /^[1-9]\d{5}$/;

// Fail fast at startup if the mapping itself is ever edited into an invalid state.
for (const [pin, zone] of Object.entries(SHIPPING_ZONES)) {
  if (!PINCODE_REGEX.test(pin)) {
    throw new Error(`shippingRates: invalid PIN code key "${pin}"`);
  }
  if (!zone.area || typeof zone.area !== 'string') {
    throw new Error(`shippingRates: missing area name for PIN ${pin}`);
  }
  if (!Number.isInteger(zone.charge) || zone.charge < 0) {
    throw new Error(`shippingRates: charge for PIN ${pin} must be a non-negative whole number`);
  }
}

/** Trim and strip internal spaces ("700 124" → "700124"). Non-strings → ''. */
function normalizePincode(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return '';
  return String(raw).replaceAll(/\s+/g, '');
}

/**
 * getShippingForPincode — resolve the shipping charge for a delivery PIN code.
 * @returns {{ ok: true, pincode: string, area: string, charge: number }
 *         | { ok: false, code: 'INVALID_PINCODE' | 'DELIVERY_UNAVAILABLE', pincode: string, message: string }}
 */
function getShippingForPincode(raw) {
  const pincode = normalizePincode(raw);
  if (!PINCODE_REGEX.test(pincode)) {
    return { ok: false, code: 'INVALID_PINCODE', pincode, message: 'Please enter a valid 6-digit PIN code.' };
  }
  const zone = Object.hasOwn(SHIPPING_ZONES, pincode) ? SHIPPING_ZONES[pincode] : null;
  if (!zone) {
    return {
      ok: false,
      code: 'DELIVERY_UNAVAILABLE',
      pincode,
      message: `Sorry, we do not deliver to PIN code ${pincode} yet.`,
    };
  }
  return { ok: true, pincode, area: zone.area, charge: zone.charge };
}

/** Public list of serviceable areas (safe to send to clients). */
function getSupportedZones() {
  return Object.entries(SHIPPING_ZONES).map(([pincode, z]) => ({ pincode, area: z.area, charge: z.charge }));
}

module.exports = { SHIPPING_ZONES, PINCODE_REGEX, normalizePincode, getShippingForPincode, getSupportedZones };
