require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

const baseURL = 'http://localhost:5000/api';

async function testFlow() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) throw new Error('No admin!');
    
    // sign token manually
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Get a category
    const catRes = await axios.get(`${baseURL}/categories`);
    const categoryId = catRes.data.categories[0]?._id;
    if (!categoryId) throw new Error('No categories found to link product strictly');

    // Create a dummy image
    fs.writeFileSync('dummy1.png', 'fake image content 1');
    fs.writeFileSync('dummy2.png', 'fake image content 2');

    const fd1 = new FormData();
    fd1.append('name', 'Test Product API');
    fd1.append('description', 'A test product to check API');
    fd1.append('price', '1000');
    fd1.append('stock', '10');
    fd1.append('material', 'Gold');
    fd1.append('type', 'Ring');
    fd1.append('category', categoryId);
    fd1.append('images', fs.createReadStream('dummy1.png'));

    console.log('Creating Product...');
    const createRes = await axios.post(`${baseURL}/products`, fd1, {
      headers: { ...fd1.getHeaders(), Authorization: `Bearer ${token}` }
    });
    const productId = createRes.data.product._id;
    console.log('Created product:', productId);
    console.log('Images after create:', createRes.data.product.images);

    console.log('Updating Product Image...');
    const fd2 = new FormData();
    fd2.append('name', 'Test Product API - Updated');
    fd2.append('images', fs.createReadStream('dummy2.png'));
    fd2.append('replaceImages', 'true');

    const updateRes = await axios.put(`${baseURL}/products/${productId}`, fd2, {
      headers: { ...fd2.getHeaders(), Authorization: `Bearer ${token}` },
      validateStatus: false
    });
    if (updateRes.status !== 200) {
        console.error('Failed to update:', updateRes.data);
    } else {
        console.log('Updated product successfully. images:', updateRes.data.product.images);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('API Error:', err.response?.data || err.message);
    process.exit(1);
  }
}

testFlow();
