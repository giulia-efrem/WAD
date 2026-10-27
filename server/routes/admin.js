'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { z } = require('zod');
const Restaurant = require('../models/Restaurant');
const validate = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');
const { optionalImageUpload, removeUploaded } = require('../middleware/upload');
const { slug } = require('../lib/schemas');
const unsplash = require('../lib/unsplash');
const photos = require('../lib/photos');
const { rank } = require('../lib/photoPick');
const { badRequest, notFound, conflict, HttpError } = require('../lib/httpError');
const { photoOut, restaurantDetail } = require('../lib/present');
const QUERIES = require('../../scripts/photo-queries');

const router = express.Router();
router.use(requireAdmin);

/* ================= Photos by URL or upload (/admin) ================= */

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

/* A pasted URL or upload has no Unsplash credit, so the other photo fields are cleared. */
async function setPlainImage(req, res, slugValue, itemSlug) {
  const image = newImage(req);
  const done = await photos.applyPhoto(slugValue, itemSlug, { image });
  if (!done) throw notFound(itemSlug ? 'We couldn’t find that dish.' : 'We couldn’t find that restaurant.');
  await dropIfUnused(done.previous, image);
  res.json({ image });
}

router.get('/catalog', async (req, res) => {
  const list = await Restaurant.find().sort({ sortOrder: 1, name: 1 });
  res.json({ restaurants: list.map(r => restaurantDetail(r)) });
});

router.put('/restaurants/:slug/image', validate(z.object({ slug }), 'params'), optionalImageUpload, withUpload(async (req, res) => {
  await setPlainImage(req, res, req.valid.params.slug, null);
}));

router.put('/restaurants/:slug/items/:itemSlug/image', validate(z.object({ slug, itemSlug: slug }), 'params'), optionalImageUpload, withUpload(async (req, res) => {
  await setPlainImage(req, res, req.valid.params.slug, req.valid.params.itemSlug);
}));

/* ================= Unsplash review (/admin/photos) ================= */

const keySchema = z.string().regex(/^[a-z0-9-]+(\/[a-z0-9-]+)?$/, 'That photo key isn’t valid.');
const chooseSchema = z.object({ key: keySchema, photoId: z.string().regex(/^[\w-]{1,40}$/, 'That photo id isn’t valid.') });
const searchSchema = z.object({ key: keySchema, query: z.string().trim().min(2, 'Type at least 2 characters.').max(80, 'Use a shorter search.') });
const removeSchema = z.object({ key: keySchema });

/* What this server last heard from Unsplash, plus how many requests the photo script used this hour. */
const quotaOut = () => ({
  limit: unsplash.quota.limit,
  remaining: unsplash.quota.remaining,
  checkedAt: unsplash.quota.seenAt || null,
  scriptLastHour: photos.readJson(path.join(config.root, 'seed', '.unsplash-usage.json'), []).filter(t => Date.now() - t < 3600000).length,
  keySet: !!config.unsplashKey
});

/* Turns Unsplash errors into the API's error format. */
function unsplashError(err) {
  if (err instanceof unsplash.UnsplashError) return new HttpError(err.status || 502, err.code, err.message);
  return err;
}

async function entryFor(key) {
  const { slug: s, itemSlug } = photos.splitKey(key);
  const r = await Restaurant.findOne({ slug: s });
  const target = r && photos.findEntity(r, itemSlug);
  if (!target) throw notFound('We couldn’t find that restaurant or dish.');
  return { r, target, itemSlug };
}

function entryOut(r, target, itemSlug, saved, used) {
  const key = photos.keyOf(r.slug, itemSlug);
  return {
    key,
    kind: itemSlug ? 'dish' : 'cover',
    name: itemSlug ? target.name : r.name,
    restaurant: { slug: r.slug, name: r.name, color: r.color, ink: r.ink, illustration: r.illustration },
    popular: !!(itemSlug && target.popular),
    photo: { ...photoOut(target), unsplashId: target.imageCredit ? target.imageCredit.unsplashId : null },
    /* What was searched last, and what the search box should offer (the script's newer query, unless it was your own). */
    searched: saved && saved.fetchedAt ? saved.query : '',
    query: saved && saved.custom ? saved.query : QUERIES[key] || (saved ? saved.query : ''),
    custom: !!(saved && saved.custom),
    removed: !!(saved && saved.removed),
    fetchedAt: saved ? saved.fetchedAt : null,
    candidates: (saved ? saved.candidates : []).map(c => ({
      id: c.id, raw: c.urls.raw, color: c.color, alt: c.alt_description || c.description || '',
      width: c.width, height: c.height, user: c.user, page: c.page,
      usedBy: used.has(c.id) && used.get(c.id) !== key ? used.get(c.id) : null
    }))
  };
}

router.get('/photos', async (req, res) => {
  const list = await Restaurant.find().sort({ sortOrder: 1 });
  const saved = photos.readCandidates();
  const used = await photos.usedPhotoIds();
  const entries = [];
  for (const r of list) {
    entries.push(entryOut(r, r, null, saved[r.slug], used));
    for (const s of r.menu) for (const it of s.items) {
      /* Mains, starters and desserts get photos. Deals use their main dish's photo; drinks and sides only if they already have one. */
      const kind = it.kind || 'main';
      if (kind === 'deal' || ((kind === 'drink' || kind === 'side') && !it.image)) continue;
      entries.push(entryOut(r, it, it.slug, saved[photos.keyOf(r.slug, it.slug)], used));
    }
  }
  res.json({ quota: quotaOut(), entries });
});

/* Makes a saved candidate the photo, and triggers its Unsplash download event first. */
router.post('/photos/choose', validate(chooseSchema), async (req, res) => {
  const { key, photoId } = req.body;
  const saved = photos.readCandidates()[key];
  const candidate = saved && saved.candidates.find(c => c.id === photoId);
  if (!candidate) throw notFound('That photo isn’t one of the saved candidates. Search again first.');
  const used = await photos.usedPhotoIds();
  if (used.has(photoId) && used.get(photoId) !== key) throw conflict(`That photo is already used for ${used.get(photoId)}. Each photo is used once.`, 'photo_in_use');
  await entryFor(key);
  const { slug: s, itemSlug } = photos.splitKey(key);
  try {
    await unsplash.trackDownload(candidate.download_location);
  } catch (err) { throw unsplashError(err); }
  await photos.applyPhoto(s, itemSlug, photos.fieldsFromCandidate(candidate));
  if (saved.removed) photos.updateJson(photos.CANDIDATES_FILE, {}, all => { delete all[key].removed; });
  const { r, target } = await entryFor(key);
  res.json({ quota: quotaOut(), entry: entryOut(r, target, itemSlug, photos.readCandidates()[key], await photos.usedPhotoIds()) });
});

/* One Unsplash search with the admin's own words. Replaces the saved candidates, not the photo. */
router.post('/photos/search', validate(searchSchema), async (req, res) => {
  const { key, query } = req.body;
  const { r, target, itemSlug } = await entryFor(key);
  const kind = itemSlug ? 'dish' : 'cover';
  const orientation = kind === 'cover' ? 'landscape' : undefined;
  let found;
  try {
    found = await unsplash.searchPhotos(query, { orientation, perPage: 15 });
  } catch (err) { throw unsplashError(err); }
  const previous = photos.readCandidates()[key] || {};
  const saved = {
    query, orientation: orientation || null, fetchedAt: new Date().toISOString(), total: found.total,
    candidates: rank(found.results, { query, kind }).slice(0, 8), custom: true, ...(previous.removed ? { removed: true } : {})
  };
  photos.saveCandidates(key, saved);
  res.json({ quota: quotaOut(), entry: entryOut(r, target, itemSlug, saved, await photos.usedPhotoIds()) });
});

/* Clears the photo (the illustration shows instead) and stops the script from picking a new one. */
router.post('/photos/remove', validate(removeSchema), async (req, res) => {
  const { key } = req.body;
  const { slug: s, itemSlug } = photos.splitKey(key);
  await entryFor(key);
  await photos.applyPhoto(s, itemSlug, photos.EMPTY);
  photos.updateJson(photos.CANDIDATES_FILE, {}, all => { all[key] = { ...(all[key] || { query: QUERIES[key] || '', candidates: [] }), removed: true }; });
  const { r, target } = await entryFor(key);
  res.json({ quota: quotaOut(), entry: entryOut(r, target, itemSlug, photos.readCandidates()[key], await photos.usedPhotoIds()) });
});

module.exports = router;
