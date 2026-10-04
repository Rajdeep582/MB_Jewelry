const GlobalPricing = require('../models/GlobalPricing');
const { buildGlobalPricingMap } = require('./pricingUtils');

/**
 * Shared GlobalPricing cache — used by the shop (productController) AND checkout
 * (orderController) so both price a product from the same live rates.
 * Short TTL bounds staleness; admin pricing writes call invalidatePricingCache()
 * so a rate change is visible immediately.
 */
const PRICING_TTL_MS = 30 * 1000;
let cache = null;
let cachedAt = 0;

async function getCachedPricing() {
  const now = Date.now();
  if (cache && now - cachedAt < PRICING_TTL_MS) return cache;
  cache = await GlobalPricing.find({}).lean();
  cachedAt = now;
  return cache;
}

async function getPricingMap() {
  return buildGlobalPricingMap(await getCachedPricing());
}

function invalidatePricingCache() {
  cache = null;
  cachedAt = 0;
}

module.exports = { getCachedPricing, getPricingMap, invalidatePricingCache };
