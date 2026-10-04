/**
 * calcDynamicPrice — computes the retail price (EXCLUDING GST) for a dynamic (metal) product.
 * Formula: livePrice × weightValue × (1 + makingCharges%)
 * GST is added once, at checkout (orderController.computePricing), per item using
 * getGstRate(). Shop pages therefore show "price + GST".
 * Result is rounded to the nearest rupee.
 */
function calcDynamicPrice(weightValue, livePrice, makingCharges) {
  return Math.round(livePrice * weightValue * (1 + makingCharges / 100));
}

/**
 * discountFraction — the product's discount as a fraction of its price (0 … <1).
 * Prefers the stored discountPercent; legacy products only have discountedPrice, so the
 * ratio discountedPrice / price (both stored together) is used for them.
 */
function discountFraction(product) {
  const pct = Number(product.discountPercent);
  if (pct > 0 && pct < 100) return pct / 100;
  const price = Number(product.price);
  const disc = product.discountedPrice;
  if (disc != null && price > 0 && Number(disc) >= 0 && Number(disc) < price) {
    return 1 - Number(disc) / price;
  }
  return 0;
}

/** applyDiscount — discounted price for a given base price, or null when no discount. */
function applyDiscount(price, fraction) {
  if (!(fraction > 0)) return null;
  return Math.round(price * (1 - fraction));
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
// Returns a new object with the live price + live discounted price — never mutates.
// Falls back to stored price (and stored discount) if no matching global rate exists.
// Product-level makingCharges take priority over the global entry default.
// This is the ONE price used by shop pages AND checkout, so what is shown is what is charged.
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
  const price = calcDynamicPrice(effectiveWeight, pricing.livePrice, mc);
  return {
    ...product,
    price,
    discountedPrice: applyDiscount(price, discountFraction(product)),
  };
}

/**
 * getGstRate — GST % for a product: product override → matching global rate → 3%.
 */
function getGstRate(product, pricingMap) {
  if (product.gst != null && Number.isFinite(Number(product.gst))) return Number(product.gst);
  if (pricingMap) {
    const { pricing } = resolvePricingEntry(
      pricingMap, product.material, product.purity, product.unit || 'gram', product.weightValue || 0
    );
    if (pricing?.gst != null) return Number(pricing.gst);
  }
  return 3;
}

module.exports = {
  calcDynamicPrice, discountFraction, applyDiscount,
  buildPricingKey, buildGlobalPricingMap, resolvePricingEntry, applyLivePrice, getGstRate,
};
