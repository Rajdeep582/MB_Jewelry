const express = require('express');
const router = express.Router();
const {
  getProfile, updateProfile, addAddress, updateAddress, deleteAddress, getAllUsers, toggleUserActive, updateUserRole, toggleWishlist
} = require('../controllers/userController');
const { protect, adminOnly } = require('../middleware/auth');
const { validateSchema, schemas } = require('../middleware/validation');

router.get('/profile', protect, getProfile);
router.put('/profile', protect, validateSchema(schemas.profileUpdate), updateProfile);
router.post('/wishlist/:productId', protect, toggleWishlist);
router.post('/addresses', protect, validateSchema(schemas.address), addAddress);
router.put('/addresses/:addressId', protect, validateSchema(schemas.address), updateAddress);
router.delete('/addresses/:addressId', protect, deleteAddress);

// Admin only
router.get('/', protect, adminOnly, getAllUsers);
router.put('/:id/toggle-active', protect, adminOnly, toggleUserActive);
router.put('/:id/role', protect, adminOnly, updateUserRole);

module.exports = router;
