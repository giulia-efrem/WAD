'use strict';

const config = require('../config');

/* Same timeline as plan() and progress() in the reference front end, counted in simulated
   minutes from startAt. One simulated minute lasts config.simMinuteMs real milliseconds. */
function plan(etaMin) {
  const total = etaMin;
  const prep = Math.round(total * 0.45);
  return { confirm: 1, prepStart: 2, pickup: 2 + prep, onway: 5 + prep, total };
}

function progress(order, now = Date.now(), simMs = config.simMinuteMs) {
  const startAt = new Date(order.startAt).getTime();
  const pl = plan(order.etaMin);
  if (now < startAt) return { stage: 'scheduled', sim: 0, remaining: pl.total, frac: 0, plan: pl };
  const sim = (now - startAt) / simMs;
  let stage = 'delivered';
  if (sim < pl.confirm) stage = 'placed';
  else if (sim < pl.prepStart) stage = 'confirmed';
  else if (sim < pl.pickup) stage = 'preparing';
  else if (sim < pl.onway) stage = 'pickup';
  else if (sim < pl.total) stage = 'onway';
  const remaining = Math.max(0, Math.ceil(pl.total - sim));
  const frac = stage === 'onway' ? (sim - pl.onway) / (pl.total - pl.onway) : stage === 'delivered' ? 1 : 0;
  return { stage, sim, remaining, frac, plan: pl };
}

/* How far startAt must move back so the order reaches its next stage (the reference's skip). */
function skipShiftMs(order, now = Date.now(), simMs = config.simMinuteMs) {
  const pr = progress(order, now, simMs);
  if (pr.stage === 'scheduled') return new Date(order.startAt).getTime() - now + 50;
  const pl = pr.plan;
  const next = [pl.confirm, pl.prepStart, pl.pickup, pl.onway, pl.total].find(b => b > pr.sim + 0.01);
  return next ? (next - pr.sim) * simMs + 50 : 0;
}

module.exports = { plan, progress, skipShiftMs };
