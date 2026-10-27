'use strict';

const express = require('express');
const { z } = require('zod');
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');
const validate = require('../middleware/validate');
const { slug } = require('../lib/schemas');
const { checkPromo, promoOut } = require('../lib/pricing');
const { badRequest, notFound } = require('../lib/httpError');

const router = express.Router();

const schema = z.object({
  code: z.string({ error: 'Enter a promo code.' }).trim().toUpperCase().min(1, 'Enter a promo code.').max(30, 'That code isn’t valid. Check the spelling and try again.'),
  restaurantSlug: slug.optional(),
  subtotal: z.number().int().nonnegative().optional()
});

/* Orders that count towards "first order only" codes: everything except cancelled orders. */
const countOrders = userId => Order.countDocuments({ user: userId, status: { $ne: 'cancelled' } });

/* Login is optional here: a logged-out visitor gets “Log in to use WELCOME20.” for first-order codes. */
router.post('/validate', validate(schema), async (req, res) => {
  const { code, restaurantSlug, subtotal } = req.body;
  let restaurant = null;
  if (restaurantSlug) {
    restaurant = await Restaurant.findOne({ slug: restaurantSlug }, { deliveryFee: 1 });
    if (!restaurant) throw notFound('We couldn’t find that restaurant.');
  }
  const orderCount = req.user ? await countOrders(req.user._id) : 0;
  const { promo, error } = await checkPromo(code, { restaurant, user: req.user, orderCount, subtotal });
  if (error) throw badRequest(error, 'invalid_promo');
  res.json({ valid: true, ...promoOut(promo) });
});

module.exports = router;
module.exports.countOrders = countOrders;
