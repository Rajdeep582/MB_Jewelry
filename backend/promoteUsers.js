require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const User = require('./models/User');

const updateUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const res = await User.updateOne({ email: 'rajdeepbiswas272@gmail.com' }, { role: 'admin' });
    if (res.matchedCount === 0) {
      console.log('User not found. Please make sure the account is registered first.');
    } else {
      console.log('Successfully upgraded rajdeepbiswas272@gmail.com to Admin!');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
updateUsers();
