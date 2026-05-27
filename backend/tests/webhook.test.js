process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_32_chars_minimum!!';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_min!';
process.env.JWT_EXPIRE = '15m';
process.env.JWT_REFRESH_EXPIRE = '7d';
process.env.SENTRY_DSN = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret';

const crypto  = require('crypto');
const request = require('supertest');
const app     = require('../server');
const Order   = require('../models/Order');
const User    = require('../models/User');
const Category = require('../models/Category');
const Product  = require('../models/Product');

require('./setup');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sign(body) {
  return crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
}

function makeEvent(eventType, paymentOverrides = {}) {
  return JSON.stringify({
    event: eventType,
    payload: {
      payment: {
        entity: {
          id: 'pay_test123',
          order_id: 'rzp_order_test',
          status: eventType === 'payment.captured' ? 'captured' : 'failed',
          error_description: eventType === 'payment.failed' ? 'Insufficient funds' : undefined,
          ...paymentOverrides,
        },
      },
    },
  });
}

async function seedOrder(overrides = {}) {
  const user = await User.create({
    name: 'Webhook User', email: `wh${Date.now()}@example.com`,
    password: 'Test@1234',
    providers: [{ providerType: 'local' }],
    isVerified: true, isActive: true,
  });
  const cat  = await Category.create({ name: `WHCat${Date.now()}`, slug: `whcat${Date.now()}`, isActive: true });
  const prod = await Product.create({
    name: 'WH Ring', description: 'Webhook test product ring', price: 5000,
    category: cat._id, material: 'Gold', purity: '22K', stock: 10,
    images: [{ url: 'http://example.com/img.jpg', publicId: 'test/img' }],
  });
  return Order.create({
    user: user._id,
    items: [{ product: prod._id, quantity: 1, price: 5000, name: 'WH Ring', image: 'http://example.com/img.jpg' }],
    shippingAddress: { fullName: 'T', phone: '9999999999', addressLine1: 'A', city: 'B', state: 'C', pincode: '400001' },
    payment: {
      status: 'pending',
      method: 'razorpay',
      razorpayOrderId: 'rzp_order_test',
    },
    orderStatus: 'confirmed',
    itemsPrice: 5000, shippingPrice: 0, taxPrice: 150, totalAmount: 5150,
    ...overrides,
  });
}

// ─── Signature Verification ───────────────────────────────────────────────────

describe('POST /api/webhook/razorpay — signature verification', () => {
  it('returns 200 and rejects bad signature silently', async () => {
    const body = makeEvent('payment.captured');
    const res = await request(app)
      .post('/api/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'bad_signature')
      .send(body);
    // Webhook always ACKs 200 immediately; processing happens async
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('returns 200 with valid signature', async () => {
    const body = makeEvent('payment.captured');
    const res = await request(app)
      .post('/api/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('returns 200 even with missing signature header', async () => {
    const body = makeEvent('payment.captured');
    const res = await request(app)
      .post('/api/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
  });

  it('returns 200 even with malformed JSON body', async () => {
    const body = 'not-json';
    const res = await request(app)
      .post('/api/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);
  });
});

// ─── payment.captured — order confirmation ────────────────────────────────────

describe('Webhook payment.captured', () => {
  it('marks pending order as paid', async () => {
    const order = await seedOrder();
    const body = makeEvent('payment.captured', {
      order_id: order.payment.razorpayOrderId,
      id: 'pay_captured001',
    });

    await request(app)
      .post('/api/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(body))
      .send(body);

    // Give async processing a moment
    await new Promise(r => setTimeout(r, 300));

    const updated = await Order.findById(order._id);
    expect(updated.payment.status).toBe('paid');
    expect(updated.orderStatus).toBe('confirmed');
  });

  it('is idempotent — already-paid order stays paid, not double-processed', async () => {
    const order = await seedOrder({
      payment: { status: 'paid', method: 'razorpay', razorpayOrderId: `rzp_idem_${Date.now()}` },
      orderStatus: 'confirmed',
    });
    const body = makeEvent('payment.captured', {
      order_id: order.payment.razorpayOrderId,
      id: 'pay_dup001',
    });

    await request(app)
      .post('/api/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(body))
      .send(body);

    await new Promise(r => setTimeout(r, 300));

    const updated = await Order.findById(order._id);
    expect(updated.payment.status).toBe('paid');
    expect(updated.orderStatus).toBe('confirmed');
  });

  it('silently ignores unknown razorpayOrderId', async () => {
    const body = makeEvent('payment.captured', {
      order_id: 'rzp_nonexistent_999',
      id: 'pay_unknown',
    });

    const res = await request(app)
      .post('/api/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(body))
      .send(body);

    expect(res.status).toBe(200);
  });
});

// ─── payment.failed ───────────────────────────────────────────────────────────

describe('Webhook payment.failed', () => {
  it('marks pending order as failed', async () => {
    const order = await seedOrder({ payment: { status: 'pending', method: 'razorpay', razorpayOrderId: `rzp_fail_${Date.now()}` } });
    const body = makeEvent('payment.failed', {
      order_id: order.payment.razorpayOrderId,
      id: 'pay_fail001',
    });

    await request(app)
      .post('/api/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(body))
      .send(body);

    await new Promise(r => setTimeout(r, 300));

    const updated = await Order.findById(order._id);
    expect(updated.payment.status).toBe('failed');
    expect(updated.orderStatus).toBe('failed');
  });

  it('does not re-fail already-paid order', async () => {
    const order = await seedOrder({
      payment: { status: 'paid', method: 'razorpay', razorpayOrderId: `rzp_paidthen_${Date.now()}` },
      orderStatus: 'confirmed',
    });
    const body = makeEvent('payment.failed', {
      order_id: order.payment.razorpayOrderId,
      id: 'pay_fail_paid',
    });

    await request(app)
      .post('/api/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(body))
      .send(body);

    await new Promise(r => setTimeout(r, 300));

    const updated = await Order.findById(order._id);
    expect(updated.payment.status).toBe('paid');
    expect(updated.orderStatus).toBe('confirmed');
  });
});

// ─── Unknown event type ───────────────────────────────────────────────────────

describe('Webhook unknown event', () => {
  it('returns 200 and ignores unknown event type', async () => {
    const body = JSON.stringify({ event: 'refund.created', payload: {} });
    const res = await request(app)
      .post('/api/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sign(body))
      .send(body);
    expect(res.status).toBe(200);
  });
});

// ─── Missing webhook secret ───────────────────────────────────────────────────

describe('Webhook — missing RAZORPAY_WEBHOOK_SECRET', () => {
  it('still returns 200 but skips processing', async () => {
    const orig = process.env.RAZORPAY_WEBHOOK_SECRET;
    const body = makeEvent('payment.captured');
    const sig  = sign(body); // sign BEFORE deleting secret
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    const res = await request(app)
      .post('/api/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sig)
      .send(body);

    expect(res.status).toBe(200);
    process.env.RAZORPAY_WEBHOOK_SECRET = orig;
  });
});
