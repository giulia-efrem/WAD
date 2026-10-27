'use strict';

const mongoose = require('mongoose');

/* Platform settings, one document per key (for example { key: 'autopilot', value: true }). */
const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

const Setting = mongoose.model('Setting', settingSchema);

const DEFAULTS = { autopilot: true };
/* Read again after a couple of seconds, so a change made by another server process (or
   straight in MongoDB) takes effect quickly. */
const CACHE_MS = 2000;
const cache = new Map();

async function getSetting(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const doc = await Setting.findOne({ key }).lean();
  const value = doc ? doc.value : DEFAULTS[key];
  cache.set(key, { value, at: Date.now() });
  return value;
}
async function setSetting(key, value) {
  await Setting.updateOne({ key }, { $set: { value } }, { upsert: true });
  cache.set(key, { value, at: Date.now() });
  return value;
}

module.exports = Setting;
module.exports.getSetting = getSetting;
module.exports.setSetting = setSetting;
