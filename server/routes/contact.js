'use strict';

const express = require('express');
const { z } = require('zod');
const Message = require('../models/Message');
const Order = require('../models/Order');
const validate = require('../middleware/validate');
const { contactLimiter } = require('../middleware/rateLimit');
const { badRequest } = require('../lib/httpError');

const router = express.Router();

/* The Help centre's contact form. Anyone can write; a logged-in customer can name one of their orders. */
router.post('/', contactLimiter, validate(z.object({
  name: z.string({ error: 'Enter your name.' }).trim().min(2, 'Enter your name.').max(80, 'Use a shorter name.'),
  email: z.string({ error: 'Enter your email.' }).trim().toLowerCase().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Enter an email like name@example.com.'),
  topic: z.enum(Message.TOPICS, { error: 'Choose what your message is about.' }),
  orderId: z.string().regex(/^[a-f0-9]{24}$/i).optional().or(z.literal('')),
  body: z.string({ error: 'Write your message.' }).trim().min(10, 'Tell us a little more (at least 10 characters).').max(2000, 'Keep it under 2,000 characters.')
})), async (req, res) => {
  let order = null;
  if (req.body.orderId) {
    if (!req.user) throw badRequest('Log in to ask about an order.', 'login_required');
    order = await Order.findOne({ _id: req.body.orderId, user: req.user._id }, { _id: 1 });
    if (!order) throw badRequest('That order isn’t one of yours.', 'invalid_order');
  }
  const m = await Message.create({ name: req.body.name, email: req.body.email, topic: req.body.topic, order: order ? order._id : null, body: req.body.body, user: req.user ? req.user._id : null });
  res.status(201).json({ ok: true, id: String(m._id) });
});

module.exports = router;
