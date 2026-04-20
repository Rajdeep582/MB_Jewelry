require('dotenv').config();
const mongoose = require('mongoose');
const cloudinary = require('./config/cloudinary');
const Product = require('./models/Product');
const CustomOrder = require('./models/CustomOrder');
// const Category = require('./models/Category'); // add if needed
const path = require('path');
const fs = require('fs');

async function migrateImages() {
    console.log('Connecting to DB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    // Migration for Products
    console.log('Fetching products with local images...');
    const products = await Product.find({ 'images.url': { $regex: '^/uploads' } });
    console.log(`Found ${products.length} products to migrate.`);

    for (const product of products) {
        let updated = false;
        for (let i = 0; i < product.images.length; i++) {
            const img = product.images[i];
            if (img.url.startsWith('/uploads')) {
                const localPath = path.join(__dirname, img.url);
                if (fs.existsSync(localPath)) {
                    console.log(`Uploading ${localPath} to Cloudinary...`);
                    try {
                        const result = await cloudinary.uploader.upload(localPath, {
                            folder: 'mb_jewelry/products',
                            format: 'webp',
                            transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
                        });
                        product.images[i].url = result.secure_url;
                        product.images[i].publicId = result.public_id;
                        updated = true;
                        console.log(`Uploaded! New URL: ${result.secure_url}`);
                    } catch (err) {
                        console.error('Upload failed for', localPath, err.message);
                    }
                } else {
                    console.log(`File missing locally: ${localPath}`);
                }
            }
        }
        if (updated) {
            await product.save();
            console.log(`Updated Product: ${product._id}`);
        }
    }

    // Same logic would apply for CustomOrders if any local images exist
    console.log('Fetching custom orders with local images...');
    const orders = await CustomOrder.find({ 'referenceImages.url': { $regex: '^/uploads' } });
    console.log(`Found ${orders.length} custom orders to migrate.`);
    for (const order of orders) {
        let updated = false;
        for (let i = 0; i < order.referenceImages.length; i++) {
            const img = order.referenceImages[i];
            if (img.url.startsWith('/uploads')) {
                const localPath = path.join(__dirname, img.url);
                if (fs.existsSync(localPath)) {
                    console.log(`Uploading ${localPath} to Cloudinary...`);
                    try {
                        const result = await cloudinary.uploader.upload(localPath, {
                            folder: 'mb_jewelry/custom_orders',
                            format: 'webp',
                            transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
                        });
                        order.referenceImages[i].url = result.secure_url;
                        order.referenceImages[i].publicId = result.public_id;
                        updated = true;
                    } catch (err) {
                        console.error('Upload failed for', localPath, err.message);
                    }
                }
            }
        }
        if (updated) await order.save();
    }

    console.log('Migration complete!');
    process.exit(0);
}

migrateImages().catch(err => {
    console.error(err);
    process.exit(1);
});
