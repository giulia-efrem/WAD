'use strict';

/* About 300 past orders over the last 30 days, so the admin dashboard has something to show.
   A seeded random generator keeps them the same shape on every run; times follow lunch and
   dinner peaks and only fall inside each restaurant's opening hours. */

const { priceLine, computePricing } = require('../server/lib/pricing');
const { isOpenAt } = require('../server/lib/hours');
const { defaultPrep, DEMO_COURIERS } = require('../server/lib/orderFlow');

function rng(seedText) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rand, list) => list[Math.floor(rand() * list.length)];

const FIRST = ['Hannah', 'Mihai', 'Clara', 'Victor', 'Lucia', 'Erik', 'Nora', 'Paul', 'Alina', 'Jonah', 'Sara', 'Tudor', 'Eva', 'Marius', 'Lea', 'Robert', 'Irina', 'Oliver', 'Maria', 'Stefan'];
const LAST = ['Weber', 'Popescu', 'Fischer', 'Dumitru', 'Costa', 'Lindqvist', 'Marin', 'Keller', 'Stan', 'Brooks', 'Ilie', 'Moreau', 'Varga', 'Nagy', 'Ricci', 'Hughes', 'Toma', 'Berg', 'Lupu', 'Klein'];
const STREETS = ['Maple Avenue', 'Linden Street', 'Harbour Road', 'Chestnut Lane', 'Mill Street', 'Park Row', 'Station Road', 'Willow Close', 'Castle Street', 'River Walk', 'Orchard Way', 'Market Square'];
const AREAS = ['Old Town', 'Riverside', 'University Quarter', 'Harbour District', 'Northside', 'Green Park'];
const NOTES = ['', '', '', '', 'Ring the bell twice', 'Leave it at the door', 'Call when you’re outside', 'Side entrance, blue gate'];
const REJECT = ['Too busy right now', 'Ran out of a key ingredient', 'Closing early tonight'];

function customers(count, domain) {
  const rand = rng('history-customers');
  return Array.from({ length: count }, (_, i) => {
    const first = FIRST[i % FIRST.length], last = LAST[(i * 7) % LAST.length];
    return {
      name: `${first} ${last}`,
      email: `${first}.${last}`.toLowerCase().normalize('NFD').replace(/[^a-z.]/g, '') + `@${domain}`,
      address: { label: 'Home', street: `${2 + Math.floor(rand() * 90)} ${pick(rand, STREETS)}`, details: rand() < 0.5 ? `Flat ${1 + Math.floor(rand() * 12)}` : '', city: pick(rand, AREAS), isDefault: true }
    };
  });
}

/* A minute of the day weighted towards lunch and dinner. */
function mealMinute(rand) {
  const x = rand();
  if (x < 0.32) return 690 + Math.floor(rand() * 180);   /* 11:30 to 14:30 */
  if (x < 0.82) return 1080 + Math.floor(rand() * 270);  /* 18:00 to 22:30 */
  if (x < 0.92) return 450 + Math.floor(rand() * 180);   /* breakfast */
  return Math.floor(rand() * 1440);
}

/* A plain version of a dish: the first choice of every required option. */
function standardLine(rand, dish) {
  const options = {};
  for (const g of dish.optionGroups) if (g.type === 'one') options[g.key] = g.choices[0].id;
  return { itemSlug: dish.slug, qty: rand() < 0.2 ? 2 : 1, options, remove: [], parts: {}, note: '' };
}

/* restaurants: the saved Restaurant documents. users: saved history customers. couriers: seeded courier users. */
function historyOrders({ restaurants, users, couriers, promos, now = Date.now() }) {
  const rand = rng('history-orders');
  const orders = [];
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const firstOrder = new Set();
  for (let day = 30; day >= 0; day--) {
    const date = new Date(today.getTime() - day * 86400000);
    const weekend = [0, 5, 6].includes(date.getDay());
    let count = (weekend ? 11 : 8) + Math.floor(rand() * 5);
    if (day === 0) count = Math.max(0, Math.round(count * ((now - today.getTime()) / 86400000)));
    for (let n = 0; n < count; n++) {
      let minute, open, tries = 0;
      do {
        minute = mealMinute(rand);
        open = restaurants.filter(r => isOpenAt(r.hours, minute));
        tries++;
      } while ((!open.length || date.getTime() + minute * 60000 > now - 45 * 60000) && tries < 40);
      if (!open.length || date.getTime() + minute * 60000 > now - 45 * 60000) continue;
      /* Popular restaurants get more orders. */
      const r = rand() < 0.4 ? pick(rand, open.slice(0, Math.max(1, Math.ceil(open.length / 2)))) : pick(rand, open);
      const user = pick(rand, users);
      const dishes = r.menu.flatMap(s => s.items).filter(it => it.kind !== 'deal' && it.kind !== 'drink');
      const popular = dishes.filter(d => d.popular);
      const drinks = r.menu.flatMap(s => s.items).filter(it => it.kind === 'drink');
      const lines = [];
      const want = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < want; k++) {
        const dish = rand() < 0.6 && popular.length ? pick(rand, popular) : pick(rand, dishes);
        if (!lines.some(l => l.itemSlug === dish.slug)) lines.push(standardLine(rand, dish));
      }
      if (drinks.length && rand() < 0.35) lines.push(standardLine(rand, pick(rand, drinks)));
      const items = lines.map(l => priceLine(r, l));
      const subtotal = items.reduce((s, l) => s + l.unitPrice * l.qty, 0);
      let promo = null;
      const key = String(user._id);
      if (!firstOrder.has(key)) { firstOrder.add(key); if (rand() < 0.5) promo = promos.WELCOME20; }
      else if (r.deliveryFee && rand() < 0.08) promo = promos.FREEDEL;
      const tip = pick(rand, [0, 0, 100, 100, 200, 300]);
      const pricing = computePricing({ restaurant: r, subtotal, promo, tip });

      const placed = new Date(date.getTime() + minute * 60000 + Math.floor(rand() * 60000));
      const etaMin = Math.round((r.eta.min + r.eta.max) / 2);
      const prep = defaultPrep(etaMin) + Math.floor(rand() * 6) - 2;
      const at = m => new Date(placed.getTime() + m * 60000);
      const cancelled = rand() < 0.05;
      let timeline, status, statusAt, courier = { user: null, name: '', vehicle: '' }, cancelReason = '';
      if (cancelled) {
        cancelReason = pick(rand, REJECT);
        timeline = [{ status: 'placed', at: placed, by: 'customer' }, { status: 'cancelled', at: at(2), by: 'partner', note: cancelReason }];
        status = 'cancelled'; statusAt = at(2);
      } else {
        if (rand() < 0.55) { const c = pick(rand, couriers); courier = { user: c._id, name: c.name.split(' ')[0], vehicle: c.vehicle }; }
        else { const [name, vehicle] = pick(rand, DEMO_COURIERS); courier = { user: null, name, vehicle }; }
        const ready = 3 + prep, picked = ready + 2 + Math.floor(rand() * 4), done = Math.max(picked + 6, etaMin + Math.floor(rand() * 10) - 4);
        timeline = [
          { status: 'placed', at: placed, by: 'customer' },
          { status: 'accepted', at: at(1 + rand()), by: 'partner' },
          { status: 'preparing', at: at(2 + rand()), by: 'partner' },
          { status: 'ready', at: at(ready), by: 'partner' },
          { status: 'pickedup', at: at(picked), by: 'courier' },
          { status: 'delivered', at: at(done), by: 'courier' }
        ];
        status = 'delivered'; statusAt = at(done);
      }
      orders.push({
        user: user._id, customerName: user.name,
        restaurant: r._id, restaurantName: r.name,
        items, pricing,
        address: { label: user.addresses[0].label, street: user.addresses[0].street, details: user.addresses[0].details, city: user.addresses[0].city },
        payment: rand() < 0.8 ? 'card' : 'cash',
        courierNote: pick(rand, NOTES),
        delivery: { type: 'asap' },
        promoCode: promo && (pricing.discount || pricing.deliveryDiscount) ? promo.code : null,
        etaMin, startAt: placed,
        status, statusAt, timeline, prepMinutes: prep, courier, cancelReason,
        seeded: true,
        createdAt: placed, updatedAt: statusAt
      });
    }
  }
  return orders;
}

module.exports = { customers, historyOrders, rng };
