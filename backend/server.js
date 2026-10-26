/**
 * server.js — Express application entry point for M&B Jewelry API.
 *
 * MIDDLEWARE STACK ORDER (order is intentional — do not reorder without understanding):
 *   1. Sentry init           — must happen before any other requires that touch Express
 *   2. correlationId         — attach x-correlation-id to every request for distributed tracing
 *   3. Webhook route         — mounted with express.raw() BEFORE express.json() so raw body
 *                              bytes are preserved for Razorpay HMAC-SHA256 verification
 *   4. helmet                — sets secure HTTP headers (CSP, HSTS, etc.)
 *   5. cors                  — restrict origins to CLIENT_URL; allow credentials (cookies)
 *   6. Global rate limiter   — 1500 req/15 min per IP (raised to 10000 in test env)
 *   7. express.json()        — parse JSON request bodies (10 MB limit)
 *   8. cookieParser          — parse Cookie header (needed for refresh token + CSRF)
 *   9. mongoSanitize         — strip $ and . from request data → blocks NoSQL injection
 *  10. xssSanitize           — escape "<" in request data → blocks XSS via body (replaces deprecated xss-clean)
 *  11. attachCsrfCookie      — sets XSRF-TOKEN cookie on every response
 *  12. validateCsrf          — checks x-csrf-token header on all /api mutation requests
 *  13. morgan (HTTP logging) — skipped in test env
 *  14. Route handlers        — /api/* routes
 *  15. Sentry error handler  — must come before custom error handler
 *  16. notFound              — 404 for unmatched routes
 *  17. errorHandler          — global error normaliser (maps Mongoose/JWT/Multer errors)
 *
 * Admin routes (/api/admin, /api/admin-auth) additionally pass through adminIpWhitelist.
 *
 * Background jobs (non-test env only):
 *   cleanupStaleOrders() — every 2 min: asks Razorpay, confirms paid / fails unpaid (returns stock holds)
 *   reconcileRecentPayments() — every 6 h: recovers payments marked failed that Razorpay shows as paid
 *   purgeCancelledCustomOrderImages() — daily: deletes photos of custom orders cancelled > 30 days ago
 *
 * NODE_ENV=test: DB connection, stale-order cleanup, morgan, rate limiter all bypassed
 * so test files get a clean, deterministic server import.
 */
require('dotenv').config();
require('express-async-errors');

// ─── Critical env var assertions (fail fast before any server init) ───────────
// Skipped in test env — test files set their own values before requiring server.
if (process.env.NODE_ENV !== 'test' && !process.env.ADMIN_REGISTER_SECRET) {
  throw new Error('ADMIN_REGISTER_SECRET is not set. Admin registration would be open to anyone. Set this env var before starting the server.');
}

// ─── Sentry (must init before all other requires that touch Express) ──────────
const Sentry = require('@sentry/node');

// Optional profiling — only load if package is present
let profilingIntegrations = [];
try {
  const { nodeProfilingIntegration } = require('@sentry/profiling-node');
  profilingIntegrations = [nodeProfilingIntegration()];
} catch { /* profiling package not installed — skip */ }

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  integrations: profilingIntegrations,
  tracesSampleRate: 0.2,
  profilesSampleRate: 0.1,
  enabled: !!process.env.SENTRY_DSN,
});

// Force Google DNS for Node.js DNS resolver (fixes MongoDB Atlas SRV lookup issues)
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const { xssSanitize } = require('./middleware/xssSanitize');

const connectDB = require('./config/db');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { correlationId } = require('./middleware/correlationId');
const mongoose = require('mongoose');
const path = require('node:path');

// Route imports
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const adminRoutes = require('./routes/adminRoutes');
const customOrderRoutes = require('./routes/customOrderRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const dpAuthRoutes = require('./routes/dpAuthRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const { attachCsrfCookie, validateCsrf } = require('./middleware/csrf');

// Utils
const { cleanupStaleOrders } = require('./utils/cleanupStaleOrders');

// Connect to MongoDB, then start background jobs
if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    // Stale-payment cleanup: immediately on startup, then every 2 minutes (stock holds expire after 15).
    // It asks Razorpay before failing anything (utils/paymentReconcile.js). Never two runs at once.
    const { reconcileRecentPayments } = require('./utils/paymentReconcile');
    const singleFlight = (fn) => { let busy = false; return async () => { if (busy) return; busy = true; try { await fn(); } catch (e) { logger.error(`Background job failed: ${e.message}`); } finally { busy = false; } }; };
    const runCleanup = singleFlight(() => cleanupStaleOrders());
    const runSweep = singleFlight(() => reconcileRecentPayments());
    runCleanup();
    setInterval(runCleanup, 2 * 60 * 1000);
    // Safety sweep: payments marked failed in the last 48 h that Razorpay shows as paid → recovered
    setTimeout(runSweep, 60 * 1000);
    setInterval(runSweep, 6 * 60 * 60 * 1000);
    // Give every paid order (incl. ones paid before invoice numbering existed) its invoice number
    require('./utils/invoiceNumber').backfillInvoiceNumbers().catch((e) => require('./utils/logger').error(`Invoice backfill failed: ${e.message}`));
    // Daily: delete reference photos of custom orders cancelled more than 30 days ago
    const { purgeCancelledCustomOrderImages } = require('./utils/customOrderImages');
    const runPhotoPurge = singleFlight(() => purgeCancelledCustomOrderImages());
    setTimeout(runPhotoPurge, 10 * 60 * 1000);
    setInterval(runPhotoPurge, 24 * 60 * 60 * 1000);
    logger.info('Payment cleanup (every 2 min) + Razorpay reconcile sweep (every 6 h) started');
  });
}

const app = express();
app.disable('x-powered-by');

// ─── Trust Proxy ──────────────────────────────────────────────────────────────
// App runs behind a PaaS load balancer (see Procfile). Without this, req.ip is the
// proxy IP, not the client — which silently breaks rate limiters, adminIpWhitelist,
// and audit/session IP logging. '1' = trust the first hop (the platform proxy).
// Override via TRUST_PROXY env if your platform adds more hops.
// Env values are strings: Express treats '1' as an IP address, not a hop count.
// Numeric values → hop count; anything else (e.g. 'loopback, 10.0.0.0/8') passed through.
const trustProxyEnv = process.env.TRUST_PROXY;
app.set('trust proxy', trustProxyEnv === undefined || trustProxyEnv === ''
  ? 1
  : (/^\d+$/.test(trustProxyEnv) ? Number(trustProxyEnv) : trustProxyEnv));

// ─── Correlation ID ───────────────────────────────────────────────────────────
app.use(correlationId);

// ─── Webhook Route (must be BEFORE body parsers — needs raw body for HMAC) ───
app.use(
  '/api/webhook',
  express.raw({ type: 'application/json' }),
  webhookRoutes
);

// ─── Static Files (Bypass Helmet CSP for pure images) ─────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(
  cors({
    // CLIENT_URL may hold several comma-separated origins (e.g. apex + www domain)
    origin: [
      ...(process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((o) => o.trim()).filter(Boolean),
      // Dev-only Vite origin — excluded in production
      ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5174'] : []),
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
    exposedHeaders: ['x-csrf-token'], // cross-domain frontend reads the CSRF token from here
  })
);

// Global rate limiter — skipped in test environment to prevent bleed between tests
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: process.env.NODE_ENV === 'test' ? 10000 : 1500,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── Data Sanitization ────────────────────────────────────────────────────────
// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xssSanitize());

// ─── CSRF Protection ──────────────────────────────────────────────────────────
// Attach CSRF cookie to all responses, validate on mutation requests
app.use(attachCsrfCookie);
app.use('/api', validateCsrf);

// ─── HTTP Logging ─────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.http(msg.trim()) },
    })
  );
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'M&B Jewelry API is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/ready', async (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  if (dbState !== 1) {
    return res.status(503).json({ success: false, message: 'Database not ready', dbState });
  }
  res.json({ success: true, message: 'Ready', dbState });
});

// ─── Sitemap (public; served as https://mbjewellers.store/sitemap.xml via Netlify) ───
app.get('/api/sitemap.xml', require('./utils/sitemap').sitemapHandler);

// ─── IP check (setup aid for TRUST_PROXY) ─────────────────────────────────────
// Shows the caller ONLY their own address as this server sees it, plus the proxy chain.
// Open it from a phone: "ipSeenByServer" must equal your real IP (whatismyip). If it shows a
// 152.233.x.x / proxy address instead, raise TRUST_PROXY in Railway by 1 and check again.
app.get('/api/ip-check', (req, res) => {
  const chain = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
  res.set('Cache-Control', 'no-store');
  res.json({
    ipSeenByServer: req.ip,
    forwardedChain: chain,
    proxyHopsInChain: chain.length,
    trustProxySetting: app.get('trust proxy'),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const adminIpWhitelist = require('./middleware/adminIpWhitelist');

app.use('/api/auth', authRoutes);
app.use('/api/admin-auth', adminIpWhitelist, require('./routes/adminAuthRoutes'));
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin', adminIpWhitelist, adminRoutes);
app.use('/api/custom-orders', customOrderRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/dp-auth', dpAuthRoutes);
app.use('/api/subscribe', require('./routes/subscriberRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));

// ─── Error Handling ───────────────────────────────────────────────────────────
Sentry.setupExpressErrorHandler(app);
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    logger.info(`🚀 M&B Jewelry API running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    logger.error(`Unhandled Rejection: ${err.stack}`);
    server.close(() => process.exit(1));
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught Exception: ${err.stack}`);
    process.exit(1);
  });
}

module.exports = app;

