const mongoose = require('mongoose');
const logger = require('../utils/logger');

const DB_OPTIONS = {
  serverSelectionTimeoutMS: 10000, // fail fast if Atlas unreachable
  socketTimeoutMS: 45000,          // drop idle sockets after 45s
  maxPoolSize: 10,                 // max concurrent connections
  minPoolSize: 2,                  // keep at least 2 warm
};

// One-time category seeder — idempotent, skips existing
const seedCategories = async () => {
  try {
    const Category = require('../models/Category');
    const seeds = [
      { name: 'Bala',      slug: 'bala',      description: 'Traditional bala bangles' },
      { name: 'Gold Coin', slug: 'gold-