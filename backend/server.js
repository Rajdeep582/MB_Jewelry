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
 *  10. xss-clean             — sanitise HTML tags in request data → blocks XSS via body
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
 *   cleanupStaleOrders() — runs on startup + every 15 minutes via setInterval
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
const xss = require('xss-clean');

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
const { authLimiter } = require('./middleware/rateLimiter');

// Utils
const { cleanupStaleOrders } = require('./utils/cleanupStaleOrders');

// Connect to MongoDB, then start background jobs
if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    // Run stale order cleanup immediately on startup, then every 15 minutes
    cleanupStaleOrders();
    setInterval(() => cleanupStaleOrders(), 15 * 60 * 1000);
    logger.info('Stale-order cleanup scheduler started (every 15 min)');
  });
}

const app = express();
app.disable('x-powered-by');

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
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
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
app.use(xss());

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

