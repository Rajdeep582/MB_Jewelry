const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const DeliveryPartner = require('../models/DeliveryPartner');

// Map userType → model
const modelMap = {
  user: User,
  admin: Admin,
  delivery: DeliveryPartner,
};

/**
 * protect — JWT authentication middleware. Must be applied before any role guard.
 *
 * FLOW:
 *   1. Extract Bearer token from Authorization header
 *   2. jwt.verify → decode id + userType (user | admin | delivery)
 *   3. Look up entity in the correct model via modelMap[userType]
 *   4. Guard: entity missing → 401; isActive=false → 403
 *   5. Attach req.user (entity) and req.userType (decoded type)
 *   6. Inject req.user.role for frontend compatibility
 *
 * TOKEN EXPIRY:
 *   Returns { code: 'TOKEN_EXPIRED' } — frontend uses this to silently refresh
 *   via POST /api/auth/refresh (or dp/admin equivalent) before retrying.
 *
 * ROLE GUARDS (use after protect):
 *   adminOnly    → req.userType === 'admin'
 *   deliveryOnly → req.userType === 'delivery'
 *   userOnly     → req.userType === 'user'
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
    // Only allow type upgrade from 'user' token if entity is NOT from the User model.
    // Delivery partners and admins now have their own models and issue typed tokens,
    // so the backward-compat upgrade is no longer needed and would be a security hole.
    const resolvedType = userType;
    req.userType = resolvedType;
    let resolvedRole;
    if (resolvedType === 'admin') resolvedRole = 'admin';
    else if (resolvedType === 'delivery') resolvedRole = 'delivery';
    else resolvedRole = entity.role || 'user';
    req.user.role = resolvedRole;
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
