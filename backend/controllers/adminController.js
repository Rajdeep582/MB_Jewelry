const Product = require('../models/Product');
const logger = require('../utils/logger');

// @route   POST /api/admin/bulk-pricing
// @access  Admin
const bulkUpdatePricing = async (req, res) => {
  const { material, category, operation, amount } = req.body;
  
  if (!amount || isNaN(amount)) {
    return res.status(400).json({ success: false, message: 'Invalid amount' });
  }

  const query = {};
  if (material) query.material = material;
  if (category) query.category = category;

  if (Object.keys(query).length === 0) {
    return res.status(400).json({ success: false, message: 'Must specify material or category to update' });
  }

  const products = await Product.find(query);
  if (products.length === 0) {
    return res.status(404).json({ success: false, message: 'No products found matching criteria' });
  }

  let updatedCount = 0;
  for (const product of products) {
    let newPrice = product.price;

    if (operation === 'percentage') {
      newPrice = newPrice + (newPrice * (amount / 100));
    } else if (operation === 'flat') {
      newPrice = newPrice + amount;
    }

    if (newPrice < 0) newPrice = 0; // Prevent negative prices

    // Also adjust discounted price if it exists
    let newDiscountedPrice = product.discountedPrice;
    if (newDiscountedPrice) {
      if (operation === 'percentage') {
        newDiscountedPrice = newDiscountedPrice + (newDiscountedPrice * (amount / 100));
      } else if (operation === 'flat') {
        newDiscountedPrice = newDiscountedPrice + amount;
      }
      if (newDiscountedPrice < 0) newDiscountedPrice = 0;
    }

    await Product.findByIdAndUpdate(product._id, {
      price: Math.round(newPrice),
      ...(newDiscountedPrice ? { discountedPrice: Math.round(newDiscountedPrice) } : {})
    });
    updatedCount++;
  }

  logger.info(`Admin ${req.user._id} bulk updated pricing for ${updatedCount} products`);

  res.json({
    success: true,
    message: `Successfully updated prices for ${updatedCount} products.`,
    updatedCount
  });
};

// @route   POST /api/admin/bulk-discounts
// @access  Admin
const bulkUpdateDiscounts = async (req, res) => {
  const { targetType, targetId, discountType, discountValue } = req.body;
  // targetType: 'global', 'category', 'product'
  // discountType: 'percentage', 'flat', 'remove'

  let query = {};
  if (targetType === 'category') {
    if (!targetId) return res.status(400).json({ success: false, message: 'Category ID required' });
    query.category = targetId;
  } else if (targetType === 'product') {
    if (!targetId) return res.status(400).json({ success: false, message: 'Product ID required' });
    query._id = targetId;
  }

  const products = await Product.find(query);
  let updatedCount = 0;

  for (const product of products) {
    let newDiscountedPrice = null;

    if (discountType === 'remove') {
      newDiscountedPrice = null;
    } else if (discountType === 'percentage') {
      newDiscountedPrice = product.price - (product.price * (discountValue / 100));
    } else if (discountType === 'flat') {
      newDiscountedPrice = product.price - discountValue;
    }

    if (newDiscountedPrice !== null && newDiscountedPrice < 0) {
      newDiscountedPrice = 0;
    }

    await Product.findByIdAndUpdate(product._id, {
      discountedPrice: newDiscountedPrice ? Math.round(newDiscountedPrice) : null
    });
    updatedCount++;
  }

  logger.info(`Admin ${req.user._id} bulk updated discounts for ${updatedCount} products`);

  res.json({
    success: true,
    message: `Successfully updated discounts for ${updatedCount} products.`,
    updatedCount
  });
};

module.exports = {
  bulkUpdatePricing,
  bulkUpdateDiscounts
};
