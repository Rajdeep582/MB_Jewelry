const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const DeliveryPartner = require('../models/DeliveryPartner');

// Map userType → model
const modelMap = {
  user:     User,
  admin:    Admin,
  delivery: DeliveryPartner,
};

/**
 * Protect routes — verify JWT, load correct model based on userType.
 * Attaches req.user and req.userType.
 */
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userType = decoded.userType || 'user';
    const Model = modelMap[userType] || User;

    const entity = await Model.findById(decoded.id).select('-password');
    if (!entity) {
      return res.status(401).json({ success: false, message: 'Account not found' });
    }
    if (!entity.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    req.user = entity;
    // Backward-compat: old tokens (no userType) for users with role='delivery' or 'admin'
    // treat them as the correct userType so delivery/admin routes still work
    let resolvedType = userType;
    if (resolvedType === 'user' && entity.role === 'delivery') resolvedType = 'delivery';
    if (resolvedType === 'user' && entity.role === 'admin')    resolvedType = 'admin';
    req.userType = resolvedType;
    req.user.role = resolvedType === 'admin' ? 'admin' : resolvedType === 'delivery' ? 'delivery' : (entity.role || 'user');
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

/**
 * Admin only — must come after protect
 */
const adminOnly = (req, res, next) => {
  if (req.userType === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admin access required' });
};

/**
 * Delivery partner only — must come after protect
 */
const deliveryOnly = (req, res, next) => {
  if (req.userType === 'delivery') return next();
  return res.status(403).json({ success: false, message: 'Delivery partner access required' });
};

/**
 * Normal user only - blocks admins and delivery partners from user routes
 */
const userOnly = (req, res, next) => {
  if (req.userType === 'user') return next();
  return res.status(403).json({ success: false, message: 'User access only' });
};

module.exports = { protect, adminOnly, deliveryOnly, userOnly };
