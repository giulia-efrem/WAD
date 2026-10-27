'use strict';

const express = require('express');
const { z } = require('zod');
const Order = require('../models/Order');
const validate = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');
const { objectId } = require('../lib/schemas');
const flow = require('../lib/orderFlow');
const { orderOut } = require('../lib/present');
const { notFound, conflict, badRequest } = require('../lib/httpError');

/* /api/courier: available deliveries, the courier's current one, and today's earnings. */
const router = express.Router();
router.use(requireRole('courier'));

/* What a courier earns per delivery, before the customer's tip. */
const PAY_PER_DELIVERY = 350;
const TAKEABLE = ['accepted', 'preparing', 'ready'];
const idParams = z.object({ id: objectId('order') });

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const noCourier = { 'courier.name': { $in: ['', null] } };
const firstName = name => (name || '').trim().split(/\s+/)[0] || 'Your courier';

/* Before accepting, a courier sees the pickup and the area, not the customer's address. */
const preview = o => {
  const full = orderOut(o);
  return {
    _id: full._id, restaurantName: full.restaurantName, restaurantSlug: full.restaurantSlug, status: full.status,
    area: full.address.city, itemCount: full.items.reduce((s, l) => s + l.qty, 0), prepMinutes: full.prepMinutes,
    travelMinutes: full.travelMinutes, statusAt: full.statusAt, payment: full.payment,
    earnings: PAY_PER_DELIVERY + (full.pricing.tip || 0)
  };
};

router.get('/deliveries', async (req, res) => {
  flow.seenCourier();
  const now = new Date();
  const [available, mine, today] = await Promise.all([
    Order.find({ status: { $in: TAKEABLE }, startAt: { $lte: now }, ...noCourier }).sort({ createdAt: 1 }).limit(30).populate('restaurant', 'slug'),
    Order.find({ 'courier.user': req.user._id, status: { $in: flow.ACTIVE } }).sort({ createdAt: 1 }).populate('restaurant', 'slug'),
    Order.find({ 'courier.user': req.user._id, status: 'delivered', statusAt: { $gte: startOfToday() } }).sort({ statusAt: -1 }).populate('restaurant', 'slug')
  ]);
  const tips = today.reduce((s, o) => s + (o.pricing.tip || 0), 0);
  res.json({
    available: available.map(preview),
    current: mine.map(o => orderOut(o)),
    today: {
      deliveries: today.length,
      pay: today.length * PAY_PER_DELIVERY,
      tips,
      earnings: today.length * PAY_PER_DELIVERY + tips,
      list: today.map(o => ({ _id: String(o._id), restaurantName: o.restaurantName, area: o.address.city, deliveredAt: o.statusAt, earnings: PAY_PER_DELIVERY + (o.pricing.tip || 0) }))
    },
    payPerDelivery: PAY_PER_DELIVERY,
    serverNow: Date.now()
  });
});

/* One delivery at a time. The update only succeeds if nobody else took the order first. */
router.post('/deliveries/:id/accept', validate(idParams, 'params'), async (req, res) => {
  const busy = await Order.exists({ 'courier.user': req.user._id, status: { $in: flow.ACTIVE } });
  if (busy) throw badRequest('Finish your current delivery before taking another one.', 'courier_busy');
  const done = await Order.findOneAndUpdate(
    { _id: req.valid.params.id, status: { $in: TAKEABLE }, ...noCourier },
    { $set: { 'courier.user': req.user._id, 'courier.name': firstName(req.user.name), 'courier.vehicle': req.user.vehicle || 'bike' } },
    { returnDocument: 'after' }
  ).populate('restaurant', 'slug');
  if (!done) throw conflict('Another courier has just taken this delivery.', 'delivery_taken');
  res.json({ order: orderOut(done) });
});

async function myDelivery(req) {
  const order = await Order.findOne({ _id: req.valid.params.id, 'courier.user': req.user._id });
  if (!order) throw notFound('That isn’t one of your deliveries.');
  return order;
}

router.post('/deliveries/:id/pickedup', validate(idParams, 'params'), async (req, res) => {
  const order = await myDelivery(req);
  if (order.status !== 'ready') throw badRequest('The restaurant hasn’t marked this order ready yet.', 'not_ready');
  const done = await flow.advance(order, 'ready', 'pickedup', 'courier');
  res.json({ order: orderOut(await done.populate('restaurant', 'slug')) });
});

router.post('/deliveries/:id/delivered', validate(idParams, 'params'), async (req, res) => {
  const order = await myDelivery(req);
  if (order.status !== 'pickedup') throw badRequest('Mark the order picked up first.', 'not_picked_up');
  const done = await flow.advance(order, 'pickedup', 'delivered', 'courier');
  res.json({ order: orderOut(await done.populate('restaurant', 'slug')) });
});

module.exports = router;
