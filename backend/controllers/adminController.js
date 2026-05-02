const Product = require('../models/Product');

const logger = require('../utils/logger');

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

  const query = {};
  if (material) query.material = String(material);
  if (category) query.category = String(category);

  if (Object.keys(query).length === 0) {
    return res.status(400).json({ success: false, message: 'Must specify material or category to update' });
  }

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
    let newDiscountedPrice = null;

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

module.exports = {
  bulkUpdatePricing,
  bulkUpdateDiscounts,
};
