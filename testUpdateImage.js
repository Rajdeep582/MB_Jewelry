const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

const run = async () => {
  try {
    const adminTokenRes = await axios.post('http://localhost:5000/api/users/login', {
      email: 'admin@mbjewelry.com',
      password: 'Admin@1234'
    });
    const token = adminTokenRes.data.accessToken;

    // Get a product
    const prods = await axios.get('http://localhost:5000/api/products');
    const firstProd = prods.data.products[0];
    console.log('Target product:', firstProd._id, firstProd.name);

    // Update product image
    const form = new FormData();
    form.append('replaceImages', 'true');
    // Using an existing file from the backend as a dummy image
    const dummyPath = path.join(__dirname, 'backend', 'generateMock.js'); 
    // Wait, let's just make a tiny txt file that looks like an image for multer
    fs.writeFileSync('test.jpg', 'fake image content');
    form.append('images', fs.createReadStream('test.jpg'));

    const updateRes = await axios.put(`http://localhost:5000/api/products/${firstProd._id}`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });

    console.log('Update result images:', updateRes.data.product.images);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
};

run();
