process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_32_chars_minimum!!';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_min!';
process.env.JWT_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '7d';
process.env.SENTRY_DSN = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
process.env.CLOUDINARY_CLOUD_NAME = '';


const request = require('supertest');
const app = require('../server');
const User = require('../models/User');

require('./setup');

async function getCsrfToken(agent) {
  const res = await agent.get('/api/health');
  const cookie = res.headers['set-cookie']?.find(c => c.startsWith('csrfToken='));
  return cookie ? cookie.split(';')[0].split('=')[1] : null;
}

async function createVerifiedUser(email = 'sec@example.com') {
  return User.create({
    name: 'Security User',
    email,
    password: 'Test@1234',
    providers: [{ providerType: 'local' }],
    isVerified: true,
    isActive: true,
  });
}

// ─── CSRF ─────────────────────────────────────────────────────────────────────

describe('CSRF protection', () => {
  // NODE_ENV=test bypasses validateCsrf (by design). Unit-test the middleware directly.
  it('blocks mismatched CSRF token (unit)', () => {
    const { validateCsrf } = require('../middleware/csrf');
    const req = { method: 'POST', cookies: { csrfToken: 'abc' }, headers: { 'x-csrf-token': 'wrong' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    validateCsrf(req, res, next);
    process.env.NODE_ENV = orig;
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes matching CSRF token (unit)', () => {
    const { validateCsrf } = require('../middleware/csrf');
    const req = { method: 'POST', cookies: { csrfToken: 'xyz' }, headers: { 'x-csrf-token': 'xyz' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    validateCsrf(req, res, next);
    process.env.NODE_ENV = orig;
    expect(next).toHaveBeenCalled();
  });

  it('skips CSRF check on GET (unit)', () => {
    const { validateCsrf } = require('../middleware/csrf');
    const req = { method: 'GET', cookies: {}, headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    validateCsrf(req, res, next);
    process.env.NODE_ENV = orig;
    expect(next).toHaveBeenCalled();
  });

  it('GET /api/health accessible without CSRF', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});

// ─── Authentication boundary ──────────────────────────────────────────────────

describe('Auth boundary', () => {
  it('rejects tampered JWT', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.tampered.signature');
    expect(res.status).toBe(401);
  });

  it('rejects expired-format JWT secret mismatch', async () => {
    const jwt = require('jsonwebtoken');
    const fakeToken = jwt.sign({ id: '507f1f77bcf86cd799439011', userType: 'user' }, 'wrong_secret');
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${fakeToken}`);
    expect(res.status).toBe(401);
  });

  it('user token cannot access admin routes', async () => {
    const agent = request.agent(app);
    const csrf = await getCsrfToken(agent);
    await createVerifiedUser();
    const login = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrf)
      .send({ identifier: 'sec@example.com', password: 'Test@1234' });
    const token = login.body.accessToken;

    // Admin-only routes: GET /api/orders (all orders) and GET /api/users (all users)
    const adminRoutes = [
      ['GET', '/api/orders'],
      ['GET', '/api/users'],
    ];
    for (const [method, route] of adminRoutes) {
      const res = await agent[method.toLowerCase()](route)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    }
  });
});

// ─── Health / Ready ───────────────────────────────────────────────────────────

describe('Health endpoints', () => {
  it('GET /api/health returns 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/ready returns 200 when DB connected', async () => {
    const res = await request(app).get('/api/ready');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('correlation ID present in response headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-correlation-id']).toBeDefined();
  });

  it('respects upstream x-correlation-id', async () => {
    const myId = 'test-trace-abc123';
    const res = await request(app)
      .get('/api/health')
      .set('x-correlation-id', myId);
    expect(res.headers['x-correlation-id']).toBe(myId);
  });
});

// ─── Input validation ─────────────────────────────────────────────────────────

describe('Input validation', () => {
  it('rejects XSS payload in name field', async () => {
    const agent = request.agent(app);
    const csrf = await getCsrfToken(agent);
    const res = await agent
      .post('/api/auth/register')
      .set('x-csrf-token', csrf)
      .send({
        name: '<script>alert(1)</script>',
        email: 'xss@example.com',
        password: 'Test@1234',
      });
    // Should either sanitize or reject — never echo raw script tag
    if (res.status === 201 || res.status === 200) {
      const user = await User.findOne({ email: 'xss@example.com' });
      expect(user?.name).not.toContain('<script>');
    } else {
      expect([400, 500]).toContain(res.status);
    }
  });

  it('rejects NoSQL injection in login identifier', async () => {
    const agent = request.agent(app);
    const csrf = await getCsrfToken(agent);
    const res = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrf)
      .send({ identifier: { $gt: '' }, password: 'anything' });
    // Should return 400 (validation) not 200
    expect(res.status).not.toBe(200);
  });

  it('dp-auth/register rejects invalid email', async () => {
    const agent = request.agent(app);
    const csrf = await getCsrfToken(agent);
    const res = await agent
      .post('/api/dp-auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: 'DP', email: 'not-an-email', password: 'Test@1234' });
    expect(res.status).toBe(400);
  });

  it('dp-auth/register rejects weak password', async () => {
    const agent = request.agent(app);
    const csrf = await getCsrfToken(agent);
    const res = await agent
      .post('/api/dp-auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: 'DP', email: 'dp@test.com', password: 'weakpass' });
    expect(res.status).toBe(400);
  });
});
