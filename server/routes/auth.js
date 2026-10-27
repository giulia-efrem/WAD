'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const User = require('../models/User');
const Order = require('../models/Order');
const Review = require('../models/Review');
const validate = require('../middleware/validate');
const { setSession, clearSession, requireUser, disabledError } = require('../middleware/auth');
const { loginLimiter, signupLimiter } = require('../middleware/rateLimit');
const { HttpError, conflict, badRequest, forbidden, notFound } = require('../lib/httpError');
const config = require('../config');
const staff = require('../../seed/staff');

const router = express.Router();

const BCRYPT_COST = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const email = z.string({ error: 'Enter your email.' }).trim().toLowerCase().max(254).regex(EMAIL_RE, 'Enter an email like name@example.com.');

const name = z.string({ error: 'Enter your full name.' }).trim().min(2, 'Enter your full name.').max(80, 'Use a shorter name.');
/* bcrypt only looks at the first 72 bytes, so longer passwords are refused rather than cut. */
const password = z.string({ error: 'Enter a password.' }).min(8, 'Use at least 8 characters.')
  .refine(p => Buffer.byteLength(p) <= 72, 'Use at most 72 characters.');

/* No role here: everyone who signs up is a customer. Only admins create staff accounts. */
const signupSchema = z.object({ name, email, password });

const loginSchema = z.object({
  email,
  password: z.string({ error: 'Enter your password.' }).min(1, 'Enter your password.').max(200)
});

const publicMe = async user => user.toPublic({ orderCount: await Order.countDocuments({ user: user._id, status: { $ne: 'cancelled' } }) });

router.post('/signup', signupLimiter, validate(signupSchema), async (req, res) => {
  const { email: mail, password: pass } = req.body;
  if (await User.exists({ email: mail })) throw conflict('An account with this email already exists. Log in instead.', 'email_taken');
  const passwordHash = await bcrypt.hash(pass, BCRYPT_COST);
  let user;
  try {
    user = await User.create({ name: req.body.name, email: mail, passwordHash, role: 'customer' });
  } catch (err) {
    if (err.code === 11000) throw conflict('An account with this email already exists. Log in instead.', 'email_taken');
    throw err;
  }
  setSession(res, user);
  res.status(201).json({ user: await publicMe(user) });
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { email: mail, password: pass } = req.body;
  const user = await User.findOne({ email: mail });
  const ok = user ? await bcrypt.compare(pass, user.passwordHash) : false;
  if (!ok) throw new HttpError(401, 'bad_credentials', 'That email and password don’t match. Check them and try again.');
  if (user.disabled) throw disabledError();
  setSession(res, user);
  res.json({ user: await publicMe(user) });
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

/* Logged-out visitors get { user: null } rather than an error, since every page load asks. */
router.get('/me', async (req, res) => {
  res.json({ user: req.user ? await publicMe(req.user) : null, ...(req.sessionEnded ? { ended: req.sessionEnded } : {}) });
});

/* ---------- Demo accounts (DEMO_MODE=true only) ----------
   One-click logins for presentations. The browser never sees a password: it asks for a role
   (and a restaurant for partners) and the server signs in the matching seeded account. */

const DEFAULT_PARTNER = Object.keys(staff.PARTNER_NAMES)[0];
const demoEmail = (role, restaurant) => ({
  customer: staff.DEMO_CUSTOMER.email,
  partner: staff.PARTNER_NAMES[restaurant] ? staff.partnerEmail(restaurant) : null,
  courier: staff.COURIERS[0].email,
  admin: staff.ADMIN.email
})[role] || null;

const demoOff = () => notFound('Demo accounts are turned off. Set DEMO_MODE=true in .env to use them.');

/* Only seeded accounts that still have their demo role are offered, so an admin's changes are respected. */
router.get('/demo', async (req, res) => {
  if (!config.demoMode) return res.json({ enabled: false, accounts: [] });
  const emails = [staff.DEMO_CUSTOMER.email, staff.COURIERS[0].email, staff.ADMIN.email, ...Object.keys(staff.PARTNER_NAMES).map(staff.partnerEmail)];
  const users = await User.find({ email: { $in: emails }, seeded: true, disabled: { $ne: true } }).populate('restaurant', 'name slug').lean();
  const expected = { [staff.DEMO_CUSTOMER.email]: 'customer', [staff.COURIERS[0].email]: 'courier', [staff.ADMIN.email]: 'admin' };
  const accounts = emails.map(mail => users.find(u => u.email === mail))
    .filter(u => u && u.role === (expected[u.email] || 'partner') && (u.role !== 'partner' || u.restaurant))
    .map(u => ({
      role: u.role,
      name: u.name,
      ...(u.role === 'partner' ? { restaurant: { slug: u.restaurant.slug, name: u.restaurant.name } } : {}),
      ...(u.vehicle ? { vehicle: u.vehicle } : {})
    }));
  res.json({ enabled: true, defaultPartner: DEFAULT_PARTNER, accounts });
});

const demoSchema = z.object({
  role: z.enum(['customer', 'partner', 'courier', 'admin'], { error: 'Choose a demo account.' }),
  restaurant: z.string().trim().max(80).optional()
});

router.post('/demo', loginLimiter, validate(demoSchema), async (req, res) => {
  if (!config.demoMode) throw demoOff();
  if (req.body.role === 'partner' && req.body.restaurant && !staff.PARTNER_NAMES[req.body.restaurant]) throw notFound('That restaurant has no demo partner.');
  const mail = demoEmail(req.body.role, req.body.restaurant || DEFAULT_PARTNER);
  const user = mail ? await User.findOne({ email: mail, seeded: true }) : null;
  if (!user || user.role !== req.body.role) throw new HttpError(404, 'demo_missing', 'This demo account isn’t set up yet. Run npm run seed, then try again.');
  if (user.disabled) throw disabledError();
  setSession(res, user);
  res.json({ user: await publicMe(user) });
});

/* ---------- Your account ---------- */

router.patch('/me', requireUser, validate(z.object({ name })), async (req, res) => {
  req.user.name = req.body.name;
  await req.user.save();
  res.json({ user: await publicMe(req.user) });
});

const currentPassword = z.string({ error: 'Enter your current password.' }).min(1, 'Enter your current password.').max(200);

async function checkPassword(user, given, message = 'That isn’t your current password.') {
  if (!(await bcrypt.compare(given, user.passwordHash))) throw badRequest(message, 'wrong_password');
}

/* Signs out every other session too: the new cookie carries the new token version. */
router.post('/password', requireUser, loginLimiter, validate(z.object({ current: currentPassword, password })), async (req, res) => {
  const user = req.user;
  await checkPassword(user, req.body.current);
  if (req.body.current === req.body.password) throw badRequest('Choose a password that’s different from your current one.', 'same_password');
  user.passwordHash = await bcrypt.hash(req.body.password, BCRYPT_COST);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  setSession(res, user);
  res.json({ ok: true });
});

/* Deletes the account and its saved addresses. Orders and reviews stay for the restaurants'
   records, without the name: they show "Former customer". */
router.delete('/me', requireUser, loginLimiter, validate(z.object({ password: currentPassword })), async (req, res) => {
  const user = req.user;
  if (user.role !== 'customer') throw forbidden('Staff accounts are removed by a Morsel admin. Ask an admin to disable this account.');
  await checkPassword(user, req.body.password, 'That password isn’t right, so your account wasn’t deleted.');
  await Order.updateMany({ user: user._id }, { $set: { user: null, customerName: 'Former customer' } });
  await Review.updateMany({ user: user._id }, { $set: { user: null, author: 'Former customer' } });
  await User.deleteOne({ _id: user._id });
  clearSession(res);
  res.json({ ok: true });
});

module.exports = router;
module.exports.publicMe = publicMe;
