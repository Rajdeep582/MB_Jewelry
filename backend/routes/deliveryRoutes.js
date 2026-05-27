/**
 * Delivery Partner Action Routes — /api/delivery
 * All routes require protect + deliveryOnly middleware.
 *
 * GET  /orders              — list orders/custom-orders assigned to the authenticated DP
 * POST /orders/:id/confirm  — DP confirms physical delivery → sets dpConfirmedAt timestamp
 *                             Admin must still call adminConfirmDelivery to finalise status.
 */
const express = require('express');
const router = express.Router();
const { getMyDeliveries, confirmDelivery } = require('../controllers/deliveryController');
const { protect, deliveryOnly } = require('../middleware/auth');

router.get('/orders',                   protect, deliveryOnly, getMyDeliveries);
router.post('/orders/:id/confirm',      protect, deliveryOnly, confirmDelivery);

module.exports = router;
