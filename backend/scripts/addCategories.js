/**
 * Run once from backend dir:
 *   node scripts/addCategories.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');

const CATEGORIES = [
  { name: 'Bala', description: 'Traditional bala bangles' },
  { name: 'Gold Coin', description: 'Gold coins and bullion' },
];

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    for (const cat of CATEGORIES) {
      const exists = await Category.findOne({ name: { $regex: new RegExp(`^${cat.name}$`, 'i') } });
      if (exists) {
        console.log(`SKIP  — already exists: ${cat.name}`);
      } else {
        const created = await Category.create(cat);
        console.log(`ADDED — ${created.name} (${created._id})`);
      }
    }
    process.exit(0);
  })
  .catch((err) => { console.error(err.message); process.exit(1); });
