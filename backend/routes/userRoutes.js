const express = require('express');
const router = express.Router();
const {
  getProfile, updateProfile, addAddress, updateAddress, deleteAddress, getAllUsers, toggleUserActive,
} = require('../controllers/userController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.post('/addresses', protect, addAddress);
router.put('/addresses/:addressId', protect, updateAddress);
router.delete('/addresses/:addressId', protect, deleteAddress);

// Admin only
router.get('/', protect, adminOnly, getAllUsers);
router.put('/:id/toggle-active', protect, adminOnly, toggleUserActive);

module.exports = router;
