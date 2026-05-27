/**
 * calcDynamicPrice — computes the final retail price for a dynamic (metal) product.
 * Formula: livePrice × weightValue × (1 + makingCharges%) × (1 + gst%)
 * Result is rounded to the nearest rupee.
 * All four params must be numbers; pass 0 for makingCharges/gst if not applicable.
 */
function calcDynamicPrice(weightValue, livePrice, makingCharges, gst) {
  const withMaking = livePrice * weightValue * (1 + makingCharges / 100);
  return Math.round(withMaking * (1 + gst / 100));
}

/**
 * buildPricingKey — creates a composite map key string for a GlobalPricing entry.
 * Format: 'material|purity|unit' (e.g. 'Gold|22K|gram')
 * Used internally by buildGlobalPricingMap and resolvePricingEntry.
 */
function buildPricingKey(material, purity, unit) {
  return `${material}|${purity}|${unit}`;
}

// Builds a O(1) lookup map from a GlobalPricing records array
function buildGlobalPricingMap(pricingEntries) {
  const map = {};
  for (const entry of pricingEntries) {
    map[buildPricingKey(entry.material, entry.purity, entry.unit)] = entry;
  }
  return map;
}

// Finds the best matching GlobalPricing entry for a given material/purity/unit.
// Tries exact unit match first, then converts gram↔kg so mismatched units still work.
// Returns { pricing, effectiveWeight } or { pricing: null }.
function resolvePricingEntry(pricingMap, material, purity, unit, weightValue) {
  const exactKey = buildPricingKey(material, purity, unit);
  if (pricingMap[exactKey]) {
    return { pricing: pricingMap[exactKey], effectiveWeight: weightValue };
  }
  // Fallback: try the opposite unit with weight conversion
  const otherUnit = unit === 'gram' ? 'kg' : 'gram';
  const otherKey = buildPricingKey(material, purity, otherUnit);
  if (pricingMap[otherKey]) {
    const effectiveWeight = unit === 'gram' ? weightValue / 1000 : weightValue * 1000;
    return { pricing: pricingMap[otherKey], effectiveWeight };
  }
  return { pricing: null, effectiveWeight: weightValue };
}

// Applies live global pricing to a plain product object.
// Returns the same object (or a new one with updated price) — never mutates.
// Falls back to stored price if no matching global rate exists.
// Product-level makingCharges/gst take priority over the global entry defaults.
function applyLivePrice(product, pricingMap) {
  if (product.pricingType !== 'dynamic' || !(product.weightValue > 0)) {
    return product;
  }
  const unit = product.unit || 'gram';
  const { pricing, effectiveWeight } = resolvePricingEntry(
    pricingMap, product.material, product.purity, unit, product.weightValue
  );
  if (!pricing) return product;
  const mc = product.makingCharges != null ? product.makingCharges : pricing.makingCharges;
  const gst = product.gst != null ? product.gst : pricing.gst;
  return {
    ...product,
    price: calcDynamicPrice(effectiveWeight, pricing.livePrice, mc, gst),
    discountedPrice: null,
  };
}

module.exports = { calcDynamicPrice, buildPricingKey, buildGlobalPricingMap, resolvePricingEntry, applyLivePrice };
