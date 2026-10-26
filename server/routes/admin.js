'use strict';

const express = require('express');
const fs = require('fs');
const { z } = require('zod');
const Restaurant = require('../models/Restaurant');
const validate = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');
const { optionalImageUpload, removeUploaded } = require('../middleware/upload');
const { slug } = require('../lib/schemas');
const { findItem } = require('../lib/pricing');
const { badRequest, notFound } = require('../lib/httpError');
const { restaurantDetail } = require('../lib/present');

const router = express.Router();
router.use(requireAdmin);

/* An empty string removes the photo. Otherwise an http(s) URL or one of our own /uploads files. */
const urlSchema = z.object({
  url: z.string({ error: 'Paste an image URL or upload a file.' }).trim().max(2000, 'That URL is too long.')
    .refine(u => u === '' || /^\/uploads\/[a-f0-9]{24}\.(jpg|png|webp)$/.test(u) || isHttpUrl(u), 'Paste a full image URL starting with https://.')
});

function isHttpUrl(u) {
  try { const p = new URL(u); return p.protocol === 'https:' || p.protocol === 'http:'; } catch (e) { return false; }
}

/* Works out the new image from either the uploaded file or the JSON body. */
function newImage(req) {
  if (req.file) return `/uploads/${req.file.filename}`;
  if (req.is('multipart/form-data')) throw badRequest('Choose a photo to upload.', 'missing_file');
  const result = urlSchema.safeParse(req.body || {});
  if (!result.success) throw badRequest(result.error.issues[0].message, 'validation_failed');
  return result.data.url;
}

/* Deletes the old uploaded file once no restaurant or dish points at it any more. */
async function dropIfUnused(url, next) {
  if (!url || url === next || !url.startsWith('/uploads/')) return;
  if (await Restaurant.exists({ $or: [{ image: url }, { 'menu.items.image': url }] })) return;
  removeUploaded(url);
}

/* Runs the update and cleans up the uploaded file if anything goes wrong. */
const withUpload = handler => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    throw err;
  }
};

router.get('/catalog', async (req, res) => {
  const list = await Restaurant.find().sort({ sortOrder: 1, name: 1 });
  res.json({ restaurants: list.map(r => restaurantDetail(r)) });
});

router.put('/restaurants/:slug/image', validate(z.object({ slug }), 'params'), optionalImageUpload, withUpload(async (req, res) => {
  const r = await Restaurant.findOne({ slug: req.valid.params.slug });
  if (!r) throw notFound('We couldn’t find that restaurant.');
  const image = newImage(req);
  const previous = r.image;
  r.image = image;
  await r.save();
  await dropIfUnused(previous, image);
  res.json({ image });
}));

router.put('/restaurants/:slug/items/:itemSlug/image', validate(z.object({ slug, itemSlug: slug }), 'params'), optionalImageUpload, withUpload(async (req, res) => {
  const r = await Restaurant.findOne({ slug: req.valid.params.slug });
  if (!r) throw notFound('We couldn’t find that restaurant.');
  const item = findItem(r, req.valid.params.itemSlug);
  if (!item) throw notFound('We couldn’t find that dish.');
  const image = newImage(req);
  const previous = item.image;
  item.image = image;
  await r.save();
  await dropIfUnused(previous, image);
  res.json({ image });
}));

module.exports = router;
