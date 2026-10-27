'use strict';

const express = require('express');
const { z } = require('zod');
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');
const Review = require('../models/Review');
const { getSetting } = require('../models/Setting');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');
const { objectId, slug } = require('../lib/schemas');
const flow = require('../lib/orderFlow');
const { summary, reviewOut } = require('../lib/reviews');
const { orderOut, restaurantCard } = require('../lib/present');
const { notFound } = require('../lib/httpError');

/* /api/partner: for restaurant partners. Every route is limited to the partner's own restaurant
   (req.user.restaurant, loaded from MongoDB on every request). */
const router = express.Router();
router.use(requireRole('partner'));

const idParams = z.object({ id: objectId('order') });
const reason = z.string({ error: 'Give a reason.' }).trim().min(2, 'Give a reason, so the customer knows what happened.').max(160, 'Keep the reason under 160 characters.');

const myRestaurant = async req => {
  const r = await Restaurant.findById(req.user.restaurant);
  if (!r) throw notFound('Your restaurant no longer exists. Ask a Morsel admin to link your account again.');
  return r;
};

async function myOrder(req) {
  const order = await Order.findOne({ _id: req.valid.params.id, restaurant: req.user.restaurant });
  if (!order) throw notFound('We couldn’t find that order at your restaurant.');
  return order;
}
const out = async order => orderOut(await Order.findById(order._id).populate('restaurant', 'slug'));

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

/* The live board. Polling it also tells the autopilot that this restaurant is online. */
router.get('/orders', async (req, res) => {
  const r = await myRestaurant(req);
  flow.seenPartner(r._id);
  const [active, done] = await Promise.all([
    Order.find({ restaurant: r._id, status: { $in: flow.ACTIVE } }).sort({ createdAt: 1 }).limit(100).populate('restaurant', 'slug'),
    Order.find({ restaurant: r._id, status: { $in: ['delivered', 'cancelled'] }, statusAt: { $gte: startOfToday() } }).sort({ statusAt: -1 }).limit(50).populate('restaurant', 'slug')
  ]);
  const now = Date.now();
  res.json({
    restaurant: restaurantCard(r),
    autopilot: !!(await getSetting('autopilot')),
    active: active.map(o => orderOut(o, now)),
    done: done.map(o => orderOut(o, now)),
    today: {
      orders: await Order.countDocuments({ restaurant: r._id, createdAt: { $gte: startOfToday() }, status: { $ne: 'cancelled' } }),
      revenue: done.filter(o => o.status === 'delivered').reduce((s, o) => s + o.pricing.subtotal, 0)
    },
    serverNow: now
  });
});

router.post('/orders/:id/accept', validate(idParams, 'params'), validate(z.object({
  prepMinutes: z.number({ error: 'Set a preparation time.' }).int().min(5, 'Preparation time is between 5 and 90 minutes.').max(90, 'Preparation time is between 5 and 90 minutes.')
})), async (req, res) => {
  const order = await myOrder(req);
  const done = await flow.advance(order, 'placed', 'accepted', 'partner', { set: { prepMinutes: req.body.prepMinutes }, note: `${req.body.prepMinutes} min to prepare` });
  res.json({ order: await out(done) });
});

router.post('/orders/:id/preparing', validate(idParams, 'params'), async (req, res) => {
  const order = await myOrder(req);
  res.json({ order: await out(await flow.advance(order, 'accepted', 'preparing', 'partner')) });
});

/* Ready for pickup. Straight from accepted is fine too (a drink order needs no cooking). */
router.post('/orders/:id/ready', validate(idParams, 'params'), async (req, res) => {
  const order = await myOrder(req);
  res.json({ order: await out(await flow.advance(order, ['accepted', 'preparing'], 'ready', 'partner')) });
});

/* Reject a new order, or cancel one already accepted (until the courier picks it up). */
router.post('/orders/:id/reject', validate(idParams, 'params'), validate(z.object({ reason })), async (req, res) => {
  const order = await myOrder(req);
  res.json({ order: await out(await flow.cancel(order, 'partner', req.body.reason)) });
});

/* ---------- Menu availability and pausing ---------- */

router.get('/menu', async (req, res) => {
  const r = await myRestaurant(req);
  res.json({
    restaurant: { name: r.name, slug: r.slug, paused: !!r.paused },
    menu: r.menu.map(s => ({ category: s.category, items: s.items.map(it => ({ slug: it.slug, name: it.name, price: it.price, kind: it.kind, soldOut: !!it.soldOut })) }))
  });
});

router.patch('/menu/:itemSlug', validate(z.object({ itemSlug: slug }), 'params'), validate(z.object({ soldOut: z.boolean({ error: 'Say whether it’s sold out.' }) })), async (req, res) => {
  const { itemSlug } = req.valid.params;
  const done = await Restaurant.updateOne({ _id: req.user.restaurant, 'menu.items.slug': itemSlug }, { $set: { 'menu.$[].items.$[it].soldOut': req.body.soldOut } }, { arrayFilters: [{ 'it.slug': itemSlug }] });
  if (!done.matchedCount) throw notFound('That dish isn’t on your menu.');
  res.json({ itemSlug, soldOut: req.body.soldOut });
});

router.patch('/restaurant', validate(z.object({ paused: z.boolean({ error: 'Say whether to pause new orders.' }) })), async (req, res) => {
  await Restaurant.updateOne({ _id: req.user.restaurant }, { $set: { paused: req.body.paused } });
  res.json({ paused: req.body.paused });
});

/* ---------- Reviews and public replies ---------- */

const PAGE_SIZE = 20;
router.get('/reviews', validate(z.object({ page: z.coerce.number().int().min(1).max(100).optional().default(1), filter: z.enum(['all', 'unanswered']).optional().default('all') }), 'query'), async (req, res) => {
  const r = await myRestaurant(req);
  const { page, filter } = req.valid.query;
  const query = { restaurant: r._id, hidden: { $ne: true }, ...(filter === 'unanswered' ? { 'reply.text': { $in: [null, ''] } } : {}) };
  const [sum, total, list] = await Promise.all([
    summary(r._id), Review.countDocuments(query),
    Review.find(query).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE)
  ]);
  res.json({ summary: sum, reviews: list.map(reviewOut), page, hasMore: page * PAGE_SIZE < total, total });
});

/* An empty text removes the reply. */
router.put('/reviews/:id/reply', validate(z.object({ id: objectId('review') }), 'params'), validate(z.object({
  text: z.string({ error: 'Write a reply.' }).trim().max(600, 'Replies can be up to 600 characters.')
})), async (req, res) => {
  const review = await Review.findOne({ _id: req.valid.params.id, restaurant: req.user.restaurant, hidden: { $ne: true } });
  if (!review) throw notFound('We couldn’t find that review for your restaurant.');
  review.reply = req.body.text ? { text: req.body.text, at: new Date(), by: req.user.name } : null;
  await review.save();
  res.json({ review: reviewOut(review) });
});

module.exports = router;
