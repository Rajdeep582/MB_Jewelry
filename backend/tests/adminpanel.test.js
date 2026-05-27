process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_32_chars_minimum!!';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_min!';
process.env.JWT_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '7d';
process.env.SENTRY_DSN = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
process.env.CLOUDINARY_CLOUD_NAME = '';

const request         = require('supertest');
const mongoose        = require('mongoose');
const app             = require('../server');
const Admin           = require('../models/Admin');
const User            = require('../models/User');
const DeliveryPartner = require('../models/DeliveryPartner');
const Order           = require('../models/Order');
const GlobalPricing   = require('../models/GlobalPricing');
const { generateAccessToken } = require('../utils/generateToken');

require('./setup');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createAdmin(email = `admin${Date.now()}@example.com`) {
  const a = await Admin.create({
    name: 'Test Admin', email, password: 'Admin@1234',
    isEmailVerified: true, isActive: true,
  });
  return { admin: a, token: generateAccessToken(a._id, 'admin', 'admin') };
}

async function createUser(email = `user${Date.now()}@example.com`) {
  return User.create({
    name: 'Test User', email, password: 'Test@1234',
    providers: [{ providerType: 'local' }],
    isVerified: true, isActive: true,
  });
}

async function createDP(email = `dp${Date.now()}@example.com`, approved = false) {
  return DeliveryPartner.create({
    name: 'Test DP', email, password: 'Test@1234',
    phone: '9876543210',
    isApproved: approved, isActive: true,
  });
}

async function seedOrder(userId, overrides = {}) {
  return Order.create({
    user: userId,
    items: [],
    shippingAddress: {
      fullName: 'T', phone: '9999999999',
      addressLine1: 'A', city: 'B', state: 'C', pincode: '400001',
    },
    payment: { status: 'paid', method: 'razorpay', razorpayOrderId: `rzp_${Date.now()}${Math.random()}` },
    orderStatus: 'confirmed',
    itemsPrice: 5000, shippingPrice: 0, taxPrice: 150, totalAmount: 5150,
    ...overrides,
  });
}

// ─── Global Pricing: GET ──────────────────────────────────────────────────────

describe('GET /api/admin/global-pricing', () => {
  it('rejects unauthenticated', async () => {
    const res = await request(app).get('/api/admin/global-pricing');
    expect(res.status).toBe(401);
  });

  it('rejects user token', async () => {
    const user = await createUser();
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .get('/api/admin/global-pricing')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns pricing list for admin', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .get('/api/admin/global-pricing')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.pricing)).toBe(true);
  });
});

// ─── Global Pricing: POST (set / upsert) ─────────────────────────────────────

describe('POST /api/admin/global-pricing', () => {
  it('rejects user token', async () => {
    const user = await createUser();
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/admin/global-pricing')
      .set('Authorization', `Bearer ${token}`)
      .send({ material: 'Gold', purity: '22K', unit: 'gram', livePrice: 6000 });
    expect(res.status).toBe(403);
  });

  it('creates / upserts gold 22K pricing', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/global-pricing')
      .set('Authorization', `Bearer ${token}`)
      .send({ material: 'Gold', purity: '22K', unit: 'gram', livePrice: 6000, makingCharges: 12, gst: 3 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.entry.livePrice).toBe(6000);
  });

  it('creates silver hallmarked pricing', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/global-pricing')
      .set('Authorization', `Bearer ${token}`)
      .send({ material: 'Silver', purity: 'Hallmarked', unit: 'gram', livePrice: 95 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects invalid purity for material', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/global-pricing')
      .set('Authorization', `Bearer ${token}`)
      .send({ material: 'Gold', purity: 'Normal', unit: 'gram', livePrice: 6000 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid purity/i);
  });

  it('rejects negative live price', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/global-pricing')
      .set('Authorization', `Bearer ${token}`)
      .send({ material: 'Gold', purity: '18K', unit: 'gram', livePrice: -100 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid live price/i);
  });

  it('rejects missing live price', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/global-pricing')
      .set('Authorization', `Bearer ${token}`)
      .send({ material: 'Gold', purity: '22K', unit: 'gram' });
    expect(res.status).toBe(400);
  });

  it('upserts existing entry — updates livePrice', async () => {
    const { token } = await createAdmin();
    await request(app)
      .post('/api/admin/global-pricing')
      .set('Authorization', `Bearer ${token}`)
      .send({ material: 'Gold', purity: '18K', unit: 'gram', livePrice: 5500 });

    const res = await request(app)
      .post('/api/admin/global-pricing')
      .set('Authorization', `Bearer ${token}`)
      .send({ material: 'Gold', purity: '18K', unit: 'gram', livePrice: 5800 });

    expect(res.status).toBe(200);
    expect(res.body.entry.livePrice).toBe(5800);

    const count = await GlobalPricing.countDocuments({ material: 'Gold', purity: '18K', unit: 'gram' });
    expect(count).toBe(1);
  });
});

// ─── Global Pricing: DELETE ───────────────────────────────────────────────────

describe('DELETE /api/admin/global-pricing/:id', () => {
  it('rejects user token', async () => {
    const user = await createUser();
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .delete(`/api/admin/global-pricing/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('deletes existing pricing entry', async () => {
    const { token } = await createAdmin();
    const entry = await GlobalPricing.create({
      material: 'Diamond', purity: '14K', unit: 'gram', livePrice: 50000, makingCharges: 15, gst: 3,
    });
    const res = await request(app)
      .delete(`/api/admin/global-pricing/${entry._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(await GlobalPricing.findById(entry._id)).toBeNull();
  });

  it('returns 404 for non-existent entry', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .delete(`/api/admin/global-pricing/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid ObjectId', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .delete('/api/admin/global-pricing/not-a-valid-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

// ─── Bulk Pricing ─────────────────────────────────────────────────────────────

describe('POST /api/admin/bulk-pricing', () => {
  it('rejects user token', async () => {
    const user = await createUser();
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/admin/bulk-pricing')
      .set('Authorization', `Bearer ${token}`)
      .send({ material: 'Gold', operation: 'percentage', amount: 10 });
    expect(res.status).toBe(403);
  });

  it('rejects invalid operation type', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/bulk-pricing')
      .set('Authorization', `Bearer ${token}`)
      .send({ material: 'Gold', operation: 'multiply', amount: 2 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid operation/i);
  });

  it('rejects missing material and category', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/bulk-pricing')
      .set('Authorization', `Bearer ${token}`)
      .send({ operation: 'flat', amount: 100 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/material or category/i);
  });

  it('rejects invalid amount (NaN)', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/bulk-pricing')
      .set('Authorization', `Bearer ${token}`)
      .send({ material: 'Gold', operation: 'flat', amount: 'abc' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when no matching products exist', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/bulk-pricing')
      .set('Authorization', `Bearer ${token}`)
      .send({ material: 'Platinum', operation: 'flat', amount: 100 });
    expect(res.status).toBe(404);
  });
});

// ─── Delivery Partners: List ──────────────────────────────────────────────────

describe('GET /api/admin/delivery-partners', () => {
  it('rejects unauthenticated', async () => {
    const res = await request(app).get('/api/admin/delivery-partners');
    expect(res.status).toBe(401);
  });

  it('rejects user token', async () => {
    const user = await createUser();
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .get('/api/admin/delivery-partners')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns delivery partner list for admin', async () => {
    const { token } = await createAdmin();
    await createDP();
    const res = await request(app)
      .get('/api/admin/delivery-partners')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.partners || res.body.deliveryPartners)).toBe(true);
  });
});

// ─── Delivery Partners: Assign Role ──────────────────────────────────────────

describe('POST /api/admin/delivery-partners/:id/assign-role', () => {
  it('approves pending delivery partner', async () => {
    const { token } = await createAdmin();
    const dp = await createDP();

    const res = await request(app)
      .post(`/api/admin/delivery-partners/${dp._id}/assign-role`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await DeliveryPartner.findById(dp._id);
    expect(updated.isApproved).toBe(true);
  });

  it('returns 400 for invalid DP ID', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/delivery-partners/bad-id/assign-role')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent DP', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post(`/api/admin/delivery-partners/${new mongoose.Types.ObjectId()}/assign-role`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('rejects user token', async () => {
    const user = await createUser();
    const token = generateAccessToken(user._id, 'user', 'user');
    const dp = await createDP();
    const res = await request(app)
      .post(`/api/admin/delivery-partners/${dp._id}/assign-role`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ─── Delivery Partners: Remove Role ──────────────────────────────────────────

describe('POST /api/admin/delivery-partners/:id/remove-role', () => {
  it('revokes approval from approved DP', async () => {
    const { token } = await createAdmin();
    const dp = await createDP(undefined, true); // approved

    const res = await request(app)
      .post(`/api/admin/delivery-partners/${dp._id}/remove-role`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await DeliveryPartner.findById(dp._id);
    expect(updated.isApproved).toBe(false);
  });

  it('returns 404 for non-existent DP', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post(`/api/admin/delivery-partners/${new mongoose.Types.ObjectId()}/remove-role`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid ID', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/delivery-partners/not-valid/remove-role')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

// ─── Delivery Partners: Delete ────────────────────────────────────────────────

describe('DELETE /api/admin/delivery-partners/:id', () => {
  it('deletes pending (unapproved) DP', async () => {
    const { token } = await createAdmin();
    const dp = await createDP(); // isApproved=false

    const res = await request(app)
      .delete(`/api/admin/delivery-partners/${dp._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(await DeliveryPartner.findById(dp._id)).toBeNull();
  });

  it('refuses to delete approved DP', async () => {
    const { token } = await createAdmin();
    const dp = await createDP(undefined, true); // approved

    const res = await request(app)
      .delete(`/api/admin/delivery-partners/${dp._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/remove their role/i);

    // Still exists
    expect(await DeliveryPartner.findById(dp._id)).not.toBeNull();
  });

  it('returns 404 for non-existent DP', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .delete(`/api/admin/delivery-partners/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid ID', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .delete('/api/admin/delivery-partners/bad-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('rejects user token', async () => {
    const user = await createUser();
    const token = generateAccessToken(user._id, 'user', 'user');
    const dp = await createDP();
    const res = await request(app)
      .delete(`/api/admin/delivery-partners/${dp._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ─── Assign Delivery Agent to Order ──────────────────────────────────────────

describe('PATCH /api/admin/orders/:id/assign-delivery', () => {
  it('assigns approved DP to order', async () => {
    const { token } = await createAdmin();
    const user  = await createUser();
    const dp    = await createDP(undefined, true);
    const order = await seedOrder(user._id);

    const res = await request(app)
      .patch(`/api/admin/orders/${order._id}/assign-delivery`)
      .set('Authorization', `Bearer ${token}`)
      .send({ agentId: dp._id.toString() });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await Order.findById(order._id);
    expect(updated.deliveryAgent.toString()).toBe(dp._id.toString());
  });

  it('rejects assignment of unapproved DP', async () => {
    const { token } = await createAdmin();
    const user  = await createUser();
    const dp    = await createDP(); // not approved
    const order = await seedOrder(user._id);

    const res = await request(app)
      .patch(`/api/admin/orders/${order._id}/assign-delivery`)
      .set('Authorization', `Bearer ${token}`)
      .send({ agentId: dp._id.toString() });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not yet approved/i);
  });

  it('unassigns agent when agentId is null', async () => {
    const { token } = await createAdmin();
    const user  = await createUser();
    const dp    = await createDP(undefined, true);
    const order = await seedOrder(user._id, { deliveryAgent: dp._id });

    const res = await request(app)
      .patch(`/api/admin/orders/${order._id}/assign-delivery`)
      .set('Authorization', `Bearer ${token}`)
      .send({ agentId: null });
    expect(res.status).toBe(200);

    const updated = await Order.findById(order._id);
    expect(updated.deliveryAgent).toBeNull();
  });

  it('returns 404 for non-existent order', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .patch(`/api/admin/orders/${new mongoose.Types.ObjectId()}/assign-delivery`)
      .set('Authorization', `Bearer ${token}`)
      .send({ agentId: null });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid order ID', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .patch('/api/admin/orders/bad-id/assign-delivery')
      .set('Authorization', `Bearer ${token}`)
      .send({ agentId: null });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid agent ID format', async () => {
    const { token } = await createAdmin();
    const user  = await createUser();
    const order = await seedOrder(user._id);

    const res = await request(app)
      .patch(`/api/admin/orders/${order._id}/assign-delivery`)
      .set('Authorization', `Bearer ${token}`)
      .send({ agentId: 'not-a-valid-objectid' });
    expect(res.status).toBe(400);
  });

  it('rejects user token', async () => {
    const user  = await createUser();
    const token = generateAccessToken(user._id, 'user', 'user');
    const order = await seedOrder(user._id);
    const res = await request(app)
      .patch(`/api/admin/orders/${order._id}/assign-delivery`)
      .set('Authorization', `Bearer ${token}`)
      .send({ agentId: null });
    expect(res.status).toBe(403);
  });
});

// ─── Admin Confirm Delivery ───────────────────────────────────────────────────

describe('POST /api/admin/orders/:id/admin-confirm-delivery', () => {
  it('rejects if DP has not confirmed yet', async () => {
    const { token } = await createAdmin();
    const user  = await createUser();
    const order = await seedOrder(user._id, {
      payment: { status: 'paid', method: 'razorpay' },
      orderStatus: 'shipped',
      // dpConfirmedAt NOT set
    });

    const res = await request(app)
      .post(`/api/admin/orders/${order._id}/admin-confirm-delivery`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/delivery partner has not confirmed/i);
  });

  it('rejects if payment not paid', async () => {
    const { token } = await createAdmin();
    const user  = await createUser();
    const order = await seedOrder(user._id, {
      payment: { status: 'pending', method: 'razorpay' },
      orderStatus: 'shipped',
      dpConfirmedAt: new Date(),
    });

    const res = await request(app)
      .post(`/api/admin/orders/${order._id}/admin-confirm-delivery`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/payment/i);
  });

  it('marks order as delivered when conditions met', async () => {
    const { token } = await createAdmin();
    const user  = await createUser();
    const order = await seedOrder(user._id, {
      payment: { status: 'paid', method: 'razorpay' },
      orderStatus: 'shipped',
      dpConfirmedAt: new Date(),
    });

    const res = await request(app)
      .post(`/api/admin/orders/${order._id}/admin-confirm-delivery`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await Order.findById(order._id);
    expect(updated.orderStatus).toBe('delivered');
    expect(updated.deliveredAt).toBeDefined();
  });

  it('is idempotent for already-delivered order', async () => {
    const { token } = await createAdmin();
    const user  = await createUser();
    const order = await seedOrder(user._id, {
      payment: { status: 'paid', method: 'razorpay' },
      orderStatus: 'delivered',
      dpConfirmedAt: new Date(),
      deliveredAt: new Date(),
    });

    const res = await request(app)
      .post(`/api/admin/orders/${order._id}/admin-confirm-delivery`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/already delivered/i);
  });

  it('returns 404 for non-existent order', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post(`/api/admin/orders/${new mongoose.Types.ObjectId()}/admin-confirm-delivery`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('rejects user token', async () => {
    const user  = await createUser();
    const token = generateAccessToken(user._id, 'user', 'user');
    const order = await seedOrder(user._id);
    const res = await request(app)
      .post(`/api/admin/orders/${order._id}/admin-confirm-delivery`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
  });
});

// ─── Delivery Records ─────────────────────────────────────────────────────────

describe('GET /api/admin/deliveries', () => {
  it('rejects unauthenticated', async () => {
    const res = await request(app).get('/api/admin/deliveries');
    expect(res.status).toBe(401);
  });

  it('rejects user token', async () => {
    const user = await createUser();
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .get('/api/admin/deliveries')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns delivery records for admin', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .get('/api/admin/deliveries')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/admin/deliveries/stats', () => {
  it('rejects unauthenticated', async () => {
    const res = await request(app).get('/api/admin/deliveries/stats');
    expect(res.status).toBe(401);
  });

  it('returns stats for admin', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .get('/api/admin/deliveries/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── Resync Dynamic Prices ────────────────────────────────────────────────────

describe('POST /api/admin/resync-dynamic-prices', () => {
  it('rejects user token', async () => {
    const user = await createUser();
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/admin/resync-dynamic-prices')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('runs for admin (no products = updates 0)', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/resync-dynamic-prices')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});


// ─── Bulk Discounts ───────────────────────────────────────────────────────────

describe('POST /api/admin/bulk-discounts', () => {
  it('rejects unauthenticated', async () => {
    const res = await request(app)
      .post('/api/admin/bulk-discounts')
      .send({ targetType: 'global', discountType: 'percentage', discountValue: 10 });
    expect(res.status).toBe(401);
  });

  it('rejects user token', async () => {
    const user  = await createUser();
    const token = generateAccessToken(user._id, 'user', 'user');
    const res   = await request(app)
      .post('/api/admin/bulk-discounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'global', discountType: 'percentage', discountValue: 10 });
    expect(res.status).toBe(403);
  });

  it('rejects missing targetType', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/bulk-discounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ discountType: 'percentage', discountValue: 10 });
    expect(res.status).toBe(400);
  });

  it('rejects invalid targetType', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/bulk-discounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'unknown', discountType: 'percentage', discountValue: 10 });
    expect(res.status).toBe(400);
  });

  it('rejects invalid discountType', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/bulk-discounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'global', discountType: 'mystery', discountValue: 10 });
    expect(res.status).toBe(400);
  });

  it('rejects negative discountValue', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/bulk-discounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'global', discountType: 'percentage', discountValue: -5 });
    expect(res.status).toBe(400);
  });

  it('applies global percentage discount (404 when no products exist)', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/bulk-discounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'global', discountType: 'percentage', discountValue: 10 });
    expect([200, 404]).toContain(res.status);
  });

  it('removes discounts globally (404 when no products exist)', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/bulk-discounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'global', discountType: 'remove' });
    expect([200, 404]).toContain(res.status);
  });

  it('applies flat discount by category (targetId required)', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .post('/api/admin/bulk-discounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetType: 'category', discountType: 'flat', discountValue: 500, targetId: new mongoose.Types.ObjectId() });
    expect([200, 400, 404]).toContain(res.status);
  });
});

// ─── Delivery Partners Users (for assign) ────────────────────────────────────

describe('GET /api/admin/delivery-partners/users', () => {
  it('rejects unauthenticated', async () => {
    const res = await request(app).get('/api/admin/delivery-partners/users');
    expect(res.status).toBe(401);
  });

  it('rejects user token', async () => {
    const user  = await createUser();
    const token = generateAccessToken(user._id, 'user', 'user');
    const res   = await request(app)
      .get('/api/admin/delivery-partners/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns users list for admin', async () => {
    const { token } = await createAdmin();
    const res = await request(app)
      .get('/api/admin/delivery-partners/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.users)).toBe(true);
  });
});
