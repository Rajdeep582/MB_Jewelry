const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const fs = require('fs');

const hasCloudinaryAuth = process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_KEY !== 'YOUR_API_KEY';

// Ensure uploads folder exists gracefully
if (!hasCloudinaryAuth) {
  const uploadDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

let productStorage, categoryStorage, customOrderStorage;

if (hasCloudinaryAuth) {
  productStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'mb_jewelry/products',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
    },
  });

  categoryStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'mb_jewelry/categories',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 400, height: 400, crop: 'fill', quality: 'auto' }],
    },
  });

  customOrderStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'mb_jewelry/custom_orders',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
    },
  });
} else {
  // Graceful fallback to local disk storage
  const createDiskStorage = (folderName) => multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '../uploads', folderName);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  });
  productStorage  = createDiskStorage('products');
  categoryStorage  = createDiskStorage('categories');
  customOrderStorage = createDiskStorage('custom_orders');
}

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
  }
};

const uploadProductImages = multer({
  storage: productStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 6 }, // max 5MB, 6 files
}).array('images', 6);

const uploadCategoryImage = multer({
  storage: categoryStorage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 }, // max 2MB
}).single('image');

const uploadCustomOrderImages = multer({
  storage: customOrderStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 4 }, // max 10MB, 4 reference images
}).array('referenceImages', 4);

module.exports = { uploadProductImages, uploadCategoryImage, uploadCustomOrderImages };
