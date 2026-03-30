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
    processing:  'badge-gold',
    confirmed:   'badge-blue',
    shipped:     'badge-blue',
    delivered:   'badge-green',
    cancelled:   'badge-red',
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
