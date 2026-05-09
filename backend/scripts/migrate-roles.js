/**
 * Migration: separate roles into dedicated collections.
 *
 * Run once:  node backend/scripts/migrate-roles.js
 *
 * What it does:
 *   1. Finds all users with role='admin'    → copies to admins collection
 *   2. Finds all users with role='delivery' → copies to deliverypartners collection
 *   3. Does NOT delete original records (safe)
 *   4. Skips duplicates (idempotent)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch(e) {}

const mongoose = require('mongoose');
const User = require('../models/User');
const Admin = require('../models/Admin');
const DeliveryPartner = require('../models/DeliveryPartner');

async function migrate() {
  console.log('Connecting to MongoDB...');
  let connected = false;
  let retries = 5;
  while (retries > 0 && !connected) {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      connected = true;
    } catch (err) {
      console.log('Connection failed, retrying...', err.message);
      retries--;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!connected) throw new Error('Could not connect to MongoDB');
  console.log('Connected.\n');

  // ── Migrate Admins ──────────────────────────────────────────────────────────
  const admins = await User.find({ role: 'admin' }).select('+password').lean();
  console.log(`Found ${admins.length} admin(s) in users collection.`);

  let adminCreated = 0, adminSkipped = 0;
  for (const u of admins) {
    const exists = await Admin.findOne({ email: u.email });
    if (exists) { adminSkipped++; continue; }
    await Admin.create({
      name: u.name,
      email: u.email,
      password: u.password || '$2a$10$temporaryunusablehash', // already hashed — bypass pre-save hash
      avatar: u.avatar || '',
      isActive: u.isActive !== false,
      lastLogin: u.lastLogin,
      createdAt: u.createdAt,
      auditLogs: [{ action: 'MIGRATED', details: `Migrated from users._id=${u._id}`, timestamp: new Date() }],
    });
    // Skip password re-hash — set directly
    await Admin.collection.updateOne(
      { email: u.email },
      { $set: { password: u.password } }
    );
    adminCreated++;
  }
  console.log(`Admins — created: ${adminCreated}, skipped (already exist): ${adminSkipped}`);

  // ── Migrate Delivery Partners ───────────────────────────────────────────────
  const dps = await User.find({ role: 'delivery' }).select('+password').lean();
  console.log(`\nFound ${dps.length} delivery partner(s) in users collection.`);

  let dpCreated = 0, dpSkipped = 0;
  for (const u of dps) {
    const exists = await DeliveryPartner.findOne({ email: u.email });
    if (exists) { dpSkipped++; continue; }
    await DeliveryPartner.create({
      name: u.name,
      email: u.email,
      password: u.password || '$2a$10$temporaryunusablehash',
      phone: u.phone || '',
      vehicleNumber: u.vehicleNumber || '',
      dispatchZone: u.dispatchZone || '',
      avatar: u.avatar || '',
      isActive: u.isActive !== false,
      isApproved: true, // existing delivery partners are already approved
      lastLogin: u.lastLogin,
      createdAt: u.createdAt,
      auditLogs: [{ action: 'MIGRATED', details: `Migrated from users._id=${u._id}`, timestamp: new Date() }],
    });
    // Bypass password re-hash
    await DeliveryPartner.collection.updateOne(
      { email: u.email },
      { $set: { password: u.password } }
    );
    dpCreated++;
  }
  console.log(`Delivery Partners — created: ${dpCreated}, skipped (already exist): ${dpSkipped}`);

  console.log('\nMigration complete. Original users collection untouched.');
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
