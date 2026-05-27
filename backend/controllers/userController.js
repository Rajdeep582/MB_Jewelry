const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getProfile = async (req, res) => {
  // Admin and delivery tokens are not in the User collection
  if (req.userType !== 'user') {
    const userData = req.user.toObject ? req.user.toObject() : { ...req.user };
    userData.role = req.userType === 'admin' ? 'admin' : req.userType === 'delivery' ? 'delivery' : 'user';
    return res.json({ success: true, user: userData });
  }
  const user = await User.findById(req.user._id)
    .select('+sessions')
    .populate('wishlist');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  const userObj = user.toObject();
  userObj.role = 'user'; // Always 'user' when accessed via user auth flow
  res.json({ success: true, user: userObj });
};

// ─── Profile Update Helper ───────────────────────────────────────────────────
/**
 * getProfileUpdates — compares req.body fields against current user values.
 * Only returns fields that actually changed (avoids unnecessary DB writes).
 * Fields: name, phone, gender, preferences, alternateEmail.
 * alternateEmail is lowercased + trimmed; empty string becomes null.
 */
function getProfileUpdates(currentUser, body) {
  const { name, phone, alternateEmail, preferences, gender } = body;
  const updateData = {};

  if (name !== undefined && name !== currentUser.name) {
    updateData.name = name;
  }

  if (phone !== undefined && phone !== (currentUser.phone || '')) {
    updateData.phone = phone;
  }

  if (gender !== undefined && gender !== (currentUser.gender || '')) {
    updateData.gender = gender;
  }

  if (preferences !== undefined) {
    updateData.preferences = preferences;
  }

  if (alternateEmail !== undefined) {
    const newVal = alternateEmail.trim().toLowerCase() || null;
    const oldVal = currentUser.alternateEmail || null;
    if (newVal !== oldVal) {
      updateData.alternateEmail = newVal;
    }
  }

  return updateData;
}

/**
 * updateProfile
 * @route  PUT /api/users/profile
 * @access Private (authenticated user)
 *
 * Updates the authenticated user's profile. Skips DB write if nothing changed.
 * Returns full user object with sessions + populated wishlist either way.
 */
const updateProfile = async (req, res) => {
  const currentUser = await User.findById(req.user._id);
  if (!currentUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const updateData = getProfileUpdates(currentUser, req.body);

  // Only hit the database if something actually changed
  let user;
  if (Object.keys(updateData).length === 0) {
    // Nothing changed — just return current state
    user = await User.findById(req.user._id).select('+sessions').populate('wishlist');
  } else {
    user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    )
      .select('+sessions')
      .populate('wishlist');
  }

  res.json({ success: true, user });
};


/**
 * addAddress
 * @route  POST /api/users/addresses
 * @access Private
 *
 * Pushes a new address to user.addresses array.
 * If isDefault=true: clears isDefault on all existing addresses first → only one default at a time.
 */
const addAddress = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user.addresses.length >= 10) {
    return res.status(400).json({ success: false, message: 'Address limit reached (max 10). Remove an existing address first.' });
  }

  if (req.body.isDefault) {
    user.addresses.forEach((a) => (a.isDefault = false));
  }

  user.addresses.push(req.body);
  await user.save();
  res.status(201).json({ success: true, addresses: user.addresses });
};

/**
 * updateAddress
 * @route  PUT /api/users/addresses/:addressId
 * @access Private
 *
 * Updates a specific address by Mongoose subdocument ID.
 * If isDefault=true: clears all other isDefault flags first.
 * Uses Object.assign to merge only supplied fields.
 */
const updateAddress = async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);

  if (!address) {
    return res.status(404).json({ success: false, message: 'Address not found' });
  }

  if (req.body.isDefault) {
    user.addresses.forEach((a) => (a.isDefault = false));
  }

  Object.assign(address, req.body);
  await user.save();
  res.json({ success: true, addresses: user.addresses });
};

// @desc    Delete address
// @route   DELETE /api/users/addresses/:addressId
// @access  Private
const deleteAddress = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.addressId)) {
    return res.status(400).json({ success: false, message: 'Invalid address ID' });
  }
  const user = await User.findById(req.user._id);
  const before = user.addresses.length;
  user.addresses = user.addresses.filter(
    (a) => a._id.toString() !== req.params.addressId
  );
  if (user.addresses.length === before) {
    return res.status(404).json({ success: false, message: 'Address not found' });
  }
  await user.save();
  res.json({ success: true, addresses: user.addresses });
};

// @desc    Get all users (Admin)
// @route   GET /api/users
// @access  Admin
const getAllUsers = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const [users, total] = await Promise.all([
    User.find({ isVerified: true }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)),
    User.countDocuments({ isVerified: true }),
  ]);
  res.json({ success: true, users, total, pages: Math.ceil(total / limit) });
};

// @desc    Toggle user active status (Admin)
// @route   PUT /api/users/:id/toggle-active
// @access  Admin
const toggleUserActive = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid user ID' });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  user.isActive = !user.isActive;
  await user.save();
  res.json({ success: true, user });
};

// @desc    Update user role (Admin)
// @route   PUT /api/users/:id/role
// @access  Admin
// Role change on User collection is intentionally disabled.
// Users are always 'user'. Admins live in Admin collection, DPs in DeliveryPartner collection.
const updateUserRole = async (req, res) => {
  return res.status(403).json({ success: false, message: 'Role assignment not permitted on user accounts.' });
};

/**
 * toggleWishlist
 * @route  POST /api/users/wishlist/:productId
 * @access Private
 *
 * Adds or removes a product from user.wishlist (toggle behavior).
 * If productId already in wishlist → removes it. If not → adds it.
 * Returns full user with populated wishlist after the update.
 */
const toggleWishlist = async (req, res) => {
  const productId = req.params.productId;
  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product ID' });
  }
  const user = await User.findById(req.user._id);
  
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const index = user.wishlist.findIndex(id => id.toString() === productId);
  if (index === -1) {
    if (user.wishlist.length >= 100) {
      return res.status(400).json({ success: false, message: 'Wishlist limit reached (max 100). Remove items first.' });
    }
    user.wishlist.push(productId);
  } else {
    user.wishlist.splice(index, 1);
  }
  
  await user.save();
  const populatedUser = await User.findById(req.user._id).select('+sessions').populate('wishlist');
  res.json({ success: true, user: populatedUser });
};

module.exports = { getProfile, updateProfile, addAddress, updateAddress, deleteAddress, getAllUsers, toggleUserActive, updateUserRole, toggleWishlist };
