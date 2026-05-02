const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const adminEmail = 'admin@mbjewelry.com';

    // Check if admin already exists
    const adminExists = await User.findOne({ email: adminEmail });

    if (adminExists) {
      console.log('Admin user already exists!');
      process.exit();
    }

    // Create a new admin
    const admin = new User({
      name: 'Admin User',
      email: adminEmail,
      password: 'AdminPassword123!',
      role: 'admin',
    });

    await admin.save();
    console.log('Admin user seeded successfully!');
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

seedAdmin();
