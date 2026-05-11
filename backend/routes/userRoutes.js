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
