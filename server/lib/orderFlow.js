'use strict';

const crypto = require('crypto');
const config = require('../config');
const Order = require('../models/Order');
const { getSetting } = require('../models/Setting');
const { conflict, badRequest } = require('./httpError');

/* Orders move placed → accepted → preparing → ready → pickedup → delivered, or end as cancelled.
   The restaurant partner does the first three steps, a courier the last two, and an admin can
   set any status. With the demo autopilot on (the default), the server takes a step itself when
   nobody has, using the same pace as before: one simulated minute lasts config.simMinuteMs. */

const STEPS = ['placed', 'accepted', 'preparing', 'ready', 'pickedup', 'delivered'];
const ACTIVE = ['placed', 'accepted', 'preparing', 'ready', 'pickedup'];
const DEMO_COURIERS = [['Luca', 'bike'], ['Maya', 'scooter'], ['Andrei', 'bike'], ['Sofia', 'scooter'], ['Tom', 'bike'], ['Ines', 'scooter']];

/* Simulated minutes each step takes when the autopilot runs it. */
const defaultPrep = etaMin => Math.max(5, Math.round(etaMin * 0.45));
const travelMinutes = etaMin => Math.max(4, etaMin - 5 - defaultPrep(etaMin));
const PICKUP_MINUTES = 3;

/* ---------- Presence: who has their staff page open (kept in memory, 30 s window) ---------- */
const PRESENCE_MS = 30000;
const partnerSeen = new Map();
let courierSeen = 0;
const seenPartner = restaurantId => partnerSeen.set(String(restaurantId), Date.now());
const seenCourier = () => { courierSeen = Date.now(); };
const partnerOnline = restaurantId => Date.now() - (partnerSeen.get(String(restaurantId)) || 0) < PRESENCE_MS;
const courierOnline = () => Date.now() - courierSeen < PRESENCE_MS;

const startOf = o => Math.max(new Date(o.statusAt || o.createdAt).getTime(), new Date(o.startAt).getTime());

/* An estimate for the tracking page: minutes left and how far along the map the courier is. */
function estimate(o, now = Date.now(), simMs = config.simMinuteMs) {
  const prep = o.prepMinutes || defaultPrep(o.etaMin);
  const travel = travelMinutes(o.etaMin);
  const status = o.status || 'placed';
  if (status === 'delivered' || status === 'cancelled') return { remaining: 0, frac: status === 'delivered' ? 1 : 0, prep, travel };
  if (now < new Date(o.startAt).getTime() && (status === 'placed' || status === 'accepted')) {
    return { remaining: 1 + 1 + prep + PICKUP_MINUTES + travel, frac: 0, prep, travel, scheduled: true };
  }
  const ahead = { placed: [1, 1, prep, PICKUP_MINUTES, travel], accepted: [1, prep, PICKUP_MINUTES, travel], preparing: [prep, PICKUP_MINUTES, travel], ready: [PICKUP_MINUTES, travel], pickedup: [travel] }[status];
  const elapsed = Math.max(0, (now - startOf(o)) / simMs);
  const current = Math.max(status === 'pickedup' ? 1 : 0, ahead[0] - elapsed);
  const remaining = Math.max(1, Math.ceil(current + ahead.slice(1).reduce((s, x) => s + x, 0)));
  const frac = status === 'pickedup' ? Math.min(0.96, elapsed / travel) : 0;
  return { remaining, frac, prep, travel };
}

/* ---------- Taking a step ---------- */

/* Moves the order from one of `from` to `to`, only if nobody has moved it in the meantime.
   Returns the updated order, or throws 409 order_changed. */
async function advance(order, from, to, by, { note = '', set = {}, quiet = false } = {}) {
  const now = new Date();
  const fromList = Array.isArray(from) ? from : [from];
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: { $in: fromList } },
    { $set: { status: to, statusAt: now, ...set }, $push: { timeline: { status: to, at: now, by, note } } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    if (quiet) return null;
    throw conflict('This order has changed in the meantime. Refresh to see where it is now.', 'order_changed');
  }
  return updated;
}

const demoCourier = () => { const [name, vehicle] = DEMO_COURIERS[crypto.randomInt(DEMO_COURIERS.length)]; return { 'courier.user': null, 'courier.name': name, 'courier.vehicle': vehicle }; };
const hasCourier = o => !!(o.courier && (o.courier.user || o.courier.name));

/* The next step after `status`, as the autopilot or the demo "skip" button would take it. */
function nextStep(o) {
  const set = {};
  switch (o.status) {
    case 'placed': if (!o.prepMinutes) set.prepMinutes = defaultPrep(o.etaMin); return { from: 'placed', to: 'accepted', set };
    case 'accepted': return { from: 'accepted', to: 'preparing', set };
    case 'preparing': return { from: 'preparing', to: 'ready', set };
    case 'ready': return { from: 'ready', to: 'pickedup', set: hasCourier(o) ? set : demoCourier() };
    case 'pickedup': return { from: 'pickedup', to: 'delivered', set };
    default: return null;
  }
}

/* Demo helper behind "Skip to next step": takes the next step at once. */
async function skip(order) {
  const step = nextStep(order);
  if (!step) return order;
  const set = { ...step.set };
  /* A scheduled order that's skipped starts now. */
  if (new Date(order.startAt).getTime() > Date.now()) set.startAt = new Date();
  return (await advance(order, step.from, step.to, 'autopilot', { note: 'Skipped ahead (demo)', set, quiet: true })) || Order.findById(order._id);
}

/* Admin: any status. Moving to picked up or delivered without a courier assigns a demo one. */
async function adminSet(order, to, { reason = '' } = {}) {
  if (to === order.status) return order;
  if (to === 'cancelled') return cancel(order, 'admin', reason || 'Cancelled by Morsel support');
  const set = { cancelReason: '' };
  if ((to === 'pickedup' || to === 'delivered') && !hasCourier(order)) Object.assign(set, demoCourier());
  if (STEPS.indexOf(to) >= 1 && !order.prepMinutes) set.prepMinutes = defaultPrep(order.etaMin);
  return advance(order, order.status, to, 'admin', { set, note: 'Set by an admin' });
}

/* Orders can be cancelled until the courier has picked them up. */
async function cancel(order, by, reason) {
  const from = by === 'customer' ? ['placed'] : by === 'admin' ? ACTIVE.concat(['delivered']) : ['placed', 'accepted', 'preparing', 'ready'];
  if (!from.includes(order.status)) {
    throw badRequest(by === 'customer' ? 'The restaurant has already accepted this order, so it can’t be cancelled here. Contact support.' : 'This order can no longer be cancelled.', 'not_cancellable');
  }
  return advance(order, from, 'cancelled', by, { note: reason, set: { cancelReason: reason } });
}

/* ---------- The autopilot ---------- */

let timer = null;
let running = false;

/* One pass over the active orders. Partner steps wait while that restaurant's partner page is
   open, and courier steps never touch an order a real courier has accepted. */
async function tick(now = Date.now()) {
  if (running) return;
  running = true;
  try {
    if (!(await getSetting('autopilot'))) return;
    const simMs = config.simMinuteMs;
    const orders = await Order.find({ status: { $in: ACTIVE }, startAt: { $lte: new Date(now) } }).limit(500);
    for (const o of orders) {
      const elapsed = (now - startOf(o)) / simMs;
      const prep = o.prepMinutes || defaultPrep(o.etaMin);
      const rest = String(o.restaurant);
      let step = null;
      if (o.status === 'placed' && elapsed >= 1 && !partnerOnline(rest)) step = nextStep(o);
      else if (o.status === 'accepted' && elapsed >= 1 && !partnerOnline(rest)) step = nextStep(o);
      else if (o.status === 'preparing' && elapsed >= prep && !partnerOnline(rest)) step = nextStep(o);
      else if (o.status === 'ready' && !(o.courier && o.courier.user)) {
        /* Real couriers online get the chance to take it first. */
        if (!hasCourier(o) && courierOnline()) continue;
        if (!hasCourier(o)) { await Order.updateOne({ _id: o._id, status: 'ready', 'courier.user': null }, { $set: demoCourier() }); continue; }
        if (elapsed >= PICKUP_MINUTES) step = nextStep(o);
      } else if (o.status === 'pickedup' && !(o.courier && o.courier.user) && elapsed >= travelMinutes(o.etaMin)) step = nextStep(o);
      if (step) await advance(o, step.from, step.to, 'autopilot', { set: step.set, quiet: true });
    }
  } catch (err) {
    console.error('Autopilot:', err.message);
  } finally {
    running = false;
  }
}

function startAutopilot() {
  if (timer) return;
  const every = Math.max(500, Math.min(5000, Math.round(config.simMinuteMs / 2)));
  timer = setInterval(() => { tick(); }, every);
  timer.unref();
}

/* Orders from before statuses existed: finished ones count as delivered. */
async function migrate() {
  const old = await Order.find({ status: { $exists: false } }).limit(5000);
  for (const o of old) {
    const done = Date.now() - new Date(o.startAt).getTime() > o.etaMin * config.simMinuteMs;
    const at = done ? new Date(new Date(o.startAt).getTime() + o.etaMin * config.simMinuteMs) : new Date();
    await Order.updateOne({ _id: o._id }, { $set: { status: done ? 'delivered' : 'placed', statusAt: at, timeline: [{ status: done ? 'delivered' : 'placed', at, by: 'autopilot', note: 'Migrated' }], prepMinutes: defaultPrep(o.etaMin) } });
  }
}

module.exports = {
  STEPS, ACTIVE, DEMO_COURIERS, PICKUP_MINUTES, defaultPrep, travelMinutes,
  seenPartner, seenCourier, partnerOnline, courierOnline,
  estimate, advance, nextStep, skip, adminSet, cancel, hasCourier, tick, startAutopilot, migrate
};
