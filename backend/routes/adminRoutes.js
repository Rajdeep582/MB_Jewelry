const express = require('express');
const router = express.Router();
const { bulkUpdatePricing, bulkUpdateDiscounts } = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/bulk-pricing', protect, adminOnly, bulkUpdatePricing);
router.post('/bulk-discounts', protect, adminOnly, bulkUpdateDiscounts);

module.exports = router;
