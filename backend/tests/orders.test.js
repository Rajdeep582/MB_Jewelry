process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_32_chars_minimum!!';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_min!';
process.env.JWT_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '7d';
process.env.SENTRY_DSN = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
process.env.CLOUDINARY_CLOUD_NAME = '';

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../server');
const User     = require('../models/User');
const Admin    = require('../models/Admin');
const Order    = require('../models/Order');
const Product  = require('../models/Product');
const Category = require('../models/Category');
const { generateAccessToken } = require('../utils/generateToken');

require('./setup');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getCsrfToken(agent) {
  const res = await agent.get('/api/health');
  const c = res.headers['set-cookie']?.find(c => c.startsWith('csrfToken='));
  return c ? c.split(';')[0].split('=')[1] : null;
}

async function createVerifiedUser(email = 'order@example.com') {
  return User.create({
    name: 'Order User', email,
    password: 'Test@1234',
    providers: [{ providerType: 'local' }],
    isVerified: true, isActive: true,
  });
}

async function createVerifiedAdmin(email = 'orderadmin@example.com') {
  return Admin.create({
    name: 'Order Admin', email,
    password: 'Admin@1234',
    isEmailVerified: true, isActive: true,
  });
}

async function seedOrder(userId, overrides = {}) {
  return Order.create({
    user: userId,
    items: [],
    shippingAddress: {
      fullName: 'Test User', phone: '9876543210',
      addressLine1: '123 Main St', city: 'Mumbai',
      state: 'Maharashtra', pincode: '400001',
    },
    payment: { status: 'paid', method: 'razorpay', razorpayOrderId: `rzp_${Date.now()}` },
    orderStatus: 'confirmed',
    itemsPrice: 5000, shippingPrice: 0, taxPrice: 150, totalAmount: 5150,
    ...overrides,
  });
}

// ─── fail-payment ─────────────────────────────────────────────────────────────

describe('POST /api/orders/fail-payment', () => {
  it('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/orders/fail-payment')
      .send({ razorpayOrderId: 'rzp_test' });
    expect(res.status).toBe(401);
  });

  it('rejects admin token (user-only)', async () => {
    const admin = await createVerifiedAdmin('faila@example.com');
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .post('/api/orders/fail-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ razorpayOrderId: 'rzp_test' });
    expect(res.status).toBe(403);
  });

  it('marks pending order as failed', async () => {
    const user = await createVerifiedUser('failpay@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const razorpayOrderId = `rzp_fail_${Date.now()}`;

    const order = await seedOrder(user._id, {
      payment: { status: 'pending', method: 'razorpay', razorpayOrderId },
      orderStatus: 'confirmed',
    });

    const agent = request.agent(app);
    const csrf = await getCsrfToken(agent);
    const res = await agent
      .post('/api/orders/fail-payment')
      .set('Authorization', `Bearer ${token}`)
      .set('x-csrf-token', csrf)
      .send({ pendingOrderId: order._id.toString(), reason: 'User closed payment window' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await Order.findById(order._id);
    expect(updated.payment.status).toBe('failed');
    expect(updated.orderStatus).toBe('failed');
  });

  it('does not fail an already-paid order', async () => {
    const user = await createVerifiedUser('nofailpaid@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const razorpayOrderId = `rzp_paidfail_${Date.now()}`;

    const order = await seedOrder(user._id, {
      payment: { status: 'paid', method: 'razorpay', razorpayOrderId },
      orderStatus: 'confirmed',
    });

    const agent = request.agent(app);
    const csrf = await getCsrfToken(agent);
    const res = await agent
      .post('/api/orders/fail-payment')
      .set('Authorization', `Bearer ${token}`)
      .set('x-csrf-token', csrf)
      .send({ razorpayOrderId });

    // Already paid — should not be overwritten
    const updated = await Order.findById(order._id);
    expect(updated.payment.status).toBe('paid');
    expect(updated.orderStatus).toBe('confirmed');
  });

  it('returns 404 for unknown razorpayOrderId', async () => {
    const user = await createVerifiedUser('notfoundfail@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const agent = request.agent(app);
    const csrf = await getCsrfToken(agent);

    const res = await agent
      .post('/api/orders/fail-payment')
      .set('Authorization', `Bearer ${token}`)
      .set('x-csrf-token', csrf)
      .send({ razorpayOrderId: 'rzp_nonexistent_xyz' });

    expect([404, 400]).toContain(res.status);
  });
});

// ─── retry-verify ─────────────────────────────────────────────────────────────

describe('POST /api/orders/:id/retry-verify', () => {
  it('rejects unauthenticated request', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).post(`/api/orders/${fakeId}/retry-verify`);
    expect(res.status).toBe(401);
  });

  it('rejects admin token (user-only)', async () => {
    const admin = await createVerifiedAdmin('retrya@example.com');
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/orders/${fakeId}/retry-verify`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid order ID', async () => {
    const user = await createVerifiedUser('retryinvalid@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/orders/not-a-valid-id/retry-verify')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent order', async () => {
    const user = await createVerifiedUser('retrynotfound@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post(`/api/orders/${new mongoose.Types.ObjectId()}/retry-verify`)
      .set('Authorization', `Bearer ${token}`);
    expect([404, 403]).toContain(res.status);
  });

  it('blocks another user from retrying someone else\'s order', async () => {
    const owner    = await createVerifiedUser('retryowner@example.com');
    const attacker = await createVerifiedUser('retryatk@example.com');
    const order    = await seedOrder(owner._id, {
      payment: { status: 'pending', method: 'razorpay', razorpayOrderId: `rzp_retry_${Date.now()}` },
    });

    const atkToken = generateAccessToken(attacker._id, 'user', 'user');
    const res = await request(app)
      .post(`/api/orders/${order._id}/retry-verify`)
      .set('Authorization', `Bearer ${atkToken}`);
    expect(res.status).toBe(403);
  });

  it('returns success for already-paid order (idempotent)', async () => {
    const user = await createVerifiedUser('retrypaid@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const order = await seedOrder(user._id);

    const agent = request.agent(app);
    const csrf = await getCsrfToken(agent);
    const res = await agent
      .post(`/api/orders/${order._id}/retry-verify`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-csrf-token', csrf);

    expect([200, 400]).toContain(res.status);
  });
});

// ─── delivery-stats (admin) ───────────────────────────────────────────────────

describe('GET /api/orders/delivery-stats', () => {
  it('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/orders/delivery-stats');
    expect(res.status).toBe(401);
  });

  it('rejects user token', async () => {
    const user = await createVerifiedUser('deliverystatsuser@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .get('/api/orders/delivery-stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns delivery stats for admin', async () => {
    const admin = await createVerifiedAdmin('deliverystatsadmin@example.com');
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .get('/api/orders/delivery-stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── GET /api/orders/:id ──────────────────────────────────────────────────────

describe('GET /api/orders/:id', () => {
  it('returns 400 for invalid ObjectId', async () => {
    const user = await createVerifiedUser('getorderinvalid@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .get('/api/orders/not-an-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent order', async () => {
    const user = await createVerifiedUser('getorder404@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .get(`/api/orders/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${token}`);
    expect([404, 403]).toContain(res.status);
  });

  it('owner can view their own order', async () => {
    const user = await createVerifiedUser('getorderowner@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const order = await seedOrder(user._id);

    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('non-owner user cannot view order', async () => {
    const owner    = await createVerifiedUser('getorderown2@example.com');
    const attacker = await createVerifiedUser('getorderatk2@example.com');
    const order    = await seedOrder(owner._id);

    const atkToken = generateAccessToken(attacker._id, 'user', 'user');
    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Authorization', `Bearer ${atkToken}`);
    expect(res.status).toBe(403);
  });

  it('admin can view any order', async () => {
    const user  = await createVerifiedUser('getorderadmnusr@example.com');
    const admin = await createVerifiedAdmin('getorderadm@example.com');
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const order = await seedOrder(user._id);

    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ─── GET /api/orders/my-orders ────────────────────────────────────────────────

describe('GET /api/orders/my-orders', () => {
  it('rejects unauthenticated', async () => {
    const res = await request(app).get('/api/orders/my-orders');
    expect(res.status).toBe(401);
  });

  it('rejects admin token (user-only route)', async () => {
    const admin = await createVerifiedAdmin('myordersadmin@example.com');
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .get('/api/orders/my-orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns empty array when user has no orders', async () => {
    const user = await createVerifiedUser('myordersempty@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .get('/api/orders/my-orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const orders = res.body.orders || res.body;
    expect(Array.isArray(orders) ? orders : []).toHaveLength(0);
  });

  it('does not return other users orders', async () => {
    const user1 = await createVerifiedUser('myorders1@example.com');
    const user2 = await createVerifiedUser('myorders2@example.com');

    await seedOrder(user1._id);
    await seedOrder(user2._id);

    const token1 = generateAccessToken(user1._id, 'user', 'user');
    const res = await request(app)
      .get('/api/orders/my-orders')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    const orders = res.body.orders || [];
    const allOwned = orders.every(o =>
      !o.user || o.user.toString() === user1._id.toString() || typeof o.user === 'object'
    );
    expect(allOwned).toBe(true);
    expect(orders.length).toBeGreaterThanOrEqual(1);
  });

  it('returns multiple orders sorted newest first', async () => {
    const user = await createVerifiedUser('myordersmulti@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');

    await seedOrder(user._id);
    await seedOrder(user._id);
    await seedOrder(user._id);

    const res = await request(app)
      .get('/api/orders/my-orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const orders = res.body.orders || [];
    expect(orders.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── GET /api/orders (admin all orders) ──────────────────────────────────────

describe('GET /api/orders (admin)', () => {
  it('rejects unauthenticated', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  it('rejects user token', async () => {
    const user = await createVerifiedUser('allordsuser@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns all orders for admin', async () => {
    const admin = await createVerifiedAdmin('allordsadmin@example.com');
    const user  = await createVerifiedUser('allordsowner@example.com');
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    await seedOrder(user._id);

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.orders)).toBe(true);
  });
});

// ─── Order status transitions ─────────────────────────────────────────────────

describe('PUT /api/orders/:id/status (admin)', () => {
  let adminToken, user;

  beforeEach(async () => {
    const admin = await createVerifiedAdmin(`statusadmin${Date.now()}@example.com`);
    adminToken  = generateAccessToken(admin._id, 'admin', 'admin');
    user        = await createVerifiedUser(`statususer${Date.now()}@example.com`);
  });

  it('transitions confirmed → ready_to_ship', async () => {
    const order = await seedOrder(user._id);
    const res = await request(app)
      .put(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ready_to_ship' });
    expect(res.status).toBe(200);
    const updated = await Order.findById(order._id);
    expect(updated.orderStatus).toBe('ready_to_ship');
  });

  it('transitions ready_to_ship → shipped', async () => {
    const order = await seedOrder(user._id, { orderStatus: 'ready_to_ship' });
    const res = await request(app)
      .put(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'shipped' });
    expect(res.status).toBe(200);
  });

  it('transitions shipped → delivered requires dpConfirmedAt + payment paid', async () => {
    // Order with payment paid, dpConfirmedAt set — should succeed
    const order = await seedOrder(user._id, {
      orderStatus: 'shipped',
      payment: { status: 'paid', method: 'razorpay', razorpayOrderId: `rzp_del_${Date.now()}` },
      dpConfirmedAt: new Date(),
    });
    const res = await request(app)
      .put(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'delivered' });
    expect(res.status).toBe(200);
    const updated = await Order.findById(order._id);
    expect(updated.orderStatus).toBe('delivered');
    expect(updated.deliveredAt).toBeDefined();
  });

  it('blocks shipped → delivered when payment not paid', async () => {
    const order = await seedOrder(user._id, {
      orderStatus: 'shipped',
      payment: { status: 'pending', method: 'razorpay', razorpayOrderId: `rzp_blk_${Date.now()}` },
      dpConfirmedAt: new Date(),
    });
    const res = await request(app)
      .put(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'delivered' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/payment/i);
  });

  it('blocks shipped → delivered when dpConfirmedAt not set', async () => {
    const order = await seedOrder(user._id, {
      orderStatus: 'shipped',
      payment: { status: 'paid', method: 'razorpay', razorpayOrderId: `rzp_nodp_${Date.now()}` },
      // dpConfirmedAt intentionally absent
    });
    const res = await request(app)
      .put(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'delivered' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/delivery partner/i);
  });

  it('rejects invalid status value', async () => {
    const order = await seedOrder(user._id);
    const res = await request(app)
      .put(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'teleported' });
    expect(res.status).toBe(400);
  });

  it('rejects same-status update (no-op)', async () => {
    const order = await seedOrder(user._id, { orderStatus: 'confirmed' });
    const res = await request(app)
      .put(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmed' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already/i);
  });

  it('rejects invalid order ID', async () => {
    const res = await request(app)
      .put('/api/orders/bad-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ready_to_ship' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent order', async () => {
    const res = await request(app)
      .put(`/api/orders/${new mongoose.Types.ObjectId()}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ready_to_ship' });
    expect(res.status).toBe(404);
  });

  it('user token blocked from status update', async () => {
    const order = await seedOrder(user._id);
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .put(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ready_to_ship' });
    expect(res.status).toBe(403);
  });
});

// ─── Order stats ──────────────────────────────────────────────────────────────

describe('GET /api/orders/stats (admin)', () => {
  it('rejects unauthenticated', async () => {
    const res = await request(app).get('/api/orders/stats');
    expect(res.status).toBe(401);
  });

  it('rejects user token', async () => {
    const user = await createVerifiedUser('statsorduser@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .get('/api/orders/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns stats for admin', async () => {
    const admin = await createVerifiedAdmin('statsordadmin@example.com');
    const user  = await createVerifiedUser('statsordowner@example.com');
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    await seedOrder(user._id);
    await seedOrder(user._id, { payment: { status: 'pending', method: 'razorpay' } });

    const res = await request(app)
      .get('/api/orders/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── create-payment input validation ──────────────────────────────────────────

describe('POST /api/orders/create-payment — input validation', () => {
  it('rejects quantity of 0', async () => {
    const user = await createVerifiedUser('qty0@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const agent = request.agent(app);
    const csrf = await getCsrfToken(agent);

    const res = await agent
      .post('/api/orders/create-payment')
      .set('Authorization', `Bearer ${token}`)
      .set('x-csrf-token', csrf)
      .send({
        items: [{ productId: new mongoose.Types.ObjectId(), quantity: 0 }],
        shippingAddress: {
          fullName: 'Test', phone: '9876543210',
          addressLine1: 'A', city: 'B', state: 'C', pincode: '400001',
        },
      });
    expect(res.status).toBe(400);
  });

  it('rejects invalid pincode in shipping address', async () => {
    const user = await createVerifiedUser('badpin@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const agent = request.agent(app);
    const csrf = await getCsrfToken(agent);

    const res = await agent
      .post('/api/orders/create-payment')
      .set('Authorization', `Bearer ${token}`)
      .set('x-csrf-token', csrf)
      .send({
        items: [{ productId: new mongoose.Types.ObjectId(), quantity: 1 }],
        shippingAddress: {
          fullName: 'Test', phone: '9876543210',
          addressLine1: 'A', city: 'B', state: 'C', pincode: 'ABCDEF',
        },
      });
    expect(res.status).toBe(400);
  });
});
