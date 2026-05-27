/**
 * Admin Management Routes — /api/admin
 * All routes require protect + adminOnly middleware.
 *
 * Global Pricing:
 *   GET    /global-pricing          — list all material/purity pricing entries
 *   POST   /global-pricing          — create or update a pricing entry
 *   DELETE /global-pricing/:id      — delete a pricing entry
 *   POST   /bulk-pricing            — bulk-update livePrice across multiple entries
 *   POST   /bulk-discounts          — bulk-apply discount % to static-priced products
 *   POST   /resync-dynamic-prices   — recompute and store price for all dynamic products
 *
 * Delivery Partners:
 *   GET    /delivery-partners                  — list all delivery partners
 *   GET    /delivery-partners/users            — list users eligible for delivery role
 *   POST   /delivery-partners/:id/assign-role  — promote user to delivery partner
 *   POST   /delivery-partners/:id/remove-role  — revoke delivery partner role
 *   DELETE /delivery-partners/:id              — delete delivery partner account
 *
 * Orders:
 *   PATCH  /orders/:id/assign-delivery        — assign a DP to an order
 *   POST   /orders/:id/admin-confirm-delivery  — admin confirms DP-reported delivery
 *                                               (requires dpConfirmedAt set by DP first)
 *
 * Delivery Records (snapshot collection):
 *   GET    /deliveries               — list all delivery records
 *   GET    /deliveries/stats         — aggregate delivery stats
 */
const express = require('express');
const router = express.Router();
const {
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
  assignDeliveryAgent,
  adminConfirmDelivery,
  deleteDeliveryPartner,
} = require('../controllers/adminController');
const { getDeliveries, getDeliveryRecordStats } = require('../controllers/deliveryRecordController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/global-pricing', protect, adminOnly, getGlobalPricing);
router.post('/global-pricing', protect, adminOnly, setGlobalPricing);
router.delete('/global-pricing/:id', protect, adminOnly, deleteGlobalPricing);
router.post('/bulk-pricing', protect, adminOnly, bulkUpdatePricing);
router.post('/bulk-discounts', protect, adminOnly, bulkUpdateDiscounts);
router.post('/resync-dynamic-prices', protect, adminOnly, resyncDynamicPrices);

router.get('/delivery-partners',                   protect, adminOnly, getDeliveryPartners);
router.get('/delivery-partners/users',             protect, adminOnly, getUsersForDeliveryAssign);
router.post('/delivery-partners/:id/assign-role',  protect, adminOnly, assignDeliveryRole);
router.post('/delivery-partners/:id/remove-role',  protect, adminOnly, removeDeliveryRole);
router.delete('/delivery-partners/:id',            protect, adminOnly, deleteDeliveryPartner);
router.patch('/orders/:id/assign-delivery',        protect, adminOnly, assignDeliveryAgent);
router.post('/orders/:id/admin-confirm-delivery',  protect, adminOnly, adminConfirmDelivery);

// Delivery records (independent collection)
router.get('/deliveries',       protect, adminOnly, getDeliveries);
router.get('/deliveries/stats', protect, adminOnly, getDeliveryRecordStats);

module.exports = router;
