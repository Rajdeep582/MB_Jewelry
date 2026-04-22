import api from './api';

export const orderService = {
  createPayment: (data) => api.post('/orders/create-payment', data),
  verifyPayment: (data) => api.post('/orders/verify-payment', data),
  failPayment: (data) => api.post('/orders/fail-payment', data),
  retryVerify: (id) => api.post(`/orders/${id}/retry-verify`),   // recovery path for failed network/browser crash
  getMyOrders: () => api.get('/orders/my-orders'),
  getOrder: (id) => api.get(`/orders/${id}`),
  getAllOrders: (params) => api.get('/orders', { params }),
  updateOrderStatus: (id, data) => api.put(`/orders/${id}/status`, data),
  getStats: () => api.get('/orders/stats'),
  getDeliveryStats: () => api.get('/orders/delivery-stats'), // single-query delivery pipeline counts
};

export const userService = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  toggleWishlist: (productId) => api.post(`/users/wishlist/${productId}`),
  addAddress: (data) => api.post('/users/addresses', data),
  updateAddress: (id, data) => api.put(`/users/addresses/${id}`, data),
  deleteAddress: (id) => api.delete(`/users/addresses/${id}`),
  getAllUsers: (params) => api.get('/users', { params }),
  toggleUserActive: (id) => api.put(`/users/${id}/toggle-active`),
  updateUserRole: (id, data) => api.put(`/users/${id}/role`, data),
};

export const productService = {
  getProducts: (params) => api.get('/products', { params }),
  getProduct: (id) => api.get(`/products/${id}`),
  createProduct: (formData) =>
    api.post('/products', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateProduct: (id, formData) =>
    api.put(`/products/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteProduct: (id) => api.delete(`/products/${id}`),
  addReview: (id, data) => api.post(`/products/${id}/review`, data),
};

export const categoryService = {
  getCategories: () => api.get('/categories'),
  getCategory: (id) => api.get(`/categories/${id}`),
  createCategory: (formData) =>
    api.post('/categories', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateCategory: (id, formData) =>
    api.put(`/categories/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const adminService = {
  bulkUpdatePricing: (data) => api.post('/admin/bulk-pricing', data),
  bulkUpdateDiscounts: (data) => api.post('/admin/bulk-discounts', data),
};

export const customOrderService = {
  // User
  create: (formData) =>
    api.post('/custom-orders', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getMyOrders: () => api.get('/custom-orders/my-orders'),
  getOrder: (id) => api.get(`/custom-orders/${id}`),
  createPayment: (data) => api.post('/custom-orders/create-payment', data),
  verifyPayment: (data) => api.post('/custom-orders/verify-payment', data),
  failPayment: (data) => api.post('/custom-orders/fail-payment', data),
  // Admin
  getAllOrders: (params) => api.get('/custom-orders', { params }),
  setQuote: (id, data) => api.put(`/custom-orders/${id}/quote`, data),
  updateStatus: (id, data) => api.put(`/custom-orders/${id}/status`, data),
  getStats: () => api.get('/custom-orders/stats'),
};
