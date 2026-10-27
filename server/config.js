'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const ROOT = path.join(__dirname, '..');

function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return v.trim();
}

const demoSpeed = Number(process.env.DEMO_SPEED || 30);

const config = {
  root: ROOT,
  publicDir: path.join(ROOT, 'public'),
  uploadsDir: process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(ROOT, 'uploads'),
  /* Where the photo choices (images.json, photo-candidates.json) are kept. The test server points
     this at a copy, so tests never change the real files. */
  photoFilesDir: process.env.PHOTO_FILES_DIR ? path.resolve(process.env.PHOTO_FILES_DIR) : path.join(ROOT, 'seed'),
  mongoUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  port: Number(process.env.PORT || 3000),
  demoSpeed: Number.isFinite(demoSpeed) && demoSpeed > 0 ? demoSpeed : 30,
  /* Optional: only the photo script and /admin/photos use it. It never leaves the server. */
  unsplashKey: (process.env.UNSPLASH_ACCESS_KEY || '').trim(),
  /* DEMO_MODE=true adds one-click demo logins (customer, partner, courier, admin) to the login window. */
  demoMode: (process.env.DEMO_MODE || '').trim().toLowerCase() === 'true',
  isProduction: process.env.NODE_ENV === 'production',
  cookieName: 'morsel_session',
  sessionDays: 7
};
/* One simulated minute of order progress lasts this many real milliseconds. */
config.simMinuteMs = 60000 / config.demoSpeed;

module.exports = config;
