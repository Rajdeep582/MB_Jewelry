const Delivery = require('../models/Delivery');

// @route   GET /api/admin/deliveries
// @access  Admin
const getDeliveries = async (req, res) => {
  const { status, sourceType, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (status)     filter.status     = status;
  if (sourceType) filter.sourceType = sourceType;

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
