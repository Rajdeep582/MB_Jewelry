const mongoose = require('mongoose');
const Product = require('../models/Product');
const GlobalPricing = require('../models/GlobalPricing');
const User = require('../models/User');
const DeliveryPartner = require('../models/DeliveryPartner');
const Order = require('../models/Order');
const CustomOrder = require('../models/CustomOrder');
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

// ─── Delivery Partner Management ─────────────────────────────────────────────

// GET /api/admin/delivery-partners
// Returns all delivery partner accounts (approved and pending) from DeliveryPartner collection
const getDeliveryPartners = async (req, res) => {
  const partners = await DeliveryPartner.find()
    .select('name email phone vehicleNumber dispatchZone createdAt isActive isApproved partnerId')
    .lean();
  res.json({ success: true, partners });
};

// GET /api/admin/delivery-partners/users
// Returns all DP accounts for the assign panel (no normal users)
const getUsersForDeliveryAssign = async (req, res) => {
  const users = await DeliveryPartner.find()
    .select('name email isApproved partnerId')
    .lean();
  // Normalise shape: add role field for frontend compat
  const normalised = users.map(u => ({ ...u, role: u.isApproved ? 'delivery' : 'pending' }));
  res.json({ success: true, users: normalised });
};

// POST /api/admin/delivery-partners/:id/assign-role
// Approves a delivery partner (sets isApproved = true)
const assignDeliveryRole = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid partner ID' });
  }
  const dp = await DeliveryPartner.findById(req.params.id);
  if (!dp) return res.status(404).json({ success: false, message: 'Delivery partner not found' });
  dp.isApproved = true;
  await dp.save();
  res.json({ success: true, message: `${dp.name} approved as delivery partner`, user: { ...dp.toObject(), role: 'delivery' } });
};

// POST /api/admin/delivery-partners/:id/remove-role
// Revokes approval (sets isApproved = false)
const removeDeliveryRole = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid partner ID' });
  }
  const dp = await DeliveryPartner.findById(req.params.id);
  if (!dp) return res.status(404).json({ success: false, message: 'Delivery partner not found' });
  dp.isApproved = false;
  await dp.save();
  res.json({ success: true, message: `${dp.name} removed from active delivery partners`, user: dp });
};

// PATCH /api/admin/orders/:id/assign-delivery
const assignDeliveryAgent = async (req, res) => {
  const { agentId, source } = req.body;
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID' });
  }
  if (agentId && !mongoose.isValidObjectId(agentId)) {
    return res.status(400).json({ success: false, message: 'Invalid agent ID' });
  }
  // Validate agent is an approved DeliveryPartner
  if (agentId) {
    const dp = await DeliveryPartner.findById(agentId).select('isApproved isActive').lean();
    if (!dp) return res.status(404).json({ success: false, message: 'Delivery partner not found' });
    if (!dp.isApproved) return res.status(400).json({ success: false, message: 'Delivery partner not yet approved' });
    if (!dp.isActive) return res.status(400).json({ success: false, message: 'Delivery partner account is inactive' });
  }
  if (source === 'custom_order') {
    const co = await CustomOrder.findByIdAndUpdate(
      req.params.id, { deliveryAgent: agentId || null }, { new: true }
    ).populate('deliveryAgent', 'name email');
    if (!co) return res.status(404).json({ success: false, message: 'Custom order not found' });
    return res.json({ success: true, order: co });
  }
  const order = await Order.findByIdAndUpdate(
    req.params.id, { deliveryAgent: agentId || null }, { new: true }
  ).populate('deliveryAgent', 'name email');
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  res.json({ success: true, order });
};

// POST /api/admin/orders/:id/admin-confirm-delivery
const adminConfirmDelivery = async (req, res) => {
  const { source } = req.body;
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid order ID' });
  }
  if (source === 'custom_order') {
    const co = await CustomOrder.findById(req.params.id);
    if (!co) return res.status(404).json({ success: false, message: 'Custom order not found' });
    if (!co.dpConfirmedAt) return res.status(400).json({ success: false, message: 'Delivery partner has not confirmed yet' });
    if (co.finalPayment?.status !== 'paid') {
      return res.status(400).json({ success: false, message: 'Cannot mark as delivered. Final payment (30%) has not been received yet.' });
    }
    if (co.status === 'delivered') return res.json({ success: true, order: co, message: 'Order already delivered' });
    co.status = 'delivered';
    co.deliveredAt = new Date();
    co.trackingHistory.push({ status: 'delivered', comment: 'Admin confirmed delivery', updatedBy: req.user._id });
    await co.save();
    return res.json({ success: true, order: co, message: 'Order marked as delivered' });
  }
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (!order.dpConfirmedAt) return res.status(400).json({ success: false, message: 'Delivery partner has not confirmed yet' });
  if (order.payment?.status !== 'paid') {
    return res.status(400).json({ success: false, message: 'Cannot mark as delivered. Payment has not been received.' });
  }
  if (order.orderStatus === 'delivered') return res.json({ success: true, order, message: 'Order already delivered' });
  order.orderStatus = 'delivered';
  order.deliveredAt = new Date();
  order.trackingHistory.push({ status: 'delivered', comment: 'Admin confirmed delivery', updatedBy: req.user._id });
  await order.save();
  res.json({ success: true, order, message: 'Order marked as delivered' });
};

const deleteGlobalPricing = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid ID' });
  }
  const entry = await GlobalPricing.findByIdAndDelete(req.params.id);
  if (!entry) return res.status(404).json({ success: false, message: 'Pricing entry not found' });
  res.json({ success: true, message: 'Pricing entry deleted' });
};

// DELETE /api/admin/delivery-partners/:id
// Hard-delete only non-approved (pending) partners
const deleteDeliveryPartner = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid partner ID' });
  }
  const dp = await DeliveryPartner.findById(req.params.id);
  if (!dp) return res.status(404).json({ success: false, message: 'Delivery partner not found' });
  if (dp.isApproved) {
    return res.status(400).json({ success: false, message: 'Cannot delete an active partner. Remove their role first.' });
  }
  await DeliveryPartner.deleteOne({ _id: dp._id });
  logger.info(`Admin ${req.user._id} hard-deleted pending DP ${dp._id} (${dp.email})`);
  res.json({ success: true, message: `${dp.name} deleted permanently` });
};

module.exports = {
  getGlobalPricing,
  setGlobalPricing,
  deleteGlobalPricing,
  bulkUpdatePricing,
  bulkUpdateDiscounts,
  resyncDynamicPrices,
  getDeliveryPartners,
  getUsersForDeliveryAssign,
  assignDeliveryRole,
  removeDeliveryRole,
  deleteDeliveryPartner,
  assignDeliveryAgent,
  adminConfirmDelivery,
};
