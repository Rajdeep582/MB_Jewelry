/**
 * Cloudinary configuration — image CDN for product images, category images, and avatars.
 * `secure: true` → all generated URLs use HTTPS regardless of request protocol.
 *
 * Required env vars:
 *   CLOUDINARY_CLOUD_NAME  — your Cloudinary cloud name
 *   CLOUDINARY_API_KEY     — API key (public, safe in server env)
 *   CLOUDINARY_API_SECRET  — API secret (NEVER expose to client)
 *
 * Usage: import this module and call cloudinary.uploader.upload() / cloudinary.uploader.destroy().
 */
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

module.exports = cloudinary;
