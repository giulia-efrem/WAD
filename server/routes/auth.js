'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const config = require('../config');
const User = require('../models/User');
const Order = require('../models/Order');
const validate = require('../middleware/validate');
const { setSession, clearSession } = require('../middleware/auth');
const { loginLimiter, signupLimiter } = require('../middleware/rateLimit');
const { HttpError, conflict } = require('../lib/httpError');

const router = express.Router();

const BCRYPT_COST = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const email = z.string({ error: 'Enter your email.' }).trim().toLowerCase().max(254).regex(EMAIL_RE, 'Enter an email like name@example.com.');

const signupSchema = z.object({
  name: z.string({ error: 'Enter your full name.' }).trim().min(2, 'Enter your full name.').max(80, 'Use a shorter name.'),
  email,
  /* bcrypt only looks at the first 72 bytes, so longer passwords are refused rather than cut. */
  password: z.string({ error: 'Enter a password.' }).min(8, 'Use at least 8 characters.')
    .refine(p => Buffer.byteLength(p) <= 72, 'Use at most 72 characters.')
});

const loginSchema = z.object({
  email,
  password: z.string({ error: 'Enter your password.' }).min(1, 'Enter your password.').max(200)
});

const roleFor = mail => (config.adminEmail && mail === config.adminEmail ? 'admin' : 'user');
const publicMe = async user => user.toPublic({ orderCount: await Order.countDocuments({ user: user._id }) });

router.post('/signup', signupLimiter, validate(signupSchema), async (req, res) => {
  const { name, email: mail, password } = req.body;
  if (await User.exists({ email: mail })) throw conflict('An account with this email already exists. Log in instead.', 'email_taken');
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  let user;
  try {
    user = await User.create({ name, email: mail, passwordHash, role: roleFor(mail) });
  } catch (err) {
    if (err.code === 11000) throw conflict('An account with this email already exists. Log in instead.', 'email_taken');
    throw err;
  }
  setSession(res, user);
  res.status(201).json({ user: await publicMe(user) });
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { email: mail, password } = req.body;
  const user = await User.findOne({ email: mail });
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!ok) throw new HttpError(401, 'bad_credentials', 'That email and password don’t match. Check them and try again.');
  /* Keeps the admin role in step with ADMIN_EMAIL if it changes. */
  const role = roleFor(user.email);
  if (user.role !== role) { user.role = role; await user.save(); }
  setSession(res, user);
  res.json({ user: await publicMe(user) });
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

/* Logged-out visitors get { user: null } rather than an error, since every page load asks. */
router.get('/me', async (req, res) => {
  res.json({ user: req.user ? await publicMe(req.user) : null });
});

module.exports = router;
module.exports.publicMe = publicMe;
