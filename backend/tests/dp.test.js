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
const DeliveryPartner = require('../models/DeliveryPartner');
const User            = require('../models/User');
const Admin           = require('../models/Admin');
const Order           = require('../models/Order');
const CustomOrder     = require('../models/CustomOrder');
const { generateAccessToken } = require('../utils/generateToken');

require('./setup');

async function getCsrfToken(agent) {
  const res = await agent.get('/api/health');
  const c = res.headers['set-cookie']?.find(c => c.startsWith('csrfToken='));
  return c ? c.split(';')[0].split('=')[1] : null;
}

async function createVerifiedDP(email = 'dp@example.com', password = 'Test@1234') {
  return DeliveryPartner.create({
    name: 'DP User', email, password,
    phone: '9876543210',
    isActive: true,
    isApproved: true,
  });
}

// ─── DP Registration ──────────────────────────────────────────────────────────

describe('POST /api/dp-auth/register', () => {
  it('registers with valid data', async () => {
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/dp-auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: 'New DP', email: 'newdp@example.com', password: 'Test@1234', phone: '9876500000' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  it('rejects duplicate email', async () => {
    await createVerifiedDP('dup@example.com');
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/dp-auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: 'Dup DP', email: 'dup@example.com', password: 'Test@1234', phone: '9876500001' });
    expect(res.status).toBe(400);
  });

  it('rejects missing required fields', async () => {
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/dp-auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: 'Incomplete' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid email format', async () => {
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/dp-auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: 'DP', email: 'not-an-email', password: 'Test@1234', phone: '9876543210' });
    expect(res.status).toBe(400);
  });

  it('rejects weak password', async () => {
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/dp-auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: 'DP', email: 'weakpw@example.com', password: 'weakpass', phone: '9876543210' });
    expect(res.status).toBe(400);
  });

  it('blocks if email already used in customer portal', async () => {
    await User.create({
      name: 'Customer', email: 'custdp@example.com',
      password: 'Test@1234',
      providers: [{ providerType: 'local' }],
      isVerified: true, isActive: true,
    });
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/dp-auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: 'DP', email: 'custdp@example.com', password: 'Test@1234', phone: '9876543210' });
    expect(res.status).toBe(403);
  });
});

// ─── DP Login ─────────────────────────────────────────────────────────────────

describe('POST /api/dp-auth/login', () => {
  beforeEach(async () => { await createVerifiedDP(); });

  it('logs in with valid credentials', async () => {
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/dp-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'dp@example.com', password: 'Test@1234' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some(c => c.startsWith('refreshToken='))).toBe(true);
  });

  it('rejects wrong password', async () => {
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/dp-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'dp@example.com', password: 'Wrong@9999' });
    expect(res.status).toBe(401);
  });

  it('does not expose password in response', async () => {
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/dp-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'dp@example.com', password: 'Test@1234' });
    expect(res.body.user?.password).toBeUndefined();
  });

  it('rejects deactivated DP account', async () => {
    await DeliveryPartner.create({
      name: 'Inactive DP', email: 'inactive@example.com',
      password: 'Test@1234', phone: '9876500002',
      isActive: false,
    });
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/dp-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'inactive@example.com', password: 'Test@1234' });
    expect(res.status).toBe(403);
  });

  it('rejects unapproved DP (isApproved=false) — pending admin approval', async () => {
    await DeliveryPartner.create({
      name: 'Pending DP', email: 'pendingdp@example.com',
      password: 'Test@1234', phone: '9876500003',
      isActive: true,
      isApproved: false, // newly registered, not yet approved
    });
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/dp-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'pendingdp@example.com', password: 'Test@1234' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/pending|approval/i);
  });
});

// ─── DP Token Refresh ─────────────────────────────────────────────────────────

describe('POST /api/dp-auth/refresh', () => {
  it('issues new accessToken from valid refresh cookie', async () => {
    await createVerifiedDP('dprefresh@example.com');
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    await agent
      .post('/api/dp-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'dprefresh@example.com', password: 'Test@1234' });

    const res = await agent.post('/api/dp-auth/refresh');
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('rejects refresh with no cookie', async () => {
    const res = await request(app).post('/api/dp-auth/refresh');
    expect(res.status).toBe(401);
  });

  it('rejects admin refresh cookie on DP endpoint', async () => {
    const jwt = require('jsonwebtoken');
    const fakeRefresh = jwt.sign(
      { id: new mongoose.Types.ObjectId(), userType: 'admin' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
    const res = await request(app)
      .post('/api/dp-auth/refresh')
      .set('Cookie', `refreshToken=${fakeRefresh}`);
    expect(res.status).toBe(401);
  });
});

// ─── DP Me / Profile ──────────────────────────────────────────────────────────

describe('GET /api/dp-auth/me', () => {
  it('returns DP data with valid token', async () => {
    await createVerifiedDP('dpme@example.com');
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const loginRes = await agent
      .post('/api/dp-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'dpme@example.com', password: 'Test@1234' });
    const token = loginRes.body.accessToken;

    const res = await agent
      .get('/api/dp-auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user?.email || res.body.dp?.email).toBe('dpme@example.com');
  });

  it('rejects without token', async () => {
    const res = await request(app).get('/api/dp-auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects user token on DP route', async () => {
    const user = await User.create({
      name: 'User', email: 'userondp@example.com',
      password: 'Test@1234',
      providers: [{ providerType: 'local' }],
      isVerified: true, isActive: true,
    });
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .get('/api/dp-auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ─── DP Logout ────────────────────────────────────────────────────────────────

describe('POST /api/dp-auth/logout', () => {
  it('clears refreshToken cookie', async () => {
    await createVerifiedDP('dplogout@example.com');
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const loginRes = await agent
      .post('/api/dp-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'dplogout@example.com', password: 'Test@1234' });
    const token = loginRes.body.accessToken;

    const res = await agent
      .post('/api/dp-auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] || [];
    const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
    if (refreshCookie) {
      expect(refreshCookie).toMatch(/refreshToken=;|Expires=Thu, 01 Jan 1970/i);
    }
  });

  it('rejects user token on DP logout', async () => {
    const user  = await User.create({
      name: 'User', email: 'nodp@example.com',
      password: 'Test@1234',
      providers: [{ providerType: 'local' }],
      isVerified: true, isActive: true,
    });
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/dp-auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ─── DP Profile Update ────────────────────────────────────────────────────────

describe('PATCH /api/dp-auth/profile', () => {
  it('DP can update profile', async () => {
    await createVerifiedDP('dpprofile@example.com');
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const loginRes = await agent
      .post('/api/dp-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'dpprofile@example.com', password: 'Test@1234' });
    const token = loginRes.body.accessToken;

    const res = await agent
      .patch('/api/dp-auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated DP Name' });
    expect(res.status).toBe(200);
  });

  it('rejects unauthenticated profile update', async () => {
    const res = await request(app)
      .patch('/api/dp-auth/profile')
      .send({ name: 'Hacker' });
    expect(res.status).toBe(401);
  });
});

// ─── Delivery Flow — Business Rules ──────────────────────────────────────────
// These tests lock in the intended DP behaviour:
//   • DP can only see shipped/delivered orders (not filtered by agent)
//   • DP can ONLY raise the delivered flag (confirmDelivery)
//   • DP CANNOT change orderStatus directly (route removed)
//   • Admin does ALL final status transitions

describe('Delivery flow — business rules', () => {
  let dpToken, dp, orderId, customOrderId;

  beforeEach(async () => {
    dp      = await createVerifiedDP('dpdeliv@example.com');
    dpToken = generateAccessToken(dp._id, 'delivery', 'delivery');

    const order = await Order.create({
      user: new mongoose.Types.ObjectId(),
      items: [{ product: new mongoose.Types.ObjectId(), name: 'Gold Ring', price: 5000, quantity: 1, image: 'ring.jpg' }],
      shippingAddress: { fullName: 'Test User', addressLine1: '1 Main St', city: 'Kolkata', state: 'WB', pincode: '700001', country: 'India', phone: '9876543210' },
      payment: { method: 'razorpay', status: 'paid', razorpayOrderId: 'order_x', razorpayPaymentId: 'pay_x', razorpaySignature: 'sig_x' },
      orderStatus: 'shipped',
      itemsPrice: 5000, shippingPrice: 0, taxPrice: 0, totalAmount: 5000,
    });
    orderId = order._id;

    const co = await CustomOrder.create({
      user: new mongoose.Types.ObjectId(),
      type: 'Ring', material: 'Gold', description: 'Custom ring',
      shippingAddress: {
        fullName: 'Test User', phone: '9876543210',
        addressLine1: '1 Main St', city: 'Kolkata',
        state: 'West Bengal', pincode: '700001',
      },
      status: 'shipped',
      advanceAmount: 5000, finalAmount: 5000, totalAmount: 10000,
    });
    customOrderId = co._id;
  });

  it('PATCH /api/delivery/orders/:id/status returns 404 — route removed, DP cannot change status', async () => {
    const res = await request(app)
      .patch(`/api/delivery/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${dpToken}`)
      .send({ status: 'shipped', source: 'order' });
    expect(res.status).toBe(404);
  });

  it('GET /api/delivery/orders shows all shipped/delivered orders to any authenticated DP', async () => {
    const res = await request(app)
      .get('/api/delivery/orders')
      .set('Authorization', `Bearer ${dpToken}`);
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBeGreaterThanOrEqual(1);
    res.body.orders.forEach(o => {
      expect(['shipped', 'delivered']).toContain(o.orderStatus);
    });
  });

  it('GET /api/delivery/orders rejects unauthenticated', async () => {
    const res = await request(app).get('/api/delivery/orders');
    expect(res.status).toBe(401);
  });

  it('GET /api/delivery/orders rejects user token (not a DP)', async () => {
    const user = await User.create({
      name: 'Cust', email: 'custnotdp@example.com', password: 'Test@1234',
      providers: [{ providerType: 'local' }], isVerified: true, isActive: true,
    });
    const userToken = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .get('/api/delivery/orders')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('POST confirm sets dpConfirmedAt + dpConfirmedBy only — orderStatus stays shipped (not delivered)', async () => {
    const res = await request(app)
      .post(`/api/delivery/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${dpToken}`)
      .send({ source: 'order', note: 'Left at door' });
    expect(res.status).toBe(200);
    expect(res.body.order.dpConfirmedAt).toBeDefined();
    expect(res.body.order.dpConfirmedBy.toString()).toBe(dp._id.toString());
    expect(res.body.order.orderStatus).toBe('shipped'); // admin must still mark delivered
  });

  it('POST confirm custom order — status stays shipped, dpConfirmedAt set', async () => {
    const res = await request(app)
      .post(`/api/delivery/orders/${customOrderId}/confirm`)
      .set('Authorization', `Bearer ${dpToken}`)
      .send({ source: 'custom_order' });
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('shipped');
    expect(res.body.order.dpConfirmedAt).toBeDefined();
  });

  it('POST confirm is idempotent — second confirm returns 409', async () => {
    await request(app)
      .post(`/api/delivery/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${dpToken}`)
      .send({ source: 'order' });
    const res = await request(app)
      .post(`/api/delivery/orders/${orderId}/confirm`)
      .set('Authorization', `Bearer ${dpToken}`)
      .send({ source: 'order' });
    expect(res.status).toBe(409);
  });

  it('POST confirm rejects unauthenticated', async () => {
    const res = await request(app)
      .post(`/api/delivery/orders/${orderId}/confirm`)
      .send({ source: 'order' });
    expect(res.status).toBe(401);
  });
});

// ─── Payment Status Immutability ──────────────────────────────────────────────
// Admin CANNOT set payment.status via PUT /api/orders/:id/status.
// Only Razorpay webhook may mutate payment.status.

describe('Order status update — payment.status immutability', () => {
  let adminToken, orderId;

  beforeEach(async () => {
    // Create admin via Admin model — protect middleware looks up Admin collection for userType='admin'
    const admin = await Admin.create({
      name: 'Admin', email: `admin_pay_test_${Date.now()}@example.com`,
      password: 'Admin@1234',
      isEmailVerified: true, isActive: true,
    });
    adminToken = generateAccessToken(admin._id, 'admin', 'admin');

    // Order with payment.status = 'pending' (not yet paid via webhook)
    const order = await Order.create({
      user: admin._id,
      items: [{ product: new mongoose.Types.ObjectId(), name: 'Ring', price: 3000, quantity: 1, image: 'r.jpg' }],
      shippingAddress: { fullName: 'A', addressLine1: '1 St', city: 'Kol', state: 'WB', pincode: '700001', country: 'India', phone: '9876543210' },
      payment: { method: 'razorpay', status: 'pending', razorpayOrderId: 'ord_pay_test' },
      orderStatus: 'confirmed',
      itemsPrice: 3000, shippingPrice: 0, taxPrice: 0, totalAmount: 3000,
    });
    orderId = order._id;
  });

  it('ignores paymentStatus body field — payment.status stays pending after status update', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ready_to_ship', paymentStatus: 'paid', comment: 'Attempt fraud' });

    // Transition itself should succeed (confirmed → ready_to_ship is valid)
    expect(res.status).toBe(200);

    // But payment.status must remain 'pending' — not 'paid'
    const updated = await Order.findById(orderId).lean();
    expect(updated.payment.status).toBe('pending');
    expect(updated.payment.paidAt).toBeUndefined();
  });

  it('blocks marking delivered when payment.status is not paid (cannot bypass via paymentStatus body)', async () => {
    // Fast-forward order to shipped with dpConfirmedAt set
    await Order.findByIdAndUpdate(orderId, {
      orderStatus: 'shipped',
      dpConfirmedAt: new Date(),
    });

    const res = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'delivered', paymentStatus: 'paid' }); // tries to sneak in paid

    // Must be rejected — payment not paid by webhook
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/payment/i);

    const still = await Order.findById(orderId).lean();
    expect(still.orderStatus).toBe('shipped');
    expect(still.payment.status).toBe('pending');
  });
});

// ─── DP Get Profile ───────────────────────────────────────────────────────────

describe('GET /api/dp-auth/profile', () => {
  it('rejects unauthenticated', async () => {
    const res = await request(app).get('/api/dp-auth/profile');
    expect(res.status).toBe(401);
  });

  it('rejects user token on DP profile route', async () => {
    const { generateAccessToken } = require('../utils/generateToken');
    const User = require('../models/User');
    const user = await User.create({
      name: 'Not DP', email: 'notdp@example.com',
      password: 'Test@1234',
      providers: [{ providerType: 'local' }],
      isVerified: true, isActive: true,
    });
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .get('/api/dp-auth/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns DP profile for authenticated DP', async () => {
    await createVerifiedDP('dpgetprofile@example.com');
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const loginRes = await agent
      .post('/api/dp-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'dpgetprofile@example.com', password: 'Test@1234' });
    const token = loginRes.body.accessToken;
    const res = await agent
      .get('/api/dp-auth/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.profile).toBeDefined();
    expect(res.body.profile.email).toBe('dpgetprofile@example.com');
  });
});
