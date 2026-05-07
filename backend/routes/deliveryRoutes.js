const express = require('express');
const router = express.Router();
const { getMyDeliveries, updateDeliveryStatus, confirmDelivery } = require('../controllers/deliveryController');
const { protect, deliveryOnly } = require('../middleware/auth');

router.get('/orders',                   protect, deliveryOnly, getMyDeliveries);
router.patch('/orders/:id/status',      protect, deliveryOnly, updateDeliveryStatus);
router.post('/orders/:id/confirm',      protect, deliveryOnly, confirmDelivery);

module.exports = router;
