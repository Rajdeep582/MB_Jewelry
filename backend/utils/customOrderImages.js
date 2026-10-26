/**
 * customOrderImages.js — reference photos of custom orders: deletion + clean-up.
 *
 *   destroyCustomOrderImages(images) — delete stored photos (Cloudinary, or local disk in dev).
 *     Failures are logged, never thrown.
 *   purgeCancelledCustomOrderImages() — daily job: photos of custom orders CANCELLED more than
 *     RETENTION_DAYS ago are deleted from storage (the order record itself is kept). The delay
 *     leaves room for a late payment that reinstates a cancelled order, and for admin review.
 */
const fs = require('node:fs');
const path = require('node:path');
const cloudinary = require('../config/cloudinary');
const logger = require('./logger');

const RETENTION_DAYS = 30;
const BATCH = 50;

async function destroyCustomOrderImages(images = []) {
  let deleted = 0;
  for (const img of images) {
    if (!img?.publicId) continue;
    try {
      if (!img.url || img.url.includes('/uploads/')) {
        await fs.promises.unlink(path.join(__dirname, '../uploads/custom_orders', path.basename(img.publicId))).catch(() => {});
      } else {
        await cloudinary.uploader.destroy(img.publicId);
      }
      deleted += 1;
    } catch (err) {
      logger.warn(`Custom order image delete failed (${img.publicId}): ${err.message}`);
    }
  }
  return deleted;
}

/** Photos uploaded by multer for a request that is then rejected → delete them right away. */
function uploadedFilesAsImages(files = []) {
  return files.map((f) => ({ url: f.path?.startsWith('http') ? f.path : '/uploads/custom_orders/', publicId: f.filename }));
}

async function purgeCancelledCustomOrderImages({ retentionDays = RETENTION_DAYS } = {}) {
  const CustomOrder = require('../models/CustomOrder');
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const orders = await CustomOrder.find({
    status: 'cancelled',
    updatedAt: { $lt: cutoff },
    'referenceImages.0': { $exists: true },
  }).select('_id referenceImages').limit(BATCH).lean();

  let purged = 0;
  for (const o of orders) {
    await destroyCustomOrderImages(o.referenceImages);
    // Only if it is still cancelled (a reinstated order keeps its photos)
    const r = await CustomOrder.updateOne(
      { _id: o._id, status: 'cancelled' },
      { $set: { referenceImages: [], imagesPurgedAt: new Date() } },
      { timestamps: false }
    );
    if (r.modifiedCount) purged += 1;
  }
  if (purged) logger.info(`Custom order photos removed for ${purged} cancelled order(s) older than ${retentionDays} days`);
  return purged;
}

module.exports = { RETENTION_DAYS, destroyCustomOrderImages, uploadedFilesAsImages, purgeCancelledCustomOrderImages };
