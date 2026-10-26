const path = require('node:path');
const winston = require('winston');

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const isProd = process.env.NODE_ENV === 'production';

// Log files always live in backend/logs (whatever folder the server is started from) and are
// size-capped: each file rolls over at 5 MB and only the newest 5 are kept (≤ 25 MB per log).
const LOG_DIR = path.join(__dirname, '../logs');
const ROTATE = { maxsize: 5 * 1024 * 1024, maxFiles: 5, tailable: true };

const logger = winston.createLogger({
  level: isProd ? 'warn' : 'debug',
  // Production: structured JSON (parseable by Datadog / CloudWatch / Loki).
  // Development: colorised human-readable output.
  format: isProd
    ? combine(timestamp(), errors({ stack: true }), winston.format.json())
    : combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), logFormat),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      ...ROTATE,
      format: combine(timestamp(), errors({ stack: true }), winston.format.json()),
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      ...ROTATE,
      format: combine(timestamp(), winston.format.json()),
    }),
  ],
});

module.exports = logger;
