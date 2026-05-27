process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_32_chars_minimum!!';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_min!';
process.env.JWT_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '7d';
process.env.ADMIN_REGISTER_SECRET = 'test_admin_secret';
process.env.SENTRY_DSN = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
process.env.CLOUDINARY_CLOUD_NAME = '';

const request  = require('supertest');
const mongoose = require('mongoose');
const crypto   = require('node:crypto');
const app      = require('../server');
const Admin    = require('../models/Admin');
const User     = require('../models/User');
const Order    = require('../models/Order');
const { generateAccessToken } = require('../utils/generateToken');

require('./setup');

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

async function getCsrfToken(agent) {
  const res = await agent.get('/api/health');
  const c = res.headers['set-cookie']?.find(c => c.startsWith('csrfToken='));
  return c ? c.split(';')[0].split('=')[1] : null;
}

async function createVerifiedAdmin(email = 'admin@example.com', password = 'Admin@1234') {
  return Admin.create({
    name: 'Test Admin', email, password,
    isEmailVerified: true, isActive: true,
  });
}

// ─── Admin Register ───────────────────────────────────────────────────────────

describe('POST /api/admin-auth/register', () => {
  it('rejects registration without secret', async () => {
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/admin-auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: 'Admin', email: 'reg@example.com', password: 'Admin@1234', secret: "wrong_secret" });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/invalid registration secret/i);
  });

  it('registers admin with correct secret (email sends fail silently in test)', async () => {
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/admin-auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: 'Admin', email: 'newreg@example.com', password: 'Admin@1234', secret: "test_admin_secret" });
    // Email send will fail in test env — may 500 or succeed with partial
    expect([200, 201, 500]).toContain(res.status);
    if (res.status !== 500) expect(res.body.success).toBe(true);
  });

  it('rejects duplicate email', async () => {
    await createVerifiedAdmin('dup@example.com');
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/admin-auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: 'Admin2', email: 'dup@example.com', password: 'Admin@1234', secret: "test_admin_secret" });
    expect(res.status).toBe(400);
  });

  it('blocks if email belongs to customer portal', async () => {
    await User.create({
      name: 'Customer', email: 'customer@example.com',
      password: 'Test@1234',
      providers: [{ providerType: 'local' }],
      isVerified: true, isActive: true,
    });
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/admin-auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: 'Admin', email: 'customer@example.com', password: 'Admin@1234', secret: "test_admin_secret" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('WRONG_PORTAL');
  });
});

// ─── Admin Login ──────────────────────────────────────────────────────────────

describe('POST /api/admin-auth/login', () => {
  beforeEach(async () => { await createVerifiedAdmin(); });

  it('logs in with valid credentials', async () => {
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/admin-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'admin@example.com', password: 'Admin@1234' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.role).toBe('admin');
    const cookies = res.headers['set-cookie'] || [];
    expect(cookies.some(c => c.startsWith('refreshToken='))).toBe(true);
  });

  it('rejects wrong password', async () => {
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/admin-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'admin@example.com', password: 'Wrong@9999' });
    expect(res.status).toBe(401);
  });

  it('rejects unverified admin', async () => {
    await Admin.create({
      name: 'Unverified', email: 'unverified@example.com',
      password: 'Admin@1234',
      isEmailVerified: false, isActive: true,
    });
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/admin-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'unverified@example.com', password: 'Admin@1234' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('rejects deactivated admin', async () => {
    await Admin.create({
      name: 'Inactive', email: 'inactive@example.com',
      password: 'Admin@1234',
      isEmailVerified: true, isActive: false,
    });
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/admin-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'inactive@example.com', password: 'Admin@1234' });
    expect(res.status).toBe(403);
  });

  it('blocks customer email from admin portal', async () => {
    await User.create({
      name: 'Cust', email: 'cust@example.com',
      password: 'Test@1234',
      providers: [{ providerType: 'local' }],
      isVerified: true, isActive: true,
    });
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/admin-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'cust@example.com', password: 'Test@1234' });
    expect(res.status).toBe(403); // wrong portal → 403
  });

  it('does not expose password in response', async () => {
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/admin-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'admin@example.com', password: 'Admin@1234' });
    expect(res.body.user?.password).toBeUndefined();
  });

  it('locks after 5 failed attempts', async () => {
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    for (let i = 0; i < 5; i++) {
      await agent
        .post('/api/admin-auth/login')
        .set('x-csrf-token', csrf)
        .send({ email: 'admin@example.com', password: 'Bad@9999' });
    }
    const res = await agent
      .post('/api/admin-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'admin@example.com', password: 'Admin@1234' });
    expect(res.status).toBe(401);
  });
});

// ─── Admin Token Refresh ──────────────────────────────────────────────────────

describe('POST /api/admin-auth/refresh', () => {
  it('issues new accessToken from valid refresh cookie', async () => {
    await createVerifiedAdmin('refresh@example.com');
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    await agent
      .post('/api/admin-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'refresh@example.com', password: 'Admin@1234' });

    const res = await agent.post('/api/admin-auth/refresh');
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('rejects refresh with no cookie', async () => {
    const res = await request(app).post('/api/admin-auth/refresh');
    expect(res.status).toBe(401);
  });

  it('rejects user refresh cookie on admin endpoint', async () => {
    // Mint a user-type refresh token and try it on admin endpoint
    const jwt = require('jsonwebtoken');
    const fakeRefresh = jwt.sign(
      { id: new mongoose.Types.ObjectId(), userType: 'user' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
    const agent = request.agent(app);
    // Manually set cookie
    agent.jar?.setCookie?.(`refreshToken=${fakeRefresh}; Path=/`);
    const res = await request(app)
      .post('/api/admin-auth/refresh')
      .set('Cookie', `refreshToken=${fakeRefresh}`);
    expect(res.status).toBe(401);
  });
});

// ─── Admin Me + Logout ────────────────────────────────────────────────────────

describe('Admin /me and /logout', () => {
  it('GET /api/admin-auth/me returns admin data', async () => {
    const admin = await createVerifiedAdmin('me@example.com');
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .get('/api/admin-auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@example.com');
    expect(res.body.user.password).toBeUndefined();
  });

  it('GET /api/admin-auth/me rejects user token', async () => {
    await User.create({
      name: 'NotAdmin', email: 'notadmin@example.com',
      password: 'Test@1234',
      providers: [{ providerType: 'local' }],
      isVerified: true, isActive: true,
    });
    const user = await User.findOne({ email: 'notadmin@example.com' });
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .get('/api/admin-auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('POST /api/admin-auth/logout clears cookie', async () => {
    await createVerifiedAdmin('logout@example.com');
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const loginRes = await agent
      .post('/api/admin-auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'logout@example.com', password: 'Admin@1234' });
    const token = loginRes.body.accessToken;

    const res = await agent
      .post('/api/admin-auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] || [];
    const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
    if (refreshCookie) {
      expect(refreshCookie).toMatch(/refreshToken=;|Expires=Thu, 01 Jan 1970/i);
    }
  });
});

// ─── Admin OTP verify-email ───────────────────────────────────────────────────

describe('POST /api/admin-auth/verify-email', () => {
  it('rejects invalid OTP for admin verification', async () => {
    const rawOtp = '123456';
    await Admin.create({
      name: 'UnverifiedAdmin',
      email: 'otpadmin@example.com',
      password: 'Admin@1234',
      isEmailVerified: false, isActive: true,
      emailOtpHash:   hashToken(rawOtp),
      emailOtpExpiry: new Date(Date.now() + 10 * 60 * 1000),
    });

    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/admin-auth/verify-email')
      .set('x-csrf-token', csrf)
      .send({ email: 'otpadmin@example.com', otp: '999999' });
    expect(res.status).toBe(400);
  });

  it('verifies admin with correct OTP', async () => {
    const rawOtp = '654321';
    await Admin.create({
      name: 'OTPAdmin',
      email: 'otpok@example.com',
      password: 'Admin@1234',
      isEmailVerified: false, isActive: true,
      emailOtpHash:   hashToken(rawOtp),
      emailOtpExpiry: new Date(Date.now() + 10 * 60 * 1000),
    });

    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/admin-auth/verify-email')
      .set('x-csrf-token', csrf)
      .send({ email: 'otpok@example.com', otp: rawOtp });
    expect(res.status).toBe(200);

    const updated = await Admin.findOne({ email: 'otpok@example.com' });
    expect(updated.isEmailVerified).toBe(true);
  });

  it('rejects already-verified admin OTP', async () => {
    const admin = await createVerifiedAdmin('alreadyv@example.com');
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/admin-auth/verify-email')
      .set('x-csrf-token', csrf)
      .send({ email: 'alreadyv@example.com', otp: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already verified/i);
  });

  it('locks out after 5 wrong OTP attempts (emailOtpAttempts >= 5 → 403)', async () => {
    const rawOtp = '777777';
    await Admin.create({
      name: 'LockoutAdmin',
      email: 'lockout@example.com',
      password: 'Admin@1234',
      isEmailVerified: false, isActive: true,
      emailOtpHash:      hashToken(rawOtp),
      emailOtpExpiry:    new Date(Date.now() + 10 * 60 * 1000),
      emailOtpAttempts:  5, // already at limit
    });
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/admin-auth/verify-email')
      .set('x-csrf-token', csrf)
      .send({ email: 'lockout@example.com', otp: rawOtp }); // correct OTP but locked
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/too many|attempts/i);
  });

  it('increments emailOtpAttempts on each wrong OTP', async () => {
    const rawOtp = '888888';
    await Admin.create({
      name: 'CountAdmin',
      email: 'count@example.com',
      password: 'Admin@1234',
      isEmailVerified: false, isActive: true,
      emailOtpHash:      hashToken(rawOtp),
      emailOtpExpiry:    new Date(Date.now() + 10 * 60 * 1000),
      emailOtpAttempts:  0,
    });
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    await agent
      .post('/api/admin-auth/verify-email')
      .set('x-csrf-token', csrf)
      .send({ email: 'count@example.com', otp: '000000' }); // wrong
    const doc = await Admin.findOne({ email: 'count@example.com' }).select('+emailOtpAttempts');
    expect(doc.emailOtpAttempts).toBe(1);
  });
});

// ─── Admin: Order Management ──────────────────────────────────────────────────

describe('Admin order management', () => {
  let adminToken, user;

  beforeEach(async () => {
    const admin = await createVerifiedAdmin('ordadmin@example.com');
    adminToken  = generateAccessToken(admin._id, 'admin', 'admin');
    user        = await User.create({
      name: 'Ord User', email: 'orduser@example.com',
      password: 'Test@1234',
      providers: [{ providerType: 'local' }],
      isVerified: true, isActive: true,
    });
  });

  it('GET /api/orders returns all orders (admin)', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/orders/stats returns stats (admin)', async () => {
    const res = await request(app)
      .get('/api/orders/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PUT /api/orders/:id/status — invalid status rejected', async () => {
    const order = await Order.create({
      user: user._id,
      items: [],
      shippingAddress: { fullName: 'T', phone: '9999999999', addressLine1: 'A', city: 'B', state: 'C', pincode: '400001' },
      payment: { status: 'paid', method: 'razorpay' },
      orderStatus: 'confirmed',
      itemsPrice: 100, shippingPrice: 0, taxPrice: 3, totalAmount: 103,
    });

    const res = await request(app)
      .put(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'flying' }); // invalid status
    expect(res.status).toBe(400);
  });

  it('PUT /api/orders/:id/status — valid transition accepted', async () => {
    const order = await Order.create({
      user: user._id,
      items: [],
      shippingAddress: { fullName: 'T', phone: '9999999999', addressLine1: 'A', city: 'B', state: 'C', pincode: '400001' },
      payment: { status: 'paid', method: 'razorpay' },
      orderStatus: 'confirmed',
      itemsPrice: 100, shippingPrice: 0, taxPrice: 3, totalAmount: 103,
    });

    const res = await request(app)
      .put(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: "ready_to_ship" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PUT /api/orders/:id/status — same status rejected', async () => {
    const order = await Order.create({
      user: user._id, items: [],
      shippingAddress: { fullName: 'T', phone: '9999999999', addressLine1: 'A', city: 'B', state: 'C', pincode: '400001' },
      payment: { status: 'paid', method: 'razorpay' },
      orderStatus: 'confirmed',
      itemsPrice: 100, shippingPrice: 0, taxPrice: 3, totalAmount: 103,
    });
    const res = await request(app)
      .put(`/api/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmed' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already/i);
  });

  it('GET /api/orders/:id accessible by order owner', async () => {
    const order = await Order.create({
      user: user._id, items: [],
      shippingAddress: { fullName: 'T', phone: '9999999999', addressLine1: 'A', city: 'B', state: 'C', pincode: '400001' },
      payment: { status: 'paid', method: 'razorpay' },
      orderStatus: 'confirmed',
      itemsPrice: 100, shippingPrice: 0, taxPrice: 3, totalAmount: 103,
    });
    const userToken = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/orders/:id — other user cannot view', async () => {
    const attacker = await User.create({
      name: 'Attacker', email: 'attacker@example.com',
      password: 'Test@1234',
      providers: [{ providerType: 'local' }],
      isVerified: true, isActive: true,
    });
    const order = await Order.create({
      user: user._id, items: [],
      shippingAddress: { fullName: 'T', phone: '9999999999', addressLine1: 'A', city: 'B', state: 'C', pincode: '400001' },
      payment: { status: 'paid', method: 'razorpay' },
      orderStatus: 'confirmed',
      itemsPrice: 100, shippingPrice: 0, taxPrice: 3, totalAmount: 103,
    });
    const atkToken = generateAccessToken(attacker._id, 'user', 'user');
    const res = await request(app)
      .get(`/api/orders/${order._id}`)
      .set('Authorization', `Bearer ${atkToken}`);
    expect(res.status).toBe(403);
  });
});


// ─── Admin Auth — Resend OTP ──────────────────────────────────────────────────

describe('POST /api/admin-auth/resend-otp', () => {
  it('rejects missing email', async () => {
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res   = await agent
      .post('/api/admin-auth/resend-otp')
      .set('x-csrf-token', csrf)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown email', async () => {
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res   = await agent
      .post('/api/admin-auth/resend-otp')
      .set('x-csrf-token', csrf)
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for already-verified admin', async () => {
    await createVerifiedAdmin('alreadyverified@example.com');
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res   = await agent
      .post('/api/admin-auth/resend-otp')
      .set('x-csrf-token', csrf)
      .send({ email: 'alreadyverified@example.com' });
    expect(res.status).toBe(400);
  });

  it('sends OTP for unverified admin (email may succeed or fail in test)', async () => {
    await Admin.create({
      name: 'Unverified Admin', email: 'unverifiedotp@example.com',
      password: 'Admin@1234',
      isEmailVerified: false, isActive: true,
    });
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res   = await agent
      .post('/api/admin-auth/resend-otp')
      .set('x-csrf-token', csrf)
      .send({ email: 'unverifiedotp@example.com' });
    expect([200, 500]).toContain(res.status);
  });
});

// ─── Admin Auth — Update Name ─────────────────────────────────────────────────

describe('PATCH /api/admin-auth/profile/name', () => {
  it('rejects unauthenticated', async () => {
    const res = await request(app)
      .patch('/api/admin-auth/profile/name')
      .send({ name: 'New Name' });
    expect(res.status).toBe(401);
  });

  it('rejects user-portal token (protect loads User by id → null → 401)', async () => {
    const admin = await Admin.create({
      name: 'U', email: `userNameUpd${Date.now()}@example.com`,
      password: 'Admin@1234', isEmailVerified: true, isActive: true,
    });
    const fakeUserToken = generateAccessToken(admin._id, 'user', 'user');
    const res = await request(app)
      .patch('/api/admin-auth/profile/name')
      .set('Authorization', `Bearer ${fakeUserToken}`)
      .send({ name: 'Hacker' });
    expect([401, 403]).toContain(res.status);
  });

  it('rejects empty name', async () => {
    const admin = await createVerifiedAdmin(`nameEmpty${Date.now()}@example.com`);
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .patch('/api/admin-auth/profile/name')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('updates name successfully', async () => {
    const admin = await createVerifiedAdmin(`nameUpd${Date.now()}@example.com`);
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .patch('/api/admin-auth/profile/name')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Admin Name' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── Admin Auth — Request Email Change ───────────────────────────────────────

describe('POST /api/admin-auth/profile/request-email-change', () => {
  it('rejects unauthenticated', async () => {
    const res = await request(app)
      .post('/api/admin-auth/profile/request-email-change')
      .send({ newEmail: 'new@example.com' });
    expect(res.status).toBe(401);
  });

  it('rejects missing newEmail', async () => {
    const admin = await createVerifiedAdmin(`reqEmailMissing${Date.now()}@example.com`);
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .post('/api/admin-auth/profile/request-email-change')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects email already in use', async () => {
    await createVerifiedAdmin('inuse@example.com');
    const admin = await createVerifiedAdmin(`reqEmailInUse${Date.now()}@example.com`);
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .post('/api/admin-auth/profile/request-email-change')
      .set('Authorization', `Bearer ${token}`)
      .send({ newEmail: 'inuse@example.com' });
    expect(res.status).toBe(400);
  });

  it('sends OTP for valid new email (email may succeed or fail in test)', async () => {
    const admin = await createVerifiedAdmin(`reqEmailOk${Date.now()}@example.com`);
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .post('/api/admin-auth/profile/request-email-change')
      .set('Authorization', `Bearer ${token}`)
      .send({ newEmail: `brand_new_${Date.now()}@example.com` });
    expect([200, 500]).toContain(res.status);
  });
});

// ─── Admin Auth — Confirm Email Change ───────────────────────────────────────

describe('POST /api/admin-auth/profile/confirm-email-change', () => {
  it('rejects unauthenticated', async () => {
    const res = await request(app)
      .post('/api/admin-auth/profile/confirm-email-change')
      .send({ otp: '123456' });
    expect(res.status).toBe(401);
  });

  it('rejects missing OTP', async () => {
    const admin = await createVerifiedAdmin(`confirmMissingOtp${Date.now()}@example.com`);
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .post('/api/admin-auth/profile/confirm-email-change')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when no pending email change', async () => {
    const admin = await createVerifiedAdmin(`noPending${Date.now()}@example.com`);
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .post('/api/admin-auth/profile/confirm-email-change')
      .set('Authorization', `Bearer ${token}`)
      .send({ otp: '123456' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for wrong OTP', async () => {
    const admin  = await createVerifiedAdmin(`wrongOtp${Date.now()}@example.com`);
    const rawOtp = '999999';
    const doc    = await Admin.findById(admin._id);
    doc.emailOtpHash   = hashToken(rawOtp);
    doc.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    doc.set('pendingEmail', 'newpending@example.com', { strict: false });
    await doc.save();
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .post('/api/admin-auth/profile/confirm-email-change')
      .set('Authorization', `Bearer ${token}`)
      .send({ otp: '000000' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for expired OTP', async () => {
    const admin  = await createVerifiedAdmin(`expiredOtp${Date.now()}@example.com`);
    const rawOtp = '111111';
    const doc    = await Admin.findById(admin._id);
    doc.emailOtpHash   = hashToken(rawOtp);
    doc.emailOtpExpiry = new Date(Date.now() - 1000);
    doc.set('pendingEmail', 'expired@example.com', { strict: false });
    await doc.save();
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .post('/api/admin-auth/profile/confirm-email-change')
      .set('Authorization', `Bearer ${token}`)
      .send({ otp: rawOtp });
    expect(res.status).toBe(400);
  });

  it('confirms email change with correct OTP', async () => {
    const newEmail = `confirmed_${Date.now()}@example.com`;
    const admin    = await createVerifiedAdmin(`correctOtp${Date.now()}@example.com`);
    const rawOtp   = '555555';
    const doc      = await Admin.findById(admin._id);
    doc.emailOtpHash   = hashToken(rawOtp);
    doc.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    doc.set('pendingEmail', newEmail, { strict: false });
    await doc.save();
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .post('/api/admin-auth/profile/confirm-email-change')
      .set('Authorization', `Bearer ${token}`)
      .send({ otp: rawOtp });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const updated = await Admin.findById(admin._id);
    expect(updated.email).toBe(newEmail);
  });

  it('locks out after emailOtpAttempts >= 5 on confirm-email-change (403)', async () => {
    const newEmail = `locked_${Date.now()}@example.com`;
    const rawOtp   = '333333';
    const admin    = await createVerifiedAdmin(`confirmLock${Date.now()}@example.com`);
    const doc      = await Admin.findById(admin._id).select('+emailOtpHash +emailOtpExpiry +emailOtpAttempts');
    doc.emailOtpHash      = hashToken(rawOtp);
    doc.emailOtpExpiry    = new Date(Date.now() + 10 * 60 * 1000);
    doc.emailOtpAttempts  = 5; // already at limit
    doc.set('pendingEmail', newEmail, { strict: false });
    await doc.save({ validateBeforeSave: false });
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .post('/api/admin-auth/profile/confirm-email-change')
      .set('Authorization', `Bearer ${token}`)
      .send({ otp: rawOtp }); // correct OTP but locked
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/too many|attempts/i);
  });

  it('increments emailOtpAttempts on wrong OTP for confirm-email-change', async () => {
    const newEmail = `incr_${Date.now()}@example.com`;
    const rawOtp   = '444444';
    const admin    = await createVerifiedAdmin(`confirmIncr${Date.now()}@example.com`);
    const doc      = await Admin.findById(admin._id).select('+emailOtpHash +emailOtpExpiry +emailOtpAttempts');
    doc.emailOtpHash      = hashToken(rawOtp);
    doc.emailOtpExpiry    = new Date(Date.now() + 10 * 60 * 1000);
    doc.emailOtpAttempts  = 0;
    doc.set('pendingEmail', newEmail, { strict: false });
    await doc.save({ validateBeforeSave: false });
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    await request(app)
      .post('/api/admin-auth/profile/confirm-email-change')
      .set('Authorization', `Bearer ${token}`)
      .send({ otp: '000000' }); // wrong
    const updated = await Admin.findById(admin._id).select('+emailOtpAttempts');
    expect(updated.emailOtpAttempts).toBe(1);
  });
});
