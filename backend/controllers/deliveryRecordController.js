const Delivery = require('../models/Delivery');

// @route   GET /api/admin/deliveries
// @access  Admin
const VALID_STATUS      = ['shipped', 'delivered'];
const VALID_SOURCE_TYPE = ['order', 'custom_order'];

const getDeliveries = async (req, res) => {
  const { status, sourceType, page = 1, limit = 50 } = req.query;
  // Values assigned from our allowlist constants — never from req.query directly.
  // This breaks the taint chain: filter properties are literals, not user-controlled strings.
  const safeStatus     = VALID_STATUS.find(s => s === String(status));
  const safeSourceType = VALID_SOURCE_TYPE.find(s => s === String(sourceType));
  const filter = {
    ...(safeStatus     && { status:     safeStatus }),
    ...(safeSourceType && { sourceType: safeSourceType }),
  };

  const skip = (Number(page) - 1) * Number(limit);
  const [deliveries, total] = await Promise.all([
    Delivery.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Delivery.countDocuments(filter),
  ]);

  res.json({ success: true, deliveries, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

// @route   GET /api/admin/deliveries/stats
// @access  Admin
const getDeliveryRecordStats = async (req, res) => {
  const [shipped, delivered] = await Promise.all([
    Delivery.countDocuments({ status: 'shipped' }),
    Delivery.countDocuments({ status: 'delivered' }),
  ]);
  res.json({ success: true, stats: { shipped, delivered, total: shipped + delivered } });
};

module.exports = { getDeliveries, getDeliveryRecordStats };
