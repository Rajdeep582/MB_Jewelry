const express = require('express');
const router = express.Router();
const {
  getGlobalPricing,
  setGlobalPricing,
  bulkUpdatePricing,
  bulkUpdateDiscounts,
  resyncDynamicPrices,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/global-pricing', protect, adminOnly, getGlobalPricing);
router.post('/global-pricing', protect, adminOnly, setGlobalPricing);
router.post('/bulk-pricing', protect, adminOnly, bulkUpdatePricing);
router.post('/bulk-discounts', protect, adminOnly, bulkUpdateDiscounts);
router.post('/resync-dynamic-prices', protect, adminOnly, resyncDynamicPrices);

module.exports = router;
