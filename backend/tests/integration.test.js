const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

// Set test env before requiring app
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-12345';
process.env.JWT_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '7d';
process.env.RAZORPAY_KEY_ID = 'rzp_test_fake';
process.env.RAZORPAY_KEY_SECRET = 'fake_secret_key_for_testing';
process.env.SMTP_HOST = 'smtp.test.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@test.com';
process.env.SMTP_PASS = 'testpass';

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;

  await mongoose.connect(uri);
  app = require('../server');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// ─── Health Check ─────────────────────────────────────────────────────────────
describe('Health Check', () => {
  it('GET /api/health returns 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── Auth Flow ────────────────────────────────────────────────────────────────
describe('Auth Flow', () => {
  const testUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'Test@123!',
  };

  it('POST /api/auth/register creates user', async () => {
    jest.spyOn(require('../utils/email'), 'sendVerificationEmail').mockResolvedValue(true);

    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/auth/register rejects duplicate email', async () => {
    jest.spyOn(require('../utils/email'), 'sendVerificationEmail').mockResolvedValue(true);
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login fails for unverified user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    expect(res.status).toBe(403);
  });

  it('POST /api/auth/login fails with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: 'Wrong@123!' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login succeeds after verification', async () => {
    const User = require('../models/User');
    await User.findOneAndUpdate(
      { email: testUser.email },
      { isVerified: true }
    );

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(testUser.email);
  });
});

// ─── Products (Public) ────────────────────────────────────────────────────────
describe('Products API', () => {
  it('GET /api/products returns empty array when no products', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  it('GET /api/products/:id returns 404 for nonexistent id', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/products/${fakeId}`);
    expect(res.status).toBe(404);
  });
});

// ─── Categories (Public) ──────────────────────────────────────────────────────
describe('Categories API', () => {
  it('GET /api/categories returns empty array', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.categories)).toBe(true);
  });
});

// ─── Protected Routes (No Auth) ──────────────────────────────────────────────
describe('Protected Routes', () => {
  it('GET /api/orders/my-orders returns 401 without token', async () => {
    const res = await request(app).get('/api/orders/my-orders');
    expect(res.status).toBe(401);
  });

  it('POST /api/products returns 401 without token', async () => {
    const res = await request(app).post('/api/products');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/global-pricing returns 401 without token', async () => {
    const res = await request(app).get('/api/admin/global-pricing');
    expect(res.status).toBe(401);
  });
});

// ─── Admin Flows ──────────────────────────────────────────────────────────────
describe('Admin Flows', () => {
  let adminToken;

  beforeAll(async () => {
    const User = require('../models/User');
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(12);
    const hashedPw = await bcrypt.hash('Admin@123!', salt);

    await User.create({
      name: 'Admin',
      email: 'admin@test.com',
      password: hashedPw,
      role: 'admin',
      isVerified: true,
      isActive: true,
      providers: [{ providerType: 'local' }],
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'Admin@123!' });
    adminToken = res.body.accessToken;
  });

  it('GET /api/admin/global-pricing returns 200 for admin', async () => {
    const res = await request(app)
      .get('/api/admin/global-pricing')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/admin/global-pricing sets pricing', async () => {
    const res = await request(app)
      .post('/api/admin/global-pricing')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ material: 'Gold', purity: '22K', unit: 'gram', livePrice: 7500 });
    expect(res.status).toBe(200);
    expect(res.body.entry.livePrice).toBe(7500);
  });

  it('POST /api/admin/global-pricing rejects invalid purity', async () => {
    const res = await request(app)
      .post('/api/admin/global-pricing')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ material: 'Gold', purity: 'InvalidPurity', unit: 'gram', livePrice: 5000 });
    expect(res.status).toBe(400);
  });

  it('POST /api/products creates product with dynamic pricing', async () => {
    const Category = require('../models/Category');
    const cat = await Category.create({ name: 'Rings', description: 'Ring category' });

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', 'Gold Ring 22K')
      .field('description', 'A beautiful 22K gold ring')
      .field('category', cat._id.toString())
      .field('material', 'Gold')
      .field('purity', '22K')
      .field('weightValue', '10')
      .field('unit', 'gram')
      .field('stock', '5');

    expect(res.status).toBe(201);
    expect(res.body.product.pricingType).toBe('dynamic');
    // price = 7500 * 10 * 1.12 * 1.03 = 86520
    expect(res.body.product.price).toBe(86520);
  });

  it('Non-admin cannot access admin routes', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'Test@123!' });
    const userToken = loginRes.body.accessToken;

    const res = await request(app)
      .get('/api/admin/global-pricing')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── Order Schema Validation ─────────────────────────────────────────────────
describe('Order Schema Validation', () => {
  it('Order rejects invalid orderStatus "cancelled"', async () => {
    const Order = require('../models/Order');
    const order = new Order({
      user: new mongoose.Types.ObjectId(),
      items: [{ product: new mongoose.Types.ObjectId(), name: 'Test', image: 'test.jpg', price: 100, quantity: 1 }],
      shippingAddress: { fullName: 'Test', phone: '1234567890', addressLine1: '123 St', city: 'City', state: 'State', pincode: '123456' },
      payment: { status: 'pending' },
      itemsPrice: 100,
      totalAmount: 100,
      orderStatus: 'cancelled',
    });

    await expect(order.validate()).rejects.toThrow();
  });

  it('Order accepts valid orderStatus "failed"', async () => {
    const Order = require('../models/Order');
    const order = new Order({
      user: new mongoose.Types.ObjectId(),
      items: [{ product: new mongoose.Types.ObjectId(), name: 'Test', image: 'test.jpg', price: 100, quantity: 1 }],
      shippingAddress: { fullName: 'Test', phone: '1234567890', addressLine1: '123 St', city: 'City', state: 'State', pincode: '123456' },
      payment: { status: 'pending' },
      itemsPrice: 100,
      totalAmount: 100,
      orderStatus: 'failed',
    });

    await expect(order.validate()).resolves.toBeUndefined();
  });
});

// ─── Pricing Utils ────────────────────────────────────────────────────────────
describe('Pricing Utils', () => {
  const { calcDynamicPrice, buildPricingKey, resolvePricingEntry, applyLivePrice } = require('../utils/pricingUtils');

  it('calcDynamicPrice computes correctly', () => {
    expect(calcDynamicPrice(10, 7500, 12, 3)).toBe(86520);
  });

  it('buildPricingKey creates correct key', () => {
    expect(buildPricingKey('Gold', '22K', 'gram')).toBe('Gold|22K|gram');
  });

  it('resolvePricingEntry converts gram to kg', () => {
    const map = { 'Gold|22K|kg': { livePrice: 7500000, makingCharges: 12, gst: 3 } };
    const result = resolvePricingEntry(map, 'Gold', '22K', 'gram', 10);
    expect(result.pricing).toBeDefined();
    expect(result.effectiveWeight).toBe(0.01);
  });

  it('applyLivePrice skips static products', () => {
    const product = { pricingType: 'static', price: 5000 };
    const result = applyLivePrice(product, {});
    expect(result.price).toBe(5000);
  });
});

// ─── 404 Route ────────────────────────────────────────────────────────────────
describe('404 Handling', () => {
  it('Unknown route returns 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
