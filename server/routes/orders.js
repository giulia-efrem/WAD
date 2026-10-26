'use strict';

const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const config = require('../config');
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');
const validate = require('../middleware/validate');
const { requireUser } = require('../middleware/auth');
const { objectId, slug } = require('../lib/schemas');
const { TIP_CHOICES, priceLine, promoError, computePricing } = require('../lib/pricing');
const { isOpenNow, isOpenAt, minuteOfDay } = require('../lib/hours');
const { progress, skipShiftMs } = require('../lib/orderStatus');
const { orderOut } = require('../lib/present');
const { badRequest, notFound, forbidden, conflict } = require('../lib/httpError');

const router = express.Router();
router.use(requireUser);

const COURIERS = [['Luca', 'bike'], ['Maya', 'scooter'], ['Andrei', 'bike'], ['Sofia', 'scooter'], ['Tom', 'bike'], ['Ines', 'scooter']];
const SCHEDULE_MIN_AHEAD_MS = 30 * 60000;
const SCHEDULE_MAX_AHEAD_MS = 24 * 3600000;

/* Prices sent by the browser are not part of the schema, so zod strips them. */
const lineSchema = z.object({
  itemSlug: slug,
  qty: z.number({ error: 'Each item needs a quantity.' }).int('Quantities must be whole numbers.').min(1, 'Quantities must be between 1 and 20.').max(20, 'Quantities must be between 1 and 20.'),
  options: z.record(z.string().max(40), z.union([z.string().max(40), z.array(z.string().max(40)).max(10)])).optional().default({}),
  note: z.string().trim().max(140, 'Kitchen notes can be up to 140 characters.').optional().default('')
});

const createSchema = z.object({
  restaurantSlug: slug,
  items: z.array(lineSchema, { error: 'Add something to your bag first.' }).min(1, 'Add something to your bag first.').max(50, 'That’s too many lines for one order.'),
  addressId: objectId('address'),
  payment: z.enum(['card', 'cash'], { error: 'Choose card or cash.' }),
  courierNote: z.string().trim().max(160, 'Courier notes can be up to 160 characters.').optional().default(''),
  delivery: z.discriminatedUnion('type', [
    z.object({ type: z.literal('asap') }),
    z.object({ type: z.literal('scheduled'), at: z.union([z.iso.datetime({ offset: true }), z.number().int().positive()], { error: 'Pick an arrival time.' }) })
  ], { error: 'Choose ASAP or a scheduled time.' }),
  promoCode: z.string().trim().toUpperCase().max(30).nullable().optional().default(null),
  tip: z.number({ error: 'Choose a tip.' }).int().refine(v => TIP_CHOICES.includes(v), 'Choose a tip of €0, €1, €2 or €3.').optional().default(0),
  /* Optional: the total the customer saw. If it no longer matches, the order is refused. */
  expectedTotal: z.number().int().nonnegative().optional()
});

const idParams = z.object({ id: objectId('order') });
const rateSchema = z.object({
  stars: z.number({ error: 'Choose from 1 to 5 stars.' }).int().min(1, 'Choose from 1 to 5 stars.').max(5, 'Choose from 1 to 5 stars.'),
  comment: z.string().trim().max(240, 'Comments can be up to 240 characters.').optional().default('')
});

async function findMine(req) {
  const order = await Order.findOne({ _id: req.valid.params.id, user: req.user._id }).populate('restaurant', 'slug');
  if (!order) throw notFound('We couldn’t find that order.');
  return order;
}

router.post('/', validate(createSchema), async (req, res) => {
  const body = req.body;
  const user = req.user;
  const restaurant = await Restaurant.findOne({ slug: body.restaurantSlug });
  if (!restaurant) throw badRequest('We couldn’t find that restaurant.', 'unknown_restaurant');

  const addr = user.addresses.id(body.addressId);
  if (!addr) throw badRequest('That address isn’t one of your saved addresses.', 'invalid_address');

  const items = body.items.map(line => priceLine(restaurant, line));
  const subtotal = items.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  const now = Date.now();
  let delivery, at = null;
  if (body.delivery.type === 'asap') {
    if (!isOpenNow(restaurant.hours, new Date(now))) throw badRequest(`${restaurant.name} is closed. Schedule your order for later.`, 'restaurant_closed');
    delivery = { type: 'asap' };
  } else {
    at = new Date(body.delivery.at);
    if (Number.isNaN(at.getTime())) throw badRequest('Pick an arrival time.', 'invalid_time');
    if (at.getTime() < now + SCHEDULE_MIN_AHEAD_MS) throw badRequest('Scheduled orders need to be at least 30 minutes from now.', 'invalid_time');
    if (at.getTime() > now + SCHEDULE_MAX_AHEAD_MS) throw badRequest('You can schedule up to 24 hours ahead.', 'invalid_time');
    if (!isOpenAt(restaurant.hours, minuteOfDay(at))) throw badRequest(`${restaurant.name} isn’t open at that time. Pick another arrival time.`, 'outside_hours');
    delivery = { type: 'scheduled', at };
  }

  let promoCode = body.promoCode || null;
  if (promoCode) {
    const orderCount = await Order.countDocuments({ user: user._id });
    const err = promoError(promoCode, { restaurant, user, orderCount });
    if (err) throw badRequest(err, 'invalid_promo');
  }

  const pricing = computePricing({ restaurant, subtotal, promoCode, tip: body.tip });
  if (body.expectedTotal != null && body.expectedTotal !== pricing.total) {
    throw badRequest('Prices have changed since you opened your bag. Check the new total and place your order again.', 'price_mismatch');
  }
  /* A code that ends up taking nothing off is not recorded, like the reference. */
  if (!pricing.discount && !pricing.deliveryDiscount) promoCode = null;

  const etaMin = Math.round((restaurant.eta.min + restaurant.eta.max) / 2);
  const startAt = at ? at.getTime() - etaMin * config.simMinuteMs : now;
  const [name, vehicle] = COURIERS[crypto.randomInt(COURIERS.length)];

  const order = await Order.create({
    user: user._id,
    restaurant: restaurant._id,
    restaurantName: restaurant.name,
    items,
    pricing,
    address: { label: addr.label, street: addr.street, details: addr.details, city: addr.city },
    payment: body.payment,
    courierNote: body.courierNote,
    delivery,
    promoCode,
    etaMin,
    startAt: new Date(startAt),
    courier: { name, vehicle }
  });
  order.restaurant = restaurant;
  res.status(201).json({ order: orderOut(order) });
});

router.get('/mine', async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(200).populate('restaurant', 'slug');
  const now = Date.now();
  res.json({ orders: orders.map(o => orderOut(o, now)) });
});

router.get('/:id', validate(idParams, 'params'), async (req, res) => {
  res.json({ order: orderOut(await findMine(req)) });
});

router.post('/:id/rate', validate(idParams, 'params'), validate(rateSchema), async (req, res) => {
  const order = await findMine(req);
  if (progress(order).stage !== 'delivered') throw badRequest('You can rate your order once it has been delivered.', 'not_delivered');
  if (order.rating && order.rating.stars) throw conflict('You’ve already rated this order.', 'already_rated');
  order.rating = { stars: req.body.stars, comment: req.body.comment, ratedAt: new Date() };
  await order.save();
  res.json({ order: orderOut(order) });
});

/* Demo helper: jumps the order to its next stage by moving startAt back. */
router.post('/:id/skip', validate(idParams, 'params'), async (req, res) => {
  if (!(config.demoSpeed > 1)) throw forbidden('Skipping is only available in demo mode (DEMO_SPEED above 1).');
  const order = await findMine(req);
  const ms = skipShiftMs(order);
  if (ms > 0) {
    order.startAt = new Date(order.startAt.getTime() - ms);
    await order.save();
  }
  res.json({ order: orderOut(order) });
});

module.exports = router;
