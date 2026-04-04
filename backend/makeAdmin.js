require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const User = require('./models/User');

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const email = 'admin@mbjewelry.com';
    let user = await User.findOne({ email });

    if (user) {
      user.role = 'admin';
      await user.save();
      console.log('Existing user updated to admin.');
    } else {
      user = new User({
        name: 'Super Admin',
        email,
        password: 'Password123!',
        role: 'admin',
      });
      await user.save();
      console.log('New admin user created.');
    }
    
    console.log(`Email: ${email}`);
    console.log(`Password: Password123!`);
    
    mongoose.connection.close();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

createAdmin();
