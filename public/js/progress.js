/* The server decides each order's status (placed, accepted, preparing, ready, pickedup,
   delivered or cancelled). This works out the minutes left and where the courier is on the map
   between server updates, corrected for clock differences. Keep in step with estimate() in
   server/lib/orderFlow.js. */

export const STEPS = ['placed', 'accepted', 'preparing', 'ready', 'pickedup', 'delivered'];
export const STEP_LABELS = { placed: 'Placed', accepted: 'Accepted', preparing: 'Preparing', ready: 'Ready', pickedup: 'Picked up', delivered: 'Delivered', cancelled: 'Cancelled' };
const PICKUP_MINUTES = 3;

export const serverNow = o => Date.now() + (o.clockOffset || 0);
export const isLive = o => o.status !== 'delivered' && o.status !== 'cancelled';

/* stage: the status, or 'scheduled' before a scheduled order starts.
   step: how far along the six steps it is (0-5), plus the share of the way to the next one. */
export function progress(o, now = serverNow(o)) {
  const status = o.status;
  const prep = o.prepMinutes, travel = o.travelMinutes;
  const index = STEPS.indexOf(status);
  if (status === 'delivered') return { stage: status, index, remaining: 0, frac: 1, next: 0 };
  if (status === 'cancelled') return { stage: status, index: -1, remaining: 0, frac: 0, next: 0 };
  if (now < o.startAt && (status === 'placed' || status === 'accepted')) {
    return { stage: 'scheduled', index, remaining: 2 + prep + PICKUP_MINUTES + travel, frac: 0, next: 0 };
  }
  const ahead = { placed: [1, 1, prep, PICKUP_MINUTES, travel], accepted: [1, prep, PICKUP_MINUTES, travel], preparing: [prep, PICKUP_MINUTES, travel], ready: [PICKUP_MINUTES, travel], pickedup: [travel] }[status];
  const elapsed = Math.max(0, (now - Math.max(o.statusAt, o.startAt)) / o.simMinuteMs);
  const current = Math.max(status === 'pickedup' ? 1 : 0, ahead[0] - elapsed);
  const remaining = Math.max(1, Math.ceil(current + ahead.slice(1).reduce((s, x) => s + x, 0)));
  const frac = status === 'pickedup' ? Math.min(0.96, elapsed / travel) : 0;
  /* Share of the current step done, kept under 90% until someone actually takes the next step. */
  const next = Math.min(0.9, elapsed / Math.max(1, ahead[0]));
  return { stage: status, index, remaining, frac, next };
}
