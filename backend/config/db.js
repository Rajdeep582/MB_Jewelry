const mongoose = require('mongoose');
const logger = require('../utils/logger');

const DB_OPTIONS = {
  serverSelectionTimeoutMS: 10000, // fail fast if Atlas unreachable
  socketTimeoutMS: 45000,          // drop idle sockets after 45s
  maxPoolSize: 10,                 // max concurrent connections
  minPoolSize: 2,                  // keep at least 2 warm
};

/**
 * deduplicateGlobalPricing — one-time startup cleanup for GlobalPricing collection.
 * Keeps the newest entry per material/purity/unit combination, deletes older duplicates.
 * Then calls syncIndexes() to ensure the unique compound index is in place.
 * Runs silently on every startup — safe if no duplicates exist (no-op).
 */
const deduplicateGlobalPricing = async () => {
  try {
    const GlobalPricing = require('../models/GlobalPricing');
    const all = await GlobalPricing.find({}).sort({ updatedAt: -1 }).lean();
    const seen = new Set();
    const toDelete = [];
    for (const entry of all) {
      const key = `${entry.material}|${entry.purity}|${entry.unit}`;
      if (seen.has(key)) {
        toDelete.push(entry._id);
      } else {
        seen.add(key);
      }
    }
    if (toDelete.length > 0) {
      await GlobalPricing.deleteMany({ _id: { $in: toDelete } });
      logger.info(`🧹 GlobalPricing: removed ${toDelete.length} duplicate record(s)`);
    }
    // Ensure unique index is in sync after dedup
    await GlobalPricing.syncIndexes();
  } catch (err) {
    logger.warn(`GlobalPricing dedup skipped: ${err.message}`);
  }
};

/**
 * seedCategories — inserts default categories on first startup if they don't exist.
 * Idempotent: checks by slug before creating → safe to run on every boot.
 * Add new default categories to the seeds array as the product catalogue grows.
 */
const seedCategories = async () => {
  try {
    const Category = require('../models/Category');
    const seeds = [
      { name: 'Bala',      slug: 'bala',      description: 'Traditional bala bangles' },
      { name: 'Gold Coin', slug: 'gold-coin',  description: 'Gold coins and bullion'   },
    ];
    for (const cat of seeds) {
      const exists = await Category.findOne({ slug: cat.slug });
      if (!exists) {
        await Category.create(cat);
        logger.info(`🌱 Category seeded: ${cat.name}`);
      }
    }
  } catch (err) {
    logger.warn(`Category seed skipped: ${err.message}`);
  }
};

/**
 * connectDB — connects to MongoDB Atlas with retry logic.
 * Retries up to 5 times with a 5-second delay between attempts.
 * On final failure, calls process.exit(1) to crash the server intentionally
 * (better to fail loudly than run with no DB).
 * After connect: runs deduplicateGlobalPricing + seedCategories.
 */
const connectDB = async () => {
  let retries = 5;
  while (retries) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, DB_OPTIONS);
      logger.info(`✅ MongoDB Connected: ${conn.connection.host} | DB: ${conn.connection.name}`);
      await deduplicateGlobalPricing();
      await seedCategories();
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
