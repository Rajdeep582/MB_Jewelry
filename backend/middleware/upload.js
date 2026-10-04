const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const path = require('node:path');
const fs = require('node:fs');

/**
 * upload.js — Multer middleware configured for image uploads.
 *
 * STORAGE STRATEGY (auto-detected at startup):
 *   Cloudinary (production) — if CLOUDINARY_API_KEY is set and not placeholder:
 *     → Images streamed directly to Cloudinary CDN (cloudinaryStorage engine below)
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

/**
 * cloudinaryStorage — minimal multer storage engine that streams each file to Cloudinary.
 *
 * Replaces multer-storage-cloudinary@2, which calls `cloudinary.v2.uploader` on the object it
 * is given; our config already exports the v2 SDK, so that lookup was undefined and threw an
 * uncaught TypeError that crashed the whole API process on every image upload.
 *
 * Result shape matches what the controllers read: file.path = HTTPS URL, file.filename = public_id.
 * Upload errors are passed to multer (→ errorHandler → JSON response) — never thrown.
 */
function cloudinaryStorage({ folder, allowedFormats, transformation }) {
  return {
    _handleFile(req, file, cb) {
      let done = false;
      const finish = (err, info) => { if (!done) { done = true; cb(err, info); } };

      const upload = cloudinary.uploader.upload_stream(
        { folder, allowed_formats: allowedFormats, transformation, resource_type: 'image' },
        (err, result) => {
          if (err || !result) {
            const e = new Error(err?.message || 'Image upload failed. Please try again.');
            e.statusCode = err?.http_code && err.http_code < 500 ? 400 : 502;
            return finish(e);
          }
          finish(null, { path: result.secure_url, filename: result.public_id, size: result.bytes });
        }
      );
      file.stream.on('error', (err) => finish(err));
      file.stream.pipe(upload);
    },
    _removeFile(req, file, cb) {
      if (!file.filename) return cb(null);
      cloudinary.uploader.destroy(file.filename, { invalidate: true }, () => cb(null));
    },
  };
}

let productStorage, categoryStorage, customOrderStorage;

if (hasCloudinaryAuth) {
  productStorage = cloudinaryStorage({
    folder: 'mb_jewelry/products',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
  });

  categoryStorage = cloudinaryStorage({
    folder: 'mb_jewelry/categories',
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', quality: 'auto' }],
  });

  customOrderStorage = cloudinaryStorage({
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
      // Random hex + extension derived from the (already whitelisted) MIME type — never from
      // originalname, so "x.html" sent as image/png can't be served back as HTML.
      const MIME_EXT = { 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
      const ext = MIME_EXT[file.mimetype] || '.img';
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
    const err = new Error('Only JPEG, PNG, and WebP images are allowed');
    err.statusCode = 400;
    cb(err, false);
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

module.exports = { uploadProductImages, uploadCategoryImage, uploadCustomOrderImages, cloudinaryStorage };
