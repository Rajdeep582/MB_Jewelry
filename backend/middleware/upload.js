const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const multerCloudinary = require('multer-storage-cloudinary'); // v2: factory fn, not constructor
const path = require('node:path');
const fs = require('node:fs');

/**
 * upload.js — Multer middleware configured for image uploads.
 *
 * STORAGE STRATEGY (auto-detected at startup):
 *   Cloudinary (production) — if CLOUDINARY_API_KEY is set and not placeholder:
 *     → Images uploaded directly to Cloudinary CDN via multer-storage-cloudinary
 *     → Transformed on upload (resize, quality=auto) to save storage
 *     → file.path = Cloudinary URL, file.filename = public_id
 *
 *   Local disk (development fallback) — if Cloudinary not configured:
 *     → Files saved to /uploads/<folder>/ inside backend
 *     → Filenames randomized (timestamp + hex) — never trust originalname (path traversal risk)
 *     → file.path = disk path, file.filename = random name
 *
 * EXPORTED MIDDLEWARE:
 *   uploadProductImages   — up to 6 images, max 5 MB each (field: 'images')
 *   uploadCategoryImage   — single image, max 2 MB (field: 'image')
 *   uploadCustomOrderImages — up to 4 reference images, max 10 MB each (field: 'referenceImages')
 *
 * FILE FILTER:
 *   JPEG, PNG, WebP only — MIME type checked (not extension) to prevent spoofing.
 */
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
  productStorage = multerCloudinary({
    cloudinary,
    folder: 'mb_jewelry/products',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
  });

  categoryStorage = multerCloudinary({
    cloudinary,
    folder: 'mb_jewelry/categories',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', quality: 'auto' }],
  });

  customOrderStorage = multerCloudinary({
    cloudinary,
    folder: 'mb_jewelry/custom_orders',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
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
      // Use random hex + extension only — never trust originalname (path traversal risk)
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
      cb(null, `${Date.now()}-${require('node:crypto').randomBytes(8).toString('hex')}${ext}`);
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
