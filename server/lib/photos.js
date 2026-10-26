'use strict';

/* Keeps a restaurant's or dish's photo in step in three places: MongoDB (what the app shows),
   seed/images.json (what npm run seed restores) and seed/photo-candidates.json (saved search
   results, so picking another photo costs no new search). */

const fs = require('fs');
const path = require('path');
const config = require('../config');
const Restaurant = require('../models/Restaurant');

const SEED_DIR = path.join(config.root, 'seed');
const IMAGES_FILE = path.join(SEED_DIR, 'images.json');
const CANDIDATES_FILE = path.join(SEED_DIR, 'photo-candidates.json');

const keyOf = (slug, itemSlug) => (itemSlug ? `${slug}/${itemSlug}` : slug);
const splitKey = key => { const [slug, itemSlug] = key.split('/'); return { slug, itemSlug: itemSlug || null }; };

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
/* Writes to a temporary file first, so a crash never leaves half a JSON file. */
function writeJson(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}
/* Read, change and write in one synchronous step, so the script and the server don't overwrite each other. */
function updateJson(file, fallback, fn) {
  const data = readJson(file, fallback);
  fn(data);
  writeJson(file, data);
  return data;
}

const readCandidates = () => readJson(CANDIDATES_FILE, {});
const saveCandidates = (key, entry) => updateJson(CANDIDATES_FILE, {}, all => { all[key] = entry; });

const EMPTY = { image: '', imageColor: '', imageBlurHash: '', imageAlt: '', imageCredit: null };

/* Database fields for a saved Unsplash candidate. image is urls.raw (with its ixid), sized in the browser. */
function fieldsFromCandidate(c) {
  return {
    image: c.urls.raw,
    imageColor: c.color || '',
    imageBlurHash: c.blur_hash || '',
    imageAlt: c.alt_description || c.description || '',
    imageCredit: {
      source: 'unsplash', unsplashId: c.id, name: c.user.name, username: c.user.username,
      profileUrl: c.user.profile, photoUrl: c.page, downloadLocation: c.download_location
    }
  };
}

/* What images.json stores: '' for no photo, a plain URL, or the full photo with its credit. */
function imagesEntry(f) {
  if (!f.image) return '';
  if (!f.imageCredit && !f.imageColor) return f.image;
  return {
    url: f.image, color: f.imageColor || '', blurHash: f.imageBlurHash || '', alt: f.imageAlt || '',
    credit: f.imageCredit ? { ...(f.imageCredit.toObject ? f.imageCredit.toObject() : f.imageCredit) } : null
  };
}
/* The reverse, used by npm run seed. Accepts the old plain-string format too. */
function fieldsFromImagesEntry(v) {
  if (!v) return { ...EMPTY };
  if (typeof v === 'string') return { ...EMPTY, image: v.trim() };
  return {
    image: (v.url || '').trim(), imageColor: v.color || '', imageBlurHash: v.blurHash || '', imageAlt: v.alt || '',
    imageCredit: v.credit && v.credit.unsplashId ? v.credit : null
  };
}

function findEntity(r, itemSlug) {
  if (!itemSlug) return r;
  for (const s of r.menu) { const it = s.items.find(x => x.slug === itemSlug); if (it) return it; }
  return null;
}

/* Sets (or with EMPTY, clears) the photo of one restaurant or dish. Returns the saved fields. */
async function applyPhoto(slug, itemSlug, fields) {
  const r = await Restaurant.findOne({ slug });
  if (!r) return null;
  const target = findEntity(r, itemSlug);
  if (!target) return null;
  const previous = target.image;
  Object.assign(target, { ...EMPTY, ...fields });
  await r.save();
  updateJson(IMAGES_FILE, {}, all => { all[keyOf(slug, itemSlug)] = imagesEntry(fields); });
  return { previous, fields };
}

/* Unsplash photo id -> key, for every photo in use. Used to never show the same photo twice. */
async function usedPhotoIds() {
  const used = new Map();
  for (const r of await Restaurant.find({}, { slug: 1, imageCredit: 1, 'menu.items.slug': 1, 'menu.items.imageCredit': 1 }).lean()) {
    if (r.imageCredit && r.imageCredit.unsplashId) used.set(r.imageCredit.unsplashId, r.slug);
    for (const s of r.menu) for (const it of s.items) if (it.imageCredit && it.imageCredit.unsplashId) used.set(it.imageCredit.unsplashId, keyOf(r.slug, it.slug));
  }
  return used;
}

module.exports = {
  IMAGES_FILE, CANDIDATES_FILE, EMPTY, keyOf, splitKey, readJson, writeJson, updateJson,
  readCandidates, saveCandidates, fieldsFromCandidate, imagesEntry, fieldsFromImagesEntry, findEntity, applyPhoto, usedPhotoIds
};
