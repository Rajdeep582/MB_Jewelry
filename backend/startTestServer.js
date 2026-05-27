process.env.NODE_ENV = 'test';
const app = require('./server');
const connectDB = require('./config/db');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    logger.info(`🚀 M&B Jewelry Test API running on port ${PORT} in test mode`);
  });
}).catch(err => {
  logger.error('Failed to connect to database:', err);
  process.exit(1);
});
