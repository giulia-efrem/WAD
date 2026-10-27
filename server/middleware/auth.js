'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { HttpError, unauthorized, forbidden } = require('../lib/httpError');

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProduction,
  path: '/',
  maxAge: config.sessionDays * 86400000
});

function setSession(res, user) {
  /* v is the user's tokenVersion: raising it (password change, disabled account) ends every session. */
  const token = jwt.sign({ sub: String(user._id), v: user.tokenVersion || 0 }, config.jwtSecret, { expiresIn: `${config.sessionDays}d`, algorithm: 'HS256' });
  res.cookie(config.cookieName, token, cookieOptions());
}

function clearSession(res) {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(config.cookieName, opts);
}

/* Reads the session cookie when there is one. Sets req.user to the user document or null.
   The user (and so their role) is loaded from MongoDB on every request, so a role change or a
   disabled account takes effect at once. */
async function loadUser(req, res, next) {
  req.user = null;
  const token = req.cookies && req.cookies[config.cookieName];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    const user = await User.findById(payload.sub);
    if (user && user.disabled) req.sessionEnded = 'disabled';
    if (user && !user.disabled && (payload.v || 0) === (user.tokenVersion || 0)) req.user = user;
    else clearSession(res);
  } catch (err) {
    clearSession(res);
  }
  next();
}

const disabledError = () => new HttpError(403, 'account_disabled', 'This account has been disabled. Contact Morsel support if you think this is a mistake.');

function requireUser(req, res, next) {
  if (req.sessionEnded === 'disabled') return next(disabledError());
  if (!req.user) return next(unauthorized('Log in to continue.'));
  next();
}

const ROLE_NAMES = { admin: 'admin', partner: 'restaurant partner', courier: 'courier' };

/* Staff routes: requireRole('admin'), requireRole('partner'), requireRole('courier').
   Admins can't open the partner or courier APIs unless listed, so each page shows its own data. */
const requireRole = (...roles) => (req, res, next) => {
  if (req.sessionEnded === 'disabled') return next(disabledError());
  if (!req.user) return next(unauthorized('Log in to continue.'));
  if (!roles.includes(req.user.role)) return next(forbidden(`Only ${roles.map(r => ROLE_NAMES[r] || r).join(' or ')} accounts can do this.`));
  if (req.user.role === 'partner' && !req.user.restaurant) return next(forbidden('Your partner account isn’t linked to a restaurant yet. Ask a Morsel admin to link it.'));
  next();
};

const requireAdmin = requireRole('admin');

module.exports = { setSession, clearSession, loadUser, requireUser, requireRole, requireAdmin, disabledError };
