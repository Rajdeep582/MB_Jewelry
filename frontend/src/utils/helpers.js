const BACKEND_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

/**
 * Normalize image URLs from the database.
 * Handles: absolute http://..., Cloudinary https://..., and legacy relative /uploads/...
 */
export const resolveImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Legacy relative path (e.g. /uploads/products/filename.jpg)
  return `${BACKEND_URL}${url.startsWith('/') ? url : `/${url}`}`;
};

/**
 * Format price in Indian Rupees
 */
export const formatPrice = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Truncate string to given length
 */
export const truncate = (str, len = 80) =>
  str?.length > len ? str.slice(0, len) + '...' : str;

/**
 * Calculate discount percentage
 */
export const discountPercent = (original, discounted) =>
  Math.round(((original - discounted) / original) * 100);

/**
 * Get order status color class
 */
export const getOrderStatusColor = (status) => {
  const map = {
    confirmed:        'badge-blue',
    in_production:    'badge-gold',
    ready_to_ship:    'badge-blue',
    shipped:          'badge-blue',
    delivered:        'badge-green',
    returned_refunded:'badge-red',
    failed:           'badge-red',
  };
  return map[status] || 'badge-gold';
};

/**
 * Get payment status color
 */
export const getPaymentStatusColor = (status) => {
  const map = { paid: 'badge-green', pending: 'badge-gold', failed: 'badge-red', refunded: 'badge-blue' };
  return map[status] || 'badge-gold';
};

/**
 * Format date to readable string
 */
export const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

/**
 * Generate star array for rating display
 */
export const generateStars = (rating) => {
  return Array.from({ length: 5 }, (_, i) => i + 1 <= Math.round(rating) ? 'filled' : 'empty');
};

/**
 * Debounce function
 */
export const debounce = (fn, delay = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Get custom order status color class
 */
export const getCustomOrderStatusColor = (status) => {
  const map = {
    pending:                'badge-gold',
    quoted:                 'badge-blue',
    payment_pending:        'badge-gold',
    payment_confirmed:      'badge-green',
    advance_paid:           'badge-green',
    in_production:          'badge-blue',
    final_payment_pending:  'badge-gold',
    final_payment_paid:     'badge-green',
    ready_to_ship:          'badge-blue',
    shipped:                'badge-blue',
    delivered:              'badge-green',
    cancelled:              'badge-red',
  };
  return map[status] || 'badge-gold';
};

export const REQUIRED_ADDR_FIELDS = ['fullName', 'phone', 'addressLine1', 'city', 'state', 'pincode'];

export const BLANK_ADDRESS = {
  fullName: '', phone: '', addressLine1: '', addressLine2: '',
  city: '', state: '', pincode: '', country: 'India',
};
