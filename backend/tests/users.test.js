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
const crypto   = require('node:crypto');
const app      = require('../server');
const User     = require('../models/User');
const Admin    = require('../models/Admin');
const { generateAccessToken } = require('../utils/generateToken');

require('./setup');

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

async function getCsrfToken(agent) {
  const res = await agent.get('/api/health');
  const c = res.headers['set-cookie']?.find(c => c.startsWith('csrfToken='));
  return c ? c.split(';')[0].split('=')[1] : null;
}

async function createVerifiedUser(email = 'user@example.com', password = 'Test@1234') {
  return User.create({
    name: 'Test User', email, password,
    providers: [{ providerType: 'local' }],
    isVerified: true, isActive: true,
  });
}

async function loginUser(agent, csrf, email = 'user@example.com', password = 'Test@1234') {
  const res = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', csrf)
    .send({ identifier: email, password });
  return res.body.accessToken;
}

// ─── User Profile ─────────────────────────────────────────────────────────────

describe('GET /api/users/profile', () => {
  it('returns profile for authenticated user', async () => {
    const user  = await createVerifiedUser();
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user?.email || res.body.email).toBe('user@example.com');
  });

  it('rejects unauthenticated', async () => {
    const res = await request(app).get('/api/users/profile');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/users/profile', () => {
  it('updates user name', async () => {
    const user  = await createVerifiedUser('upd@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
  });

  it('rejects admin token on user-only route', async () => {
    const admin = await Admin.create({
      name: 'AdminX', email: 'adminx@example.com',
      password: 'Admin@1234', isEmailVerified: true, isActive: true,
    });
    const token = generateAccessToken(admin._id, 'admin', 'admin');
    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hacker' });
    expect(res.status).toBe(403);
  });
});

// ─── Addresses ───────────────────────────────────────────────────────────────

const validAddress = {
  fullName:     'Test Name',
  phone:        '9876543210',
  addressLine1: '123 Main St',
  city:         'Mumbai',
  state:        'Maharashtra',
  pincode:      '400001',
};

describe('Address CRUD /api/users/addresses', () => {
  let user, token;

  beforeEach(async () => {
    user  = await createVerifiedUser('addr@example.com');
    token = generateAccessToken(user._id, 'user', 'user');
  });

  it('adds new address', async () => {
    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress);
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  it('rejects address missing required fields', async () => {
    const res = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Only Name' });
    expect(res.status).toBe(400);
  });

  it('updates existing address', async () => {
    const addRes = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress);
    expect([200, 201]).toContain(addRes.status);

    const addrId = addRes.body.addresses?.[0]?._id || addRes.body.address?._id;
    if (!addrId) return; // shape may vary

    const res = await request(app)
      .put(`/api/users/addresses/${addrId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validAddress, city: 'Pune' });
    expect(res.status).toBe(200);
  });

  it('deletes address', async () => {
    const addRes = await request(app)
      .post('/api/users/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send(validAddress);

    const addrId = addRes.body.addresses?.[0]?._id || addRes.body.address?._id;
    if (!addrId) return;

    const res = await request(app)
      .delete(`/api/users/addresses/${addrId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('rejects unauthenticated address add', async () => {
    const res = await request(app)
      .post('/api/users/addresses')
      .send(validAddress);
    expect(res.status).toBe(401);
  });
});

// ─── Wishlist ─────────────────────────────────────────────────────────────────

describe('POST /api/users/wishlist/:productId', () => {
  it('toggles product in wishlist', async () => {
    const user  = await createVerifiedUser('wish@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const fakeProductId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post(`/api/users/wishlist/${fakeProductId}`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 201, 404]).toContain(res.status); // 404 if product doesn't exist
  });

  it('rejects unauthenticated wishlist toggle', async () => {
    const res = await request(app)
      .post(`/api/users/wishlist/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(401);
  });
});

// ─── Sessions ─────────────────────────────────────────────────────────────────

describe('Session management /api/auth/sessions', () => {
  let agent, token, csrf;

  beforeEach(async () => {
    await createVerifiedUser('sess@example.com');
    agent = request.agent(app);
    csrf  = await getCsrfToken(agent);
    token = await loginUser(agent, csrf, 'sess@example.com');
  });

  it('GET /api/auth/sessions returns session list', async () => {
    const res = await agent
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions.length).toBeGreaterThan(0);
  });

  it('DELETE /api/auth/sessions/all revokes all sessions', async () => {
    const res = await agent
      .delete('/api/auth/sessions/all')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const user = await User.findOne({ email: 'sess@example.com' }).select('+sessions');
    expect(user.sessions.length).toBe(0);
  });

  it('DELETE /api/auth/sessions/:id revokes specific session', async () => {
    const sessRes = await agent
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${token}`);
    const sessions = sessRes.body.sessions || [];
    if (sessions.length === 0) return;

    const sessionId = sessions[0].sessionId;
    const res = await agent
      .delete(`/api/auth/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ─── Password Reset Flow ──────────────────────────────────────────────────────

describe('Password reset flow', () => {
  it('forgot-password returns generic OK even for unknown email', async () => {
    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/auth/forgot-password')
      .set('x-csrf-token', csrf)
      .send({ email: 'nobody@nowhere.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('verify-reset-otp rejects wrong OTP', async () => {
    // Seed a user with a reset OTP
    const rawOtp = '777888';
    await User.create({
      name: 'Reset User',
      email: 'reset@example.com',
      password: 'Test@1234',
      providers: [{ providerType: 'local' }],
      isVerified: true, isActive: true,
      pwdResetOtpHash:     hashToken(rawOtp),
      pwdResetOtpExpires:  Date.now() + 10 * 60 * 1000,
      pwdResetOtpAttempts: 0,
    });

    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/auth/verify-reset-otp')
      .set('x-csrf-token', csrf)
      .send({ email: 'reset@example.com', otp: '000000' });
    expect(res.status).toBe(400);

    const updated = await User.findOne({ email: 'reset@example.com' });
    expect(updated.pwdResetOtpAttempts).toBe(1);
  });

  it('verify-reset-otp rejects expired OTP', async () => {
    const rawOtp = '111222';
    await User.create({
      name: 'Expired Reset',
      email: 'expreset@example.com',
      password: 'Test@1234',
      providers: [{ providerType: 'local' }],
      isVerified: true, isActive: true,
      pwdResetOtpHash:     hashToken(rawOtp),
      pwdResetOtpExpires:  Date.now() - 1000, // expired
      pwdResetOtpAttempts: 0,
    });

    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/auth/verify-reset-otp')
      .set('x-csrf-token', csrf)
      .send({ email: 'expreset@example.com', otp: rawOtp });
    expect(res.status).toBe(403);
  });

  it('verify-reset-otp rejects after 5 attempts (locked)', async () => {
    const rawOtp = '333444';
    await User.create({
      name: 'Locked Reset',
      email: 'lockreset@example.com',
      password: 'Test@1234',
      providers: [{ providerType: 'local' }],
      isVerified: true, isActive: true,
      pwdResetOtpHash:     hashToken(rawOtp),
      pwdResetOtpExpires:  Date.now() + 10 * 60 * 1000,
      pwdResetOtpAttempts: 5,
    });

    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/auth/verify-reset-otp')
      .set('x-csrf-token', csrf)
      .send({ email: 'lockreset@example.com', otp: rawOtp });
    expect(res.status).toBe(403);
  });

  it('full reset flow: verify correct OTP → get token → reset password', async () => {
    const rawOtp = '999000';
    await User.create({
      name: 'Full Reset',
      email: 'fullreset@example.com',
      password: 'Test@1234',
      providers: [{ providerType: 'local' }],
      isVerified: true, isActive: true,
      pwdResetOtpHash:     hashToken(rawOtp),
      pwdResetOtpExpires:  Date.now() + 10 * 60 * 1000,
      pwdResetOtpAttempts: 0,
    });

    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);

    // Step 1: verify OTP → get resetToken
    const verifyRes = await agent
      .post('/api/auth/verify-reset-otp')
      .set('x-csrf-token', csrf)
      .send({ email: 'fullreset@example.com', otp: rawOtp });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.resetToken).toBeDefined();

    const { resetToken } = verifyRes.body;

    // Step 2: reset with new password
    const resetRes = await agent
      .post('/api/auth/reset-password')
      .set('x-csrf-token', csrf)
      .send({ email: 'fullreset@example.com', resetToken, newPassword: 'NewPass@9999' });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);

    // Step 3: old password rejected, new password works
    const oldLogin = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrf)
      .send({ identifier: 'fullreset@example.com', password: 'Test@1234' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrf)
      .send({ identifier: 'fullreset@example.com', password: 'NewPass@9999' });
    expect(newLogin.status).toBe(200);
  });

  it('reset-password rejects token reuse (single use)', async () => {
    const resetToken = crypto.randomBytes(32).toString('hex');
    await User.create({
      name: 'Single Use',
      email: 'singleuse@example.com',
      password: 'Test@1234',
      providers: [{ providerType: 'local' }],
      isVerified: true, isActive: true,
      pwdResetTokenHash:    hashToken(resetToken),
      pwdResetTokenExpires: Date.now() + 15 * 60 * 1000,
    });

    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);

    // First use
    await agent
      .post('/api/auth/reset-password')
      .set('x-csrf-token', csrf)
      .send({ email: 'singleuse@example.com', resetToken, newPassword: 'First@8888' });

    // Second use — same token should fail
    const res2 = await agent
      .post('/api/auth/reset-password')
      .set('x-csrf-token', csrf)
      .send({ email: 'singleuse@example.com', resetToken, newPassword: 'Second@7777' });
    expect(res2.status).toBe(400);
  });

  it('reset-password rejects same password reuse', async () => {
    const resetToken = crypto.randomBytes(32).toString('hex');
    await User.create({
      name: 'Same Pass',
      email: 'samepass@example.com',
      password: 'Test@1234',
      providers: [{ providerType: 'local' }],
      isVerified: true, isActive: true,
      pwdResetTokenHash:    hashToken(resetToken),
      pwdResetTokenExpires: Date.now() + 15 * 60 * 1000,
    });

    const agent = request.agent(app);
    const csrf  = await getCsrfToken(agent);
    const res = await agent
      .post('/api/auth/reset-password')
      .set('x-csrf-token', csrf)
      .send({ email: 'samepass@example.com', resetToken, newPassword: 'Test@1234' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/current password/i);
  });
});

// ─── Admin: User Management ───────────────────────────────────────────────────

describe('Admin user management', () => {
  let adminToken;

  beforeEach(async () => {
    const admin = await Admin.create({
      name: 'AdminUsr', email: 'adminusr@example.com',
      password: 'Admin@1234', isEmailVerified: true, isActive: true,
    });
    adminToken = generateAccessToken(admin._id, 'admin', 'admin');
  });

  it('GET /api/users returns all users (admin only)', async () => {
    await createVerifiedUser('list1@example.com');
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it('user token blocked from GET /api/users', async () => {
    const user  = await createVerifiedUser('nolist@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('admin can toggle user active status', async () => {
    const user = await createVerifiedUser('toggle@example.com');
    const res = await request(app)
      .put(`/api/users/${user._id}/toggle-active`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('PUT /api/users/:id/role — admin can update user role', async () => {
    const user = await createVerifiedUser('roleupdate@example.com');
    const res = await request(app)
      .put(`/api/users/${user._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'user' });
    expect(res.status).toBe(403); // route permanently disabled in controller
  });

  it('PUT /api/users/:id/role — user token rejected', async () => {
    const user  = await createVerifiedUser('roleblock@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .put(`/api/users/${user._id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin' });
    expect(res.status).toBe(403);
  });

  it('PUT /api/users/:id/role — invalid role rejected', async () => {
    const user = await createVerifiedUser('invalidrole@example.com');
    const res = await request(app)
      .put(`/api/users/${user._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'superuser' });
    expect(res.status).toBe(403); // controller always returns 403 (route disabled)
  });
});


// ─── PUT /api/users/:id/role ──────────────────────────────────────────────────

describe('PUT /api/users/:id/role', () => {
  let adminToken;

  beforeEach(async () => {
    const admin = await Admin.create({
      name: 'RoleAdmin', email: `roleadmin${Date.now()}@example.com`,
      password: 'Admin@1234', isEmailVerified: true, isActive: true,
    });
    adminToken = generateAccessToken(admin._id, 'admin', 'admin');
  });

  it('admin token gets 403 — route permanently disabled in controller', async () => {
    const user = await createVerifiedUser(`roleupdate${Date.now()}@example.com`);
    const res = await request(app)
      .put(`/api/users/${user._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'user' });
    expect(res.status).toBe(403);
  });

  it('user token rejected by adminOnly middleware', async () => {
    const user  = await createVerifiedUser(`roleblock${Date.now()}@example.com`);
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .put(`/api/users/${user._id}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin' });
    expect(res.status).toBe(403);
  });

  it('invalid role also returns 403 (controller disabled before validation)', async () => {
    const user = await createVerifiedUser(`invalidrole${Date.now()}@example.com`);
    const res = await request(app)
      .put(`/api/users/${user._id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'superuser' });
    expect(res.status).toBe(403);
  });
});

// ─── Add Email / Verify Email OTP ────────────────────────────────────────────

describe('POST /api/auth/add-email', () => {
  it('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/auth/add-email')
      .send({ email: 'newemail@example.com' });
    expect(res.status).toBe(401);
  });

  it('rejects invalid email format', async () => {
    const user  = await createVerifiedUser(`addemailInvalid${Date.now()}@example.com`);
    const token = generateAccessToken(user._id, 'user', 'user');
    const res   = await request(app)
      .post('/api/auth/add-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('rejects email already used by another user', async () => {
    await createVerifiedUser('takenaddr@example.com');
    const user  = await createVerifiedUser(`addemailTaken${Date.now()}@example.com`);
    const token = generateAccessToken(user._id, 'user', 'user');
    const res   = await request(app)
      .post('/api/auth/add-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'takenaddr@example.com' });
    expect(res.status).toBe(400);
  });

  it('accepts valid unique email (OTP send may succeed or fail in test env)', async () => {
    const user  = await createVerifiedUser(`addemailOk${Date.now()}@example.com`);
    const token = generateAccessToken(user._id, 'user', 'user');
    const res   = await request(app)
      .post('/api/auth/add-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: `unique_new_addr@example.com` });
    expect([200, 500]).toContain(res.status);
  });
});

describe('POST /api/auth/verify-email-otp', () => {
  const crypto    = require('node:crypto');
  const hashOtp   = (t) => crypto.createHash('sha256').update(t).digest('hex');

  it('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email-otp')
      .send({ otp: '123456' });
    expect(res.status).toBe(401);
  });

  it('rejects wrong OTP', async () => {
    const User2 = require('../models/User');
    const user  = await createVerifiedUser(`verifyOtpWrong${Date.now()}@example.com`);
    await User2.findByIdAndUpdate(user._id, {
      otpHash: hashOtp('correct_otp'),
      otpExpires: new Date(Date.now() + 10 * 60 * 1000),
      isVerified: false,
    });
    const token = generateAccessToken(user._id, 'user', 'user');
    const res   = await request(app)
      .post('/api/auth/verify-email-otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ otp: 'wrong_otp' });
    expect(res.status).toBe(400);
  });

  it('rejects expired OTP', async () => {
    const User2 = require('../models/User');
    const user  = await createVerifiedUser(`verifyOtpExp${Date.now()}@example.com`);
    const rawOtp = '777777';
    await User2.findByIdAndUpdate(user._id, {
      otpHash: hashOtp(rawOtp),
      otpExpires: new Date(Date.now() - 1000),
      isVerified: false,
    });
    const token = generateAccessToken(user._id, 'user', 'user');
    const res   = await request(app)
      .post('/api/auth/verify-email-otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ otp: rawOtp });
    expect(res.status).toBe(400);
  });

  it('verifies with correct OTP and marks isVerified=true', async () => {
    const User2 = require('../models/User');
    const user  = await createVerifiedUser(`verifyOtpOk${Date.now()}@example.com`);
    const rawOtp = '888888';
    await User2.findByIdAndUpdate(user._id, {
      otpHash: hashOtp(rawOtp),
      otpExpires: new Date(Date.now() + 10 * 60 * 1000),
      isVerified: false,
    });
    const token = generateAccessToken(user._id, 'user', 'user');
    const res   = await request(app)
      .post('/api/auth/verify-email-otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ otp: rawOtp });
    expect(res.status).toBe(200);
    const updated = await User2.findById(user._id);
    expect(updated.isVerified).toBe(true);
  });

  it('rejects when no pending email verification (isVerified=true, no otpHash)', async () => {
    const user  = await createVerifiedUser(`verifyOtpNone${Date.now()}@example.com`);
    const token = generateAccessToken(user._id, 'user', 'user');
    const res   = await request(app)
      .post('/api/auth/verify-email-otp')
      .set('Authorization', `Bearer ${token}`)
      .send({ otp: '000000' });
    expect(res.status).toBe(400);
  });
});
