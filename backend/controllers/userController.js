const User = require('../models/User');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getProfile = async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('+sessions')
    .populate('wishlist');
  res.json({ success: true, user });
};

// ─── Profile Update Helper ───────────────────────────────────────────────────
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

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
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


// @desc    Add address
// @route   POST /api/users/addresses
// @access  Private
const addAddress = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (req.body.isDefault) {
    user.addresses.forEach((a) => (a.isDefault = false));
  }

  user.addresses.push(req.body);
  await user.save();
  res.status(201).json({ success: true, addresses: user.addresses });
};

// @desc    Update address
// @route   PUT /api/users/addresses/:addressId
// @access  Private
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
  const user = await User.findById(req.user._id);
  user.addresses = user.addresses.filter(
    (a) => a._id.toString() !== req.params.addressId
  );
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
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  user.isActive = !user.isActive;
  await user.save();
  res.json({ success: true, user });
};

// @desc    Update user role (Admin)
// @route   PUT /api/users/:id/role
// @access  Admin
const updateUserRole = async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin', 'delivery'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role provided' });
  }
  
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  
  user.role = role;
  await user.save();
  res.json({ success: true, user });
};

// @desc    Toggle item in wishlist
// @route   POST /api/users/wishlist/:productId
// @access  Private
const toggleWishlist = async (req, res) => {
  const productId = req.params.productId;
  const user = await User.findById(req.user._id);
  
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const index = user.wishlist.findIndex(id => id.toString() === productId);
  if (index === -1) {
    user.wishlist.push(productId);
  } else {
    user.wishlist.splice(index, 1);
  }
  
  await user.save();
  const populatedUser = await User.findById(req.user._id).select('+sessions').populate('wishlist');
  res.json({ success: true, user: populatedUser });
};

module.exports = { getProfile, updateProfile, addAddress, updateAddress, deleteAddress, getAllUsers, toggleUserActive, updateUserRole, toggleWishlist };
