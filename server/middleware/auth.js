'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { unauthorized, forbidden } = require('../lib/httpError');

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProduction,
  path: '/',
  maxAge: config.sessionDays * 86400000
});

function setSession(res, user) {
  const token = jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: `${config.sessionDays}d`, algorithm: 'HS256' });
  res.cookie(config.cookieName, token, cookieOptions());
}

function clearSession(res) {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(config.cookieName, opts);
}

/* Reads the session cookie when there is one. Sets req.user to the user document or null. */
async function loadUser(req, res, next) {
  req.user = null;
  const token = req.cookies && req.cookies[config.cookieName];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    req.user = await User.findById(payload.sub);
    if (!req.user) clearSession(res);
  } catch (err) {
    clearSession(res);
  }
  next();
}

function requireUser(req, res, next) {
  if (!req.user) return next(unauthorized('Log in to continue.'));
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return next(unauthorized('Log in to continue.'));
  if (req.user.role !== 'admin') return next(forbidden('Only the admin account can do this.'));
  next();
}

module.exports = { setSession, clearSession, loadUser, requireUser, requireAdmin };
