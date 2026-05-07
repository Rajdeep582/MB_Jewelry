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
} = require('../controllers/adminController');
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
router.patch('/orders/:id/assign-delivery',        protect, adminOnly, assignDeliveryAgent);
router.post('/orders/:id/admin-confirm-delivery',  protect, adminOnly, adminConfirmDelivery);

module.exports = router;
