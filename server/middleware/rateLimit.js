'use strict';

const { rateLimit } = require('express-rate-limit');

const handler = (req, res, next, options) => {
  res.status(options.statusCode).json({ error: { code: 'rate_limited', message: options.message } });
};

/* Only failed logins count, so people who type their password correctly are never blocked. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Too many login attempts. Wait 15 minutes and try again.',
  handler
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Too many accounts created from this network. Try again in an hour.',
  handler
});

module.exports = { loginLimiter, signupLimiter };
