'use strict';

const express = require('express');
const { z } = require('zod');
const Restaurant = require('../models/Restaurant');
const validate = require('../middleware/validate');
const { requireUser } = require('../middleware/auth');
const { publicMe } = require('./auth');
const { objectId } = require('../lib/schemas');
const { notFound } = require('../lib/httpError');

const router = express.Router();
router.use(requireUser);

router.post('/:restaurantId/toggle', validate(z.object({ restaurantId: objectId('restaurant') }), 'params'), async (req, res) => {
  const { restaurantId } = req.valid.params;
  if (!(await Restaurant.exists({ _id: restaurantId }))) throw notFound('We couldn’t find that restaurant.');
  const u = req.user;
  const has = u.favorites.some(f => String(f) === restaurantId);
  if (has) u.favorites.pull(restaurantId);
  else u.favorites.push(restaurantId);
  await u.save();
  res.json({ user: await publicMe(u), favorite: !has });
});

module.exports = router;
