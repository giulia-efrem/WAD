'use strict';

const express = require('express');
const { z } = require('zod');
const Restaurant = require('../models/Restaurant');
const validate = require('../middleware/validate');
const { slug } = require('../lib/schemas');
const { notFound } = require('../lib/httpError');
const { restaurantCard, restaurantDetail } = require('../lib/present');

const router = express.Router();

router.get('/', async (req, res) => {
  const list = await Restaurant.find().sort({ sortOrder: 1, name: 1 });
  const now = new Date();
  res.json({ restaurants: list.map(r => restaurantCard(r, now)) });
});

router.get('/:slug', validate(z.object({ slug }), 'params'), async (req, res) => {
  const r = await Restaurant.findOne({ slug: req.valid.params.slug });
  if (!r) throw notFound('We couldn’t find that restaurant.');
  res.json({ restaurant: restaurantDetail(r) });
});

module.exports = router;
