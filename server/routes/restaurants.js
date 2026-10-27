'use strict';

const express = require('express');
const { z } = require('zod');
const Restaurant = require('../models/Restaurant');
const Review = require('../models/Review');
const { summary, reviewOut } = require('../lib/reviews');
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

const reviewsQuery = z.object({
  sort: z.enum(['newest', 'highest', 'lowest']).optional().default('newest'),
  page: z.coerce.number().int().min(1).max(100).optional().default(1)
});
const SORTS = { newest: { createdAt: -1 }, highest: { food: -1, createdAt: -1 }, lowest: { food: 1, createdAt: -1 } };
const PAGE_SIZE = 10;

router.get('/:slug/reviews', validate(z.object({ slug }), 'params'), validate(reviewsQuery, 'query'), async (req, res) => {
  const r = await Restaurant.findOne({ slug: req.valid.params.slug }, { _id: 1 });
  if (!r) throw notFound('We couldn’t find that restaurant.');
  const { sort, page } = req.valid.query;
  const [sum, list] = await Promise.all([
    summary(r._id),
    Review.find({ restaurant: r._id, hidden: { $ne: true } }).sort(SORTS[sort]).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE)
  ]);
  const me = req.user ? String(req.user._id) : null;
  res.json({
    summary: sum,
    reviews: list.map(x => ({ ...reviewOut(x), mine: !!(me && x.user && String(x.user) === me) })),
    page, pageSize: PAGE_SIZE, hasMore: page * PAGE_SIZE < sum.count, sort
  });
});

module.exports = router;
