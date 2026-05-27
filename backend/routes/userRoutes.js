/**
 * User Routes — /api/users
 *
 * Profile (protect — all authenticated roles):
 *   GET  /profile   — returns profile; admin/DP roles get a restricted view
 *   PUT  /profile   — update user profile fields (userOnly, validates via schemas.profileUpdate)
 *
 * Wishlist (protect + userOnly):
 *   POST /wishlist/:productId  — toggle product in/out of wishlist
 *
 * Addresses (protect + userOnly):
 *   POST   /addresses              — add new address (validates via schemas.address)
 *   PUT    /addresses/:addressId   — update existing address (validates via schemas.address)
 *   DELETE /addresses/:addressId   — remove address
 *
 * Admin Only (protect + adminOnly):
 *   GET  /                    — list all users with filters
 *   PUT  /:id/toggle-active   — activate / deactivate a user account
 *   PUT  /:id/role            — change user role (user / admin / delivery)
 */
const express = require('express');
const router = express.Router();
const {
  getProfile, updateProfile, addAddress, updateAddress, deleteAddress, getAllUsers, toggleUserActive, updateUserRole, toggleWishlist
} = require('../controllers/userController');
const { protect, adminOnly, userOnly } = require('../middleware/auth');
const { validateSchema, schemas } = require('../middleware/validation');

router.get('/profile', protect, getProfile);  // intentionally allows all roles (has internal branch)
router.put('/profile', protect, userOnly, validateSchema(schemas.profileUpdate), updateProfile);
router.post('/wishlist/:productId', protect, userOnly, toggleWishlist);
router.post('/addresses',           protect, userOnly, validateSchema(schemas.address), addAddress);
router.put('/addresses/:addressId', protect, userOnly, validateSchema(schemas.address), updateAddress);
router.delete('/addresses/:addressId', protect, userOnly, deleteAddress);

// Admin only
router.get('/', protect, adminOnly, getAllUsers);
router.put('/:id/toggle-active', protect, adminOnly, toggleUserActive);
router.put('/:id/role', protect, adminOnly, updateUserRole);

module.exports = router;
