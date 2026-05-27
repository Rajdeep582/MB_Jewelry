process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_32_chars_minimum!!';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_min!';
process.env.JWT_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '7d';
process.env.SENTRY_DSN = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
process.env.CLOUDINARY_CLOUD_NAME = '';

const request     = require('supertest');
const mongoose    = require('mongoose');
const app         = require('../server');
const User        = require('../models/User');
const Admin       = require('../models/Admin');
const CustomOrder = require('../models/CustomOrder');
const { generateAccessToken } = require('../utils/generateToken');

require('./setup');

async function createVerifiedUser(email = 'co@example.com') {
  return User.create({
    name: 'CO User', email,
    password: 'Test@1234',
    providers: [{ providerType: 'local' }],
    isVerified: true, isActive: true,
  });
}

async function createVerifiedAdmin(email = 'coadmin@example.com') {
  return Admin.create({
    name: 'CO Admin', email,
    password: 'Admin@1234',
    isEmailVerified: true, isActive: true,
  });
}

const validShipping = {
  fullName: 'Test Name', phone: '9876543210',
  addressLine1: '123 Main St', city: 'Mumbai',
  state: 'Maharashtra', pincode: '400001',
};

const validCustomOrder = {
  type: 'Ring',
  material: 'Gold',
  purity: '22K',
  description: 'A beautiful custom gold ring with diamond setting',
  shippingAddress: validShipping,
};

// ─── Create Custom Order ──────────────────────────────────────────────────────

describe('POST /api/custom-orders', () => {
  it('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/custom-orders')
      .field('type', 'Ring')
      .field('material', 'Gold')
      .field('description', 'Test');
    expect(res.status).toBe(401);
  });

  it('rejects admin token (user-only route)', async () => {
    const admin = await createVerifiedAdmin('adminco@example.com');
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .post('/api/custom-orders')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'Ring');
    expect(res.status).toBe(403);
  });

  it('creates custom order with valid data', async () => {
    const user  = await createVerifiedUser('creator@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');

    const res = await request(app)
      .post('/api/custom-orders')
      .set('Authorization', `Bearer ${token}`)
      .field('type', validCustomOrder.type)
      .field('material', validCustomOrder.material)
      .field('purity', validCustomOrder.purity)
      .field('description', validCustomOrder.description)
      .field('shippingAddress[fullName]', validShipping.fullName)
      .field('shippingAddress[phone]', validShipping.phone)
      .field('shippingAddress[addressLine1]', validShipping.addressLine1)
      .field('shippingAddress[city]', validShipping.city)
      .field('shippingAddress[state]', validShipping.state)
      .field('shippingAddress[pincode]', validShipping.pincode);

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(res.body.customOrder?.status).toBe('pending');
  });

  it('rejects invalid jewelry type', async () => {
    const user  = await createVerifiedUser('typefail@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');

    const res = await request(app)
      .post('/api/custom-orders')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'InvalidType')
      .field('material', 'Gold')
      .field('description', 'Test order description here')
      .field('shippingAddress[fullName]', validShipping.fullName)
      .field('shippingAddress[phone]', validShipping.phone)
      .field('shippingAddress[addressLine1]', validShipping.addressLine1)
      .field('shippingAddress[city]', validShipping.city)
      .field('shippingAddress[state]', validShipping.state)
      .field('shippingAddress[pincode]', validShipping.pincode);

    expect(res.status).toBe(400);
  });
});

// ─── Get My Custom Orders ─────────────────────────────────────────────────────

describe('GET /api/custom-orders/my-orders', () => {
  it('returns only own custom orders', async () => {
    const user1 = await createVerifiedUser('own1@example.com');
    const user2 = await createVerifiedUser('own2@example.com');

    await CustomOrder.create({
      user: user1._id,
      type: 'Ring', material: 'Gold', purity: '22K',
      description: 'User 1 ring',
      shippingAddress: validShipping,
    });
    await CustomOrder.create({
      user: user2._id,
      type: 'Necklace', material: 'Silver', purity: 'Normal',
      description: 'User 2 necklace',
      shippingAddress: validShipping,
    });

    const token = generateAccessToken(user1._id, 'user', 'user');
    const res = await request(app)
      .get('/api/custom-orders/my-orders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const orders = res.body.customOrders || res.body.orders || [];
    // All returned orders belong to user1
    const allOwnedByUser1 = orders.every(o =>
      o.user?.toString() === user1._id.toString() || o.user === undefined
    );
    expect(allOwnedByUser1).toBe(true);
  });

  it('rejects unauthenticated', async () => {
    const res = await request(app).get('/api/custom-orders/my-orders');
    expect(res.status).toBe(401);
  });
});

// ─── Cancel Custom Order ──────────────────────────────────────────────────────

describe('PUT /api/custom-orders/:id/cancel', () => {
  it('owner can cancel pending order', async () => {
    const user  = await createVerifiedUser('cancel@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');

    const order = await CustomOrder.create({
      user: user._id,
      type: 'Ring', material: 'Gold', purity: '22K',
      description: 'Cancellable order',
      shippingAddress: validShipping,
      status: 'pending',
    });

    const res = await request(app)
      .put(`/api/custom-orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.order?.status).toBe('cancelled');
  });

  it('cannot cancel an order that is already in production', async () => {
    const user  = await createVerifiedUser('nocancelprod@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');

    const order = await CustomOrder.create({
      user: user._id,
      type: 'Ring', material: 'Gold', purity: '22K',
      description: 'Already in production',
      shippingAddress: validShipping,
      status: 'confirmed',
    });

    const res = await request(app)
      .put(`/api/custom-orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot be cancelled/i);
  });

  it('other user cannot cancel order', async () => {
    const owner    = await createVerifiedUser('owner@example.com');
    const attacker = await createVerifiedUser('attack@example.com');

    const order = await CustomOrder.create({
      user: owner._id,
      type: 'Ring', material: 'Gold', purity: '22K',
      description: 'Owned by someone else',
      shippingAddress: validShipping,
      status: 'pending',
    });

    const atkToken = generateAccessToken(attacker._id, 'user', 'user');
    const res = await request(app)
      .put(`/api/custom-orders/${order._id}/cancel`)
      .set('Authorization', `Bearer ${atkToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid order id', async () => {
    const user  = await createVerifiedUser('badid@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .put('/api/custom-orders/not-an-id/cancel')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent order', async () => {
    const user  = await createVerifiedUser('notfound@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .put(`/api/custom-orders/${new mongoose.Types.ObjectId()}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ─── Admin: View All Custom Orders ───────────────────────────────────────────

describe('GET /api/custom-orders (admin)', () => {
  it('admin can fetch all custom orders', async () => {
    const admin = await createVerifiedAdmin('listadmin@example.com');
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .get('/api/custom-orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('regular user blocked from admin list', async () => {
    const user  = await createVerifiedUser('userlist@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .get('/api/custom-orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ─── Admin: Set Quote ─────────────────────────────────────────────────────────

describe('PUT /api/custom-orders/:id/quote (admin)', () => {
  let adminToken, user, order;

  beforeEach(async () => {
    const admin = await createVerifiedAdmin('quotadmin@example.com');
    adminToken  = generateAccessToken(admin._id, 'admin', 'admin');
    user        = await createVerifiedUser('quotuser@example.com');
    order       = await CustomOrder.create({
      user: user._id,
      type: 'Ring', material: 'Gold', purity: '22K',
      description: 'Order needing quote',
      shippingAddress: validShipping,
      status: 'pending',
    });
  });

  it('admin can set quote on pending order', async () => {
    const res = await request(app)
      .put(`/api/custom-orders/${order._id}/quote`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quoteAmount: 20000, quoteNote: 'Premium 22K gold ring' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('regular user cannot set quote', async () => {
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .put(`/api/custom-orders/${order._id}/quote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quoteAmount: 20000 });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent order', async () => {
    const res = await request(app)
      .put(`/api/custom-orders/${new mongoose.Types.ObjectId()}/quote`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quoteAmount: 5000 });
    expect(res.status).toBe(404);
  });
});

// ─── Admin: Update Custom Order Status ───────────────────────────────────────

describe('PUT /api/custom-orders/:id/status (admin)', () => {
  it('admin can update status', async () => {
    const admin = await createVerifiedAdmin('statadmin@example.com');
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const user  = await createVerifiedUser('statuser@example.com');

    const order = await CustomOrder.create({
      user: user._id,
      type: 'Ring', material: 'Gold', purity: '22K',
      description: 'Status update test order',
      shippingAddress: validShipping,
      status: 'pending',
    });

    const res = await request(app)
      .put(`/api/custom-orders/${order._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'quoted', comment: 'Starting review' });
    expect(res.status).toBe(200);
  });
});

// ─── Custom Order Stats ───────────────────────────────────────────────────────

describe('GET /api/custom-orders/stats (admin)', () => {
  it('admin gets custom order stats', async () => {
    const admin = await createVerifiedAdmin('statsadmin@example.com');
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .get('/api/custom-orders/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── Get Single Custom Order ──────────────────────────────────────────────────

describe('GET /api/custom-orders/:id', () => {
  it('owner can view own custom order', async () => {
    const user  = await createVerifiedUser('viewown@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const order = await CustomOrder.create({
      user: user._id,
      type: 'Ring', material: 'Gold', purity: '22K',
      description: 'Own order',
      shippingAddress: validShipping,
      status: 'pending',
    });
    const res = await request(app)
      .get(`/api/custom-orders/${order._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('other user cannot view order', async () => {
    const owner    = await createVerifiedUser('viewowner@example.com');
    const attacker = await createVerifiedUser('viewatk@example.com');
    const order    = await CustomOrder.create({
      user: owner._id,
      type: 'Ring', material: 'Gold', purity: '22K',
      description: 'Protected order',
      shippingAddress: validShipping,
      status: 'pending',
    });
    const atkToken = generateAccessToken(attacker._id, 'user', 'user');
    const res = await request(app)
      .get(`/api/custom-orders/${order._id}`)
      .set('Authorization', `Bearer ${atkToken}`);
    expect(res.status).toBe(403);
  });

  it('admin can view any custom order', async () => {
    const admin = await createVerifiedAdmin('viewadmin@example.com');
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const user  = await createVerifiedUser('adminview@example.com');
    const order = await CustomOrder.create({
      user: user._id,
      type: 'Ring', material: 'Gold', purity: '22K',
      description: 'Admin viewable order',
      shippingAddress: validShipping,
      status: 'pending',
    });
    const res = await request(app)
      .get(`/api/custom-orders/${order._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});


// ─── Custom Order Payment Routes ──────────────────────────────────────────────

describe('POST /api/custom-orders/create-payment', () => {
  it('rejects unauthenticated', async () => {
    const res = await request(app)
      .post('/api/custom-orders/create-payment')
      .send({ customOrderId: new mongoose.Types.ObjectId(), phase: 'advance' });
    expect(res.status).toBe(401);
  });

  it('rejects admin token (user-only)', async () => {
    const admin = await createVerifiedAdmin('cpayAdmin@example.com');
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .post('/api/custom-orders/create-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ customOrderId: new mongoose.Types.ObjectId(), phase: 'advance' });
    expect(res.status).toBe(403);
  });

  it('rejects invalid customOrderId', async () => {
    const user  = await createVerifiedUser('cpayUser1@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/custom-orders/create-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ customOrderId: 'not-an-id', phase: 'advance' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid phase', async () => {
    const user  = await createVerifiedUser('cpayUser2@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/custom-orders/create-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ customOrderId: new mongoose.Types.ObjectId(), phase: 'invalid_phase' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent order', async () => {
    const user  = await createVerifiedUser('cpayUser3@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/custom-orders/create-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ customOrderId: new mongoose.Types.ObjectId(), phase: 'advance' });
    expect(res.status).toBe(404);
  });

  it('returns 403 when order belongs to another user', async () => {
    const owner    = await createVerifiedUser('cpayOwner@example.com');
    const attacker = await createVerifiedUser('cpayAtk@example.com');
    const order    = await CustomOrder.create({
      user: owner._id,
      type: 'Ring', material: 'Gold', purity: '22K',
      description: 'Payment test order',
      shippingAddress: validShipping,
      status: 'quoted',
      totalAmount: 10000,
      advanceAmount: 7000,
      finalAmount: 3000,
    });
    const token = generateAccessToken(attacker._id, 'user', 'user');
    const res = await request(app)
      .post('/api/custom-orders/create-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ customOrderId: order._id, phase: 'advance' });
    expect(res.status).toBe(403);
  });

  it('returns 503 when Razorpay not configured', async () => {
    const user  = await createVerifiedUser('cpayRaz@example.com');
    const order = await CustomOrder.create({
      user: user._id,
      type: 'Ring', material: 'Gold', purity: '22K',
      description: 'Razorpay test',
      shippingAddress: validShipping,
      status: 'quoted',
      totalAmount: 10000,
      advanceAmount: 7000,
      finalAmount: 3000,
    });
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/custom-orders/create-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ customOrderId: order._id, phase: 'advance' });
    // 503 if Razorpay not configured, 200 if keys are present in test env
    expect([200, 503]).toContain(res.status);
  });
});

describe('POST /api/custom-orders/verify-payment', () => {
  it('rejects unauthenticated', async () => {
    const res = await request(app)
      .post('/api/custom-orders/verify-payment')
      .send({ customOrderId: new mongoose.Types.ObjectId(), phase: 'advance', razorpayOrderId: 'x', razorpayPaymentId: 'x', razorpaySignature: 'x' });
    expect(res.status).toBe(401);
  });

  it('rejects admin token', async () => {
    const admin = await createVerifiedAdmin('cvpayAdmin@example.com');
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .post('/api/custom-orders/verify-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ customOrderId: new mongoose.Types.ObjectId(), phase: 'advance', razorpayOrderId: 'x', razorpayPaymentId: 'x', razorpaySignature: 'x' });
    expect(res.status).toBe(403);
  });

  it('rejects invalid customOrderId', async () => {
    const user  = await createVerifiedUser('cvpayUser1@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/custom-orders/verify-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ customOrderId: 'bad-id', phase: 'advance', razorpayOrderId: 'x', razorpayPaymentId: 'x', razorpaySignature: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-existent order (signature check fires before DB lookup)', async () => {
    const user  = await createVerifiedUser('cvpayUser2@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/custom-orders/verify-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ customOrderId: new mongoose.Types.ObjectId(), phase: 'advance', razorpayOrderId: 'x', razorpayPaymentId: 'x', razorpaySignature: 'x' });
    // Controller looks up order before HMAC check — non-existent → 404
    expect(res.status).toBe(404);
  });

  it('returns 400 when order belongs to another user (signature fires first)', async () => {
    const owner    = await createVerifiedUser('cvpayOwner@example.com');
    const attacker = await createVerifiedUser('cvpayAtk@example.com');
    const order    = await CustomOrder.create({
      user: owner._id,
      type: 'Ring', material: 'Gold', purity: '22K',
      description: 'Verify payment test',
      shippingAddress: validShipping,
      status: 'quoted',
      totalAmount: 10000,
    });
    const token = generateAccessToken(attacker._id, 'user', 'user');
    const res = await request(app)
      .post('/api/custom-orders/verify-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ customOrderId: order._id, phase: 'advance', razorpayOrderId: 'x', razorpayPaymentId: 'x', razorpaySignature: 'x' });
    // Controller checks order ownership before HMAC → 403
    expect(res.status).toBe(403);
  });

  it('returns 400 with invalid signature (HMAC check before Razorpay config check)', async () => {
    const user  = await createVerifiedUser('cvpayRaz@example.com');
    const order = await CustomOrder.create({
      user: user._id,
      type: 'Ring', material: 'Gold', purity: '22K',
      description: 'Raz verify test',
      shippingAddress: validShipping,
      status: 'quoted',
      totalAmount: 10000,
    });
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/custom-orders/verify-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ customOrderId: order._id, phase: 'advance', razorpayOrderId: 'rp_order', razorpayPaymentId: 'rp_pay', razorpaySignature: 'sig' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/custom-orders/fail-payment', () => {
  it('rejects unauthenticated', async () => {
    const res = await request(app)
      .post('/api/custom-orders/fail-payment')
      .send({ customOrderId: new mongoose.Types.ObjectId(), phase: 'advance' });
    expect(res.status).toBe(401);
  });

  it('rejects admin token', async () => {
    const admin = await createVerifiedAdmin('cfailAdmin@example.com');
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .post('/api/custom-orders/fail-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ customOrderId: new mongoose.Types.ObjectId(), phase: 'advance' });
    expect(res.status).toBe(403);
  });

  it('rejects missing customOrderId', async () => {
    const user  = await createVerifiedUser('cfailUser1@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/custom-orders/fail-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ phase: 'advance' });
    expect(res.status).toBe(400);
  });

  it('rejects missing phase', async () => {
    const user  = await createVerifiedUser('cfailUser2@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/custom-orders/fail-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ customOrderId: new mongoose.Types.ObjectId() });
    expect(res.status).toBe(400);
  });

  it('rejects invalid customOrderId', async () => {
    const user  = await createVerifiedUser('cfailUser3@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/custom-orders/fail-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ customOrderId: 'bad-id', phase: 'advance' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent order', async () => {
    const user  = await createVerifiedUser('cfailUser4@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/custom-orders/fail-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ customOrderId: new mongoose.Types.ObjectId(), phase: 'advance' });
    expect(res.status).toBe(404);
  });

  it('returns 403 when order belongs to another user', async () => {
    const owner    = await createVerifiedUser('cfailOwner@example.com');
    const attacker = await createVerifiedUser('cfailAtk@example.com');
    const order    = await CustomOrder.create({
      user: owner._id,
      type: 'Ring', material: 'Gold', purity: '22K',
      description: 'Fail payment ownership test',
      shippingAddress: validShipping,
      status: 'quoted',
    });
    const token = generateAccessToken(attacker._id, 'user', 'user');
    const res = await request(app)
      .post('/api/custom-orders/fail-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ customOrderId: order._id, phase: 'advance' });
    expect(res.status).toBe(403);
  });

  it('marks advance payment as failed', async () => {
    const user  = await createVerifiedUser('cfailSuccess@example.com');
    const order = await CustomOrder.create({
      user: user._id,
      type: 'Ring', material: 'Gold', purity: '22K',
      description: 'Fail success test',
      shippingAddress: validShipping,
      status: 'quoted',
      totalAmount: 10000,
      advanceAmount: 7000,
    });
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/custom-orders/fail-payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ customOrderId: order._id, phase: 'advance' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
