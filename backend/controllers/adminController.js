const Product = require('../models/Product');
const GlobalPricing = require('../models/GlobalPricing');
const logger = require('../utils/logger');
const { calcDynamicPrice, buildPricingKey, buildGlobalPricingMap, resolvePricingEntry } = require('../utils/pricingUtils');

// Valid purity values per material for global pricing
const VALID_PURITIES = {
  Gold: ['22K', '18K'],
  Silver: ['Normal', 'Hallmarked'],
  Diamond: ['22K', '18K', '14K'],
};

// @route   GET /api/admin/global-pricing
// @access  Admin
const getGlobalPricing = async (req, res) => {
  const pricing = await GlobalPricing.find({}).sort({ material: 1, purity: 1, unit: 1 }).lean();
  res.json({ success: true, pricing });
};

// @route   POST /api/admin/global-pricing
// @access  Admin
const setGlobalPricing = async (req, res) => {
  const { material, purity, unit, livePrice, makingCharges, gst } = req.body;

  if (!VALID_PURITIES[material]?.includes(purity)) {
    return res.status(400).json({
      success: false,
      message: `Invalid purity "${purity}" for material "${material}"`,
    });
  }

  const numLivePrice = Number(livePrice);
  if (!livePrice || Number.isNaN(numLivePrice) || numLivePrice < 0) {
    return res.status(400).json({ success: false, message: 'Invalid live price' });
  }

  const numMaking = Number(makingCharges ?? 12);
  const numGst = Number(gst ?? 3);

  const entry = await GlobalPricing.findOneAndUpdate(
    { material: String(material), purity: String(purity), unit: String(unit) },
    { livePrice: numLivePrice, makingCharges: numMaking, gst: numGst },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  // Always recalculate all dynamic products matching this material/purity/unit
  const dynamicProducts = await Product.find({
    pricingType: 'dynamic',
    material: String(material),
    purity: String(purity),
    unit: String(unit),
  }).select('weightValue makingCharges gst').lean();

  let updatedCount = 0;
  const bulkOps = dynamicProducts
    .filter((p) => p.weightValue > 0)
    .map((p) => ({
      updateOne: {
        filter: { _id: p._id },
        update: { $set: {
          price: calcDynamicPrice(
            p.weightValue,
            numLivePrice,
            p.makingCharges ?? numMaking,
            p.gst ?? numGst
          ),
        } },
      },
    }));

  if (bulkOps.length > 0) {
    const result = await Product.bulkWrite(bulkOps, { ordered: false });
    updatedCount = result.modifiedCount;
  }

  logger.info(
    `Admin ${req.user._id} set global pricing [${material} ${purity} ${unit}] ` +
    `livePrice=${numLivePrice} making=${numMaking}% gst=${numGst}% updatedProducts=${updatedCount}`
  );

  res.json({
    success: true,
    message: `Global pricing saved${updatedCount > 0 ? `. ${updatedCount} product(s) updated.` : '.'}`,
    entry,
    updatedCount,
  });
};

// @route   POST /api/admin/bulk-pricing
// @access  Admin
const bulkUpdatePricing = async (req, res) => {
  const { material, category, operation, amount } = req.body;

  const numAmount = Number(amount);
  if (!amount || Number.isNaN(numAmount)) {
    return res.status(400).json({ success: false, message: 'Invalid amount' });
  }
  if (!['percentage', 'flat'].includes(operation)) {
    return res.status(400).json({ success: false, message: 'Invalid operation. Must be "percentage" or "flat"' });
  }

  if (!material && !category) {
    return res.status(400).json({ success: false, message: 'Must specify material or category to update' });
  }

  // Exclude dynamic products — their prices are governed by global live rates, not manual adjustments
  const query = { pricingType: { $ne: 'dynamic' } };
  if (material) query.material = String(material);
  if (category) query.category = String(category);

  // Fetch only the fields we need for calculation
  const products = await Product.find(query).select('price discountedPrice').lean();
  if (products.length === 0) {
    return res.status(404).json({ success: false, message: 'No products found matching criteria' });
  }

  // Build a single bulkWrite operation — atomic and efficient (one round-trip)
  const bulkOps = products.map((product) => {
    let newPrice = product.price;
    if (operation === 'percentage') {
      newPrice = newPrice + newPrice * (numAmount / 100);
    } else {
      newPrice = newPrice + numAmount;
    }
    newPrice = Math.max(0, Math.round(newPrice));

    const updateFields = { price: newPrice };

    if (product.discountedPrice != null) {
      let newDiscountedPrice = product.discountedPrice;
      if (operation === 'percentage') {
        newDiscountedPrice = newDiscountedPrice + newDiscountedPrice * (numAmount / 100);
      } else {
        newDiscountedPrice = newDiscountedPrice + numAmount;
      }
      updateFields.discountedPrice = Math.max(0, Math.round(newDiscountedPrice));
    }

    return {
      updateOne: {
        filter: { _id: product._id },
        update: { $set: updateFields },
      },
    };
  });

  const result = await Product.bulkWrite(bulkOps, { ordered: false });

  logger.info(
    `Admin ${req.user._id} bulk updated pricing for ${result.modifiedCount} products ` +
    `[operation=${operation}, amount=${numAmount}, query=${JSON.stringify(query)}]`
  );

  res.json({
    success: true,
    message: `Successfully updated prices for ${result.modifiedCount} products.`,
    updatedCount: result.modifiedCount,
  });
};

// @route   POST /api/admin/bulk-discounts
// @access  Admin
const bulkUpdateDiscounts = async (req, res) => {
  const { targetType, targetId, discountType, discountValue } = req.body;
  // targetType: 'global' | 'category' | 'product'
  // discountType: 'percentage' | 'flat' | 'remove'

  if (!['global', 'category', 'product'].includes(targetType)) {
    return res.status(400).json({ success: false, message: 'Invalid targetType' });
  }
  if (!['percentage', 'flat', 'remove'].includes(discountType)) {
    return res.status(400).json({ success: false, message: 'Invalid discountType' });
  }

  const numValue = Number(discountValue);
  if (discountType !== 'remove' && (Number.isNaN(numValue) || numValue <= 0)) {
    return res.status(400).json({ success: false, message: 'discountValue must be a positive number' });
  }

  const query = {};
  if (targetType === 'category') {
    if (!targetId) return res.status(400).json({ success: false, message: 'Category ID required' });
    query.category = String(targetId);
  } else if (targetType === 'product') {
    if (!targetId) return res.status(400).json({ success: false, message: 'Product ID required' });
    query._id = String(targetId);
  }

  const products = await Product.find(query).select('price').lean();
  if (products.length === 0) {
    return res.status(404).json({ success: false, message: 'No products found matching criteria' });
  }

  // Build single bulkWrite — atomic and efficient
  const bulkOps = products.map((product) => {
    let newDiscountedPrice;

    if (discountType === 'remove') {
      newDiscountedPrice = null;
    } else if (discountType === 'percentage') {
      newDiscountedPrice = product.price - product.price * (numValue / 100);
    } else {
      // flat
      newDiscountedPrice = product.price - numValue;
    }

    if (newDiscountedPrice !== null) {
      newDiscountedPrice = Math.max(0, Math.round(newDiscountedPrice));
    }

    return {
      updateOne: {
        filter: { _id: product._id },
        update: { $set: { discountedPrice: newDiscountedPrice } },
      },
    };
  });

  const result = await Product.bulkWrite(bulkOps, { ordered: false });

  logger.info(
    `Admin ${req.user._id} bulk updated discounts for ${result.modifiedCount} products ` +
    `[type=${discountType}, targetType=${targetType}]`
  );

  res.json({
    success: true,
    message: `Successfully updated discounts for ${result.modifiedCount} products.`,
    updatedCount: result.modifiedCount,
  });
};

// @route   POST /api/admin/resync-dynamic-prices
// @access  Admin
const resyncDynamicPrices = async (req, res) => {
  const pricingEntries = await GlobalPricing.find({}).lean();
  const pricingMap = buildGlobalPricingMap(pricingEntries);

  const dynamicProducts = await Product.find({
    pricingType: 'dynamic',
    weightValue: { $gt: 0 },
  }).select('material purity unit weightValue makingCharges gst').lean();

  const bulkOps = [];
  let skipped = 0;

  for (const p of dynamicProducts) {
    const { pricing, effectiveWeight } = resolvePricingEntry(pricingMap, p.material, p.purity, p.unit || 'gram', p.weightValue);
    if (!pricing) { skipped++; continue; }
    const mc = p.makingCharges ?? pricing.makingCharges;
    const g = p.gst ?? pricing.gst;
    bulkOps.push({
      updateOne: {
        filter: { _id: p._id },
        update: { $set: { price: calcDynamicPrice(effectiveWeight, pricing.livePrice, mc, g) } },
      },
    });
  }

  let updatedCount = 0;
  if (bulkOps.length > 0) {
    const result = await Product.bulkWrite(bulkOps, { ordered: false });
    updatedCount = result.modifiedCount;
  }

  logger.info(
    `Admin ${req.user._id} resynced dynamic prices: updated=${updatedCount} skipped=${skipped}`
  );

  const skipMsg = skipped > 0 ? ` ${skipped} skipped (no matching global rate set).` : '';
  res.json({
    success: true,
    message: `Re-synced ${updatedCount} dynamic product(s).${skipMsg}`,
    updatedCount,
    skipped,
  });
};

module.exports = {
  getGlobalPricing,
  setGlobalPricing,
  bulkUpdatePricing,
  bulkUpdateDiscounts,
  resyncDynamicPrices,
};
