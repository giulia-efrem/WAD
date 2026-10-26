/* The server decides each order's status (order.status). The tracking page runs the same
   timeline here, corrected for clock differences, so bars and the courier move smoothly
   between server updates. Keep in step with server/lib/orderStatus.js. */

export function plan(o) {
  const total = o.etaMin;
  const prep = Math.round(total * 0.45);
  return { confirm: 1, prepStart: 2, pickup: 2 + prep, onway: 5 + prep, total };
}

export const serverNow = o => Date.now() + (o.clockOffset || 0);

export function progress(o, now = serverNow(o)) {
  const pl = plan(o);
  if (now < o.startAt) return { stage: 'scheduled', sim: 0, remaining: pl.total, pl, frac: 0 };
  const sim = (now - o.startAt) / o.simMinuteMs;
  let stage = 'delivered';
  if (sim < pl.confirm) stage = 'placed';
  else if (sim < pl.prepStart) stage = 'confirmed';
  else if (sim < pl.pickup) stage = 'preparing';
  else if (sim < pl.onway) stage = 'pickup';
  else if (sim < pl.total) stage = 'onway';
  const remaining = Math.max(0, Math.ceil(pl.total - sim));
  const frac = stage === 'onway' ? (sim - pl.onway) / (pl.total - pl.onway) : stage === 'delivered' ? 1 : 0;
  return { stage, sim, remaining, pl, frac };
}
