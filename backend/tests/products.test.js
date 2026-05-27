process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_32_chars_minimum!!';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_min!';
process.env.JWT_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '7d';
process.env.SENTRY_DSN = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
process.env.CLOUDINARY_CLOUD_NAME = '';

const request   = require('supertest');
const mongoose  = require('mongoose');
const app       = require('../server');
const User      = require('../models/User');
const Admin     = require('../models/Admin');
const Product   = require('../models/Product');
const Category  = require('../models/Category');
const Order     = require('../models/Order');
const Review    = require('../models/Review');
const { generateAccessToken } = require('../utils/generateToken');

require('./setup');

async function getCsrfToken(agent) {
  const res = await agent.get('/api/health');
  const c = res.headers['set-cookie']?.find(c => c.startsWith('csrfToken='));
  return c ? c.split(';')[0].split('=')[1] : null;
}

async function createVerifiedUser(email = 'user@example.com') {
  return User.create({
    name: 'Product User', email,
    password: 'Test@1234',
    providers: [{ providerType: 'local' }],
    isVerified: true, isActive: true,
  });
}

async function createVerifiedAdmin(email = 'admin@example.com') {
  return Admin.create({
    name: 'Admin', email,
    password: 'Admin@1234',
    isEmailVerified: true, isActive: true,
  });
}

async function createCategory(name = 'Rings') {
  return Category.create({ name, slug: name.toLowerCase().replace(/\s+/g, '-'), isActive: true });
}

async function createProduct(catId, overrides = {}) {
  return Product.create({
    name: 'Test Ring',
    description: 'A beautiful test ring for testing',
    price: 5000,
    category: catId,
    material: 'Gold',
    purity: '22K',
    stock: 10,
    images: [{ url: 'http://example.com/img.jpg', publicId: 'test/img' }],
    ...overrides,
  });
}

// ─── Categories — Public ──────────────────────────────────────────────────────

describe('GET /api/categories', () => {
  it('returns category list (public)', async () => {
    await createCategory('Necklaces');
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.categories)).toBe(true);
  });

  it('GET /api/categories/:id returns single category', async () => {
    const cat = await createCategory('Bracelets');
    const res = await request(app).get(`/api/categories/${cat._id}`);
    expect(res.status).toBe(200);
    expect(res.body.category.name).toBe('Bracelets');
  });

  it('returns 404 for unknown category id', async () => {
    const res = await request(app).get(`/api/categories/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(404);
  });
});

// ─── Categories — Admin CRUD ──────────────────────────────────────────────────

describe('Categories admin CRUD', () => {
  let adminToken;

  beforeEach(async () => {
    const admin = await createVerifiedAdmin();
    adminToken = generateAccessToken(admin._id, 'admin', 'admin');
  });

  it('admin can create category (no image)', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', 'Earrings')
      .field('description', 'Ear jewelry');
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  it('regular user cannot create category', async () => {
    const user = await createVerifiedUser('nocat@test.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .field('name', 'Anklets');
    expect(res.status).toBe(403);
  });

  it('admin can delete category', async () => {
    const cat = await createCategory('TempCat');
    const res = await request(app)
      .delete(`/api/categories/${cat._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204]).toContain(res.status);
  });

  it('rejects category with duplicate name', async () => {
    await createCategory('Bangles');
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', 'Bangles');
    expect(res.status).toBe(400);
  });
});

// ─── Products — Public ────────────────────────────────────────────────────────

describe('GET /api/products', () => {
  let cat;
  beforeEach(async () => { cat = await createCategory(); });

  it('returns product list', async () => {
    await createProduct(cat._id);
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.products)).toBe(true);
  });

  it('supports pagination (page + limit)', async () => {
    await createProduct(cat._id, { name: 'P1' });
    await createProduct(cat._id, { name: 'P2' });
    const res = await request(app).get('/api/products?page=1&limit=1');
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeLessThanOrEqual(1);
  });

  it('filters by material', async () => {
    await createProduct(cat._id, { material: 'Silver', purity: 'Hallmarked' });
    const res = await request(app).get('/api/products?material=Silver');
    expect(res.status).toBe(200);
    const allSilver = res.body.products.every(p => p.material === 'Silver');
    expect(allSilver).toBe(true);
  });

  it('GET /api/products/:id returns product detail', async () => {
    const prod = await createProduct(cat._id);
    const res = await request(app).get(`/api/products/${prod._id}`);
    expect(res.status).toBe(200);
    expect(res.body.product._id.toString()).toBe(prod._id.toString());
  });

  it('returns 404 for unknown product id', async () => {
    const res = await request(app).get(`/api/products/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid product id', async () => {
    const res = await request(app).get('/api/products/not-an-id');
    expect(res.status).toBe(400);
  });

  it('GET /api/products/reviews/featured returns array', async () => {
    const res = await request(app).get('/api/products/reviews/featured');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reviews)).toBe(true);
  });

  it('GET /api/products/public/gst-rates returns rates', async () => {
    const res = await request(app).get('/api/products/public/gst-rates');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.rates)).toBe(true);
  });
});

// ─── Products — Admin CRUD ────────────────────────────────────────────────────

describe('Admin product CRUD', () => {
  let adminToken, cat;

  beforeEach(async () => {
    const admin = await createVerifiedAdmin('admin2@example.com');
    adminToken  = generateAccessToken(admin._id, 'admin', 'admin');
    cat         = await createCategory('AdminCat');
  });

  it('admin can delete product', async () => {
    const prod = await createProduct(cat._id);
    const res = await request(app)
      .delete(`/api/products/${prod._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204]).toContain(res.status);
    const gone = await Product.findById(prod._id);
    expect(gone).toBeNull();
  });

  it('unauthenticated user cannot delete product', async () => {
    const prod = await createProduct(cat._id);
    const res = await request(app).delete(`/api/products/${prod._id}`);
    expect(res.status).toBe(401);
  });

  it('regular user cannot delete product', async () => {
    const user  = await createVerifiedUser('nodel@example.com');
    const token = generateAccessToken(user._id, 'user', 'user');
    const prod  = await createProduct(cat._id);
    const res = await request(app)
      .delete(`/api/products/${prod._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('delete returns 400 for invalid id', async () => {
    const res = await request(app)
      .delete('/api/products/bad-id')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('delete returns 404 for non-existent product', async () => {
    const res = await request(app)
      .delete(`/api/products/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ─── Reviews ─────────────────────────────────────────────────────────────────

describe('POST /api/products/:id/review', () => {
  let cat, prod, user, token;

  beforeEach(async () => {
    cat   = await createCategory('ReviewCat');
    prod  = await createProduct(cat._id);
    user  = await createVerifiedUser('reviewer@example.com');
    token = generateAccessToken(user._id, 'user', 'user');
  });

  it('rejects review from non-purchaser', async () => {
    const res = await request(app)
      .post(`/api/products/${prod._id}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, comment: 'Amazing product, loved it!' });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/verified purchaser/i);
  });

  it('accepts review from verified purchaser', async () => {
    // Create a delivered+paid order for this user+product
    await Order.create({
      user: user._id,
      items: [{ product: prod._id, quantity: 1, price: 5000, name: 'Test Ring', image: 'http://example.com/img.jpg' }],
      shippingAddress: { fullName: 'T', phone: '9999999999', addressLine1: 'A', city: 'B', state: 'C', pincode: '400001' },
      payment: { status: 'paid', method: 'razorpay' },
      orderStatus: 'delivered',
      itemsPrice: 5000, shippingPrice: 0, taxPrice: 150, totalAmount: 5150,
    });

    const res = await request(app)
      .post(`/api/products/${prod._id}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, comment: 'Amazing product, loved it so much!' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.numReviews).toBe(1);
  });

  it('rejects review with invalid rating (0)', async () => {
    const res = await request(app)
      .post(`/api/products/${prod._id}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 0, comment: 'Some comment here' });
    expect(res.status).toBe(400);
  });

  it('rejects review with short comment (<10 chars)', async () => {
    const res = await request(app)
      .post(`/api/products/${prod._id}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 4, comment: 'Short' });
    expect(res.status).toBe(400);
  });

  it('rejects review without auth', async () => {
    const res = await request(app)
      .post(`/api/products/${prod._id}/review`)
      .send({ rating: 5, comment: 'Great product!' });
    expect(res.status).toBe(401);
  });

  it('upserts review — re-submitting updates existing', async () => {
    await Order.create({
      user: user._id,
      items: [{ product: prod._id, quantity: 1, price: 5000, name: 'Test Ring', image: 'http://example.com/img.jpg' }],
      shippingAddress: { fullName: 'T', phone: '9999999999', addressLine1: 'A', city: 'B', state: 'C', pincode: '400001' },
      payment: { status: 'paid', method: 'razorpay' },
      orderStatus: 'delivered',
      itemsPrice: 5000, shippingPrice: 0, taxPrice: 150, totalAmount: 5150,
    });

    await request(app)
      .post(`/api/products/${prod._id}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 3, comment: 'Decent product overall' });

    const res2 = await request(app)
      .post(`/api/products/${prod._id}/review`)
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5, comment: 'Changed my mind, excellent quality!' });

    expect(res2.status).toBe(200);
    // numReviews should still be 1 (upsert, not duplicate)
    expect(res2.body.numReviews).toBe(1);
    expect(res2.body.averageRating).toBe(5);
  });
});
