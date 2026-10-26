'use strict';

const express = require('express');
const { z } = require('zod');
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');
const validate = require('../middleware/validate');
const { slug } = require('../lib/schemas');
const { promoError } = require('../lib/pricing');
const { badRequest, notFound } = require('../lib/httpError');

const router = express.Router();

const schema = z.object({
  code: z.string({ error: 'Enter a promo code.' }).trim().toUpperCase().min(1, 'Enter a promo code.').max(30, 'That code isn’t valid. Check the spelling and try again.'),
  restaurantSlug: slug.optional()
});

const DESCRIPTIONS = {
  WELCOME20: { kind: 'percent', description: '20% off food, up to €8, on your first order' },
  FREEDEL: { kind: 'delivery', description: 'Free delivery' }
};

/* Login is optional here: a logged-out visitor gets “Log in to use WELCOME20.” */
router.post('/validate', validate(schema), async (req, res) => {
  const { code, restaurantSlug } = req.body;
  let restaurant = null;
  if (restaurantSlug) {
    restaurant = await Restaurant.findOne({ slug: restaurantSlug }, { deliveryFee: 1 });
    if (!restaurant) throw notFound('We couldn’t find that restaurant.');
  }
  const orderCount = req.user ? await Order.countDocuments({ user: req.user._id }) : 0;
  const err = promoError(code, { restaurant, user: req.user, orderCount });
  if (err) throw badRequest(err, 'invalid_promo');
  res.json({ valid: true, code, ...DESCRIPTIONS[code] });
});

module.exports = router;
