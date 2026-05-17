const winston = require('winston');

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const isProd = process.env.NODE_ENV === 'production';

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
      filename: 'logs/error.log',
      level: 'error',
      format: combine(timestamp(), errors({ stack: true }), winston.format.json()),
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: combine(timestamp(), winston.format.json()),
    }),
  ],
});

module.exports = logger;
