'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');
const { HttpError, badRequest } = require('../lib/httpError');

const TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MAX_BYTES = 8 * 1024 * 1024;

fs.mkdirSync(config.uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: config.uploadsDir,
  filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + TYPES[file.mimetype])
});

const multerUpload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (TYPES[file.mimetype]) cb(null, true);
    else cb(new HttpError(415, 'unsupported_type', 'Use a JPG, PNG or WebP photo.'));
  }
}).single('image');

/* Checks the first bytes, so a renamed file that isn't really an image is rejected. */
function looksLikeImage(file) {
  const fd = fs.openSync(file.path, 'r');
  const b = Buffer.alloc(12);
  fs.readSync(fd, b, 0, 12, 0);
  fs.closeSync(fd);
  if (file.mimetype === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (file.mimetype === 'image/png') return b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (file.mimetype === 'image/webp') return b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

/* Runs multer only for multipart requests, so the same route also accepts JSON { url }. */
function optionalImageUpload(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  multerUpload(req, res, err => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'too_large', 'That photo is too large. Use one under 8 MB.'));
        return next(badRequest('Send one photo in a field called “image”.', 'invalid_upload'));
      }
      return next(err);
    }
    if (req.file && !looksLikeImage(req.file)) {
      fs.unlink(req.file.path, () => {});
      return next(new HttpError(415, 'unsupported_type', 'That file isn’t a valid JPG, PNG or WebP image.'));
    }
    next();
  });
}

/* Deletes a photo we stored in uploads/, ignoring external URLs. */
function removeUploaded(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const file = path.join(config.uploadsDir, path.basename(url));
  fs.unlink(file, () => {});
}

module.exports = { optionalImageUpload, removeUploaded };
