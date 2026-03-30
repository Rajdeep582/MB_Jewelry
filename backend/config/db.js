const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  let retries = 5;
  while (retries) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
      break;
    } catch (error) {
      retries -= 1;
      logger.error(`❌ MongoDB connection failed. Retries left: ${retries}`, error.message);
      if (retries === 0) {
        logger.error('All retries exhausted. Exiting.');
        process.exit(1);
      }
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
};

module.exports = connectDB;
