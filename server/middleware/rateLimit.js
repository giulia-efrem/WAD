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

/* SIGNUP_LIMIT exists for the test server, which creates many accounts in one run. */
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.SIGNUP_LIMIT) || 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Too many accounts created from this network. Try again in an hour.',
  handler
});

/* Forgot-password requests and reset attempts. RESET_LIMIT exists for the test server. */
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RESET_LIMIT) || 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'Too many password reset attempts. Wait 15 minutes and try again.',
  handler
});

/* The contact form. CONTACT_LIMIT exists for the test server. */
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.CONTACT_LIMIT) || 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: 'You’ve sent several messages already. We’ll be in touch; try again in an hour if it’s urgent.',
  handler
});

module.exports = { loginLimiter, signupLimiter, resetLimiter, contactLimiter };
