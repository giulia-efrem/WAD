'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');
const Review = require('../models/Review');
const User = require('../models/User');
const Promo = require('../models/Promo');
const { getSetting, setSetting } = require('../models/Setting');
const validate = require('../middleware/validate');
const { requireAdmin } = require('../middleware/auth');
const { objectId, slug } = require('../lib/schemas');
const flow = require('../lib/orderFlow');
const { refreshRating, reviewOut } = require('../lib/reviews');
const { promoOut } = require('../lib/pricing');
const { orderOut, restaurantDetail } = require('../lib/present');
const { badRequest, notFound, conflict } = require('../lib/httpError');

/* The admin dashboard's API (/api/admin). The photo routes live in admin.js. */
const router = express.Router();
router.use(requireAdmin);

const DAY = 86400000;
const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d; };
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const slugify = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/* ================= Overview ================= */

router.get('/overview', async (req, res) => {
  const today = startOfDay();
  const from14 = new Date(today.getTime() - 13 * DAY);
  const from30 = new Date(today.getTime() - 29 * DAY);
  const counted = { status: { $ne: 'cancelled' } };
  const kpi = async (from, to) => {
    const [row] = await Order.aggregate([
      { $match: { createdAt: { $gte: from, $lt: to }, ...counted } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } }
    ]);
    const orders = row ? row.orders : 0, revenue = row ? row.revenue : 0;
    return { orders, revenue, average: orders ? Math.round(revenue / orders) : 0 };
  };
  const [todayK, yesterdayK, daily, dishes, restaurants, rating, live, cancelledToday] = await Promise.all([
    kpi(today, new Date(today.getTime() + DAY)),
    kpi(new Date(today.getTime() - DAY), new Date(Date.now() - DAY)),
    Order.aggregate([
      { $match: { createdAt: { $gte: from14 }, ...counted } },
      { $project: { revenue: '$pricing.total', day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } } } },
      { $group: { _id: '$day', orders: { $sum: 1 }, revenue: { $sum: '$revenue' } } }
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: from30 }, ...counted } },
      { $unwind: '$items' },
      { $group: { _id: { r: '$restaurantName', d: '$items.name' }, qty: { $sum: '$items.qty' }, revenue: { $sum: { $multiply: ['$items.qty', '$items.unitPrice'] } } } },
      { $sort: { qty: -1, revenue: -1 } }, { $limit: 8 }
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: from30 }, ...counted } },
      { $group: { _id: '$restaurant', name: { $first: '$restaurantName' }, orders: { $sum: 1 }, revenue: { $sum: '$pricing.total' } } },
      { $sort: { revenue: -1 } }, { $limit: 9 }
    ]),
    Review.aggregate([{ $match: { hidden: { $ne: true } } }, { $group: { _id: null, avg: { $avg: '$food' }, count: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { status: { $in: flow.ACTIVE } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Order.countDocuments({ createdAt: { $gte: today }, status: 'cancelled' })
  ]);
  /* Every one of the 14 days, including days without orders. */
  const byDay = new Map(daily.map(d => [d._id, d]));
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(from14.getTime() + i * DAY + 12 * 3600000);
    const row = byDay.get(dayKey(d));
    return { date: dayKey(d), orders: row ? row.orders : 0, revenue: row ? row.revenue : 0 };
  });
  res.json({
    today: { ...todayK, cancelled: cancelledToday },
    /* Yesterday up to the same time of day, for a fair comparison. */
    yesterday: yesterdayK,
    rating: rating[0] ? { average: Math.round(rating[0].avg * 10) / 10, count: rating[0].count } : { average: 0, count: 0 },
    days,
    topDishes: dishes.map(d => ({ name: d._id.d, restaurant: d._id.r, qty: d.qty, revenue: d.revenue })),
    topRestaurants: restaurants.map(r => ({ _id: String(r._id), name: r.name, orders: r.orders, revenue: r.revenue })),
    live: Object.fromEntries(flow.ACTIVE.map(s => [s, (live.find(x => x._id === s) || { n: 0 }).n])),
    autopilot: !!(await getSetting('autopilot'))
  });
});

/* ================= Settings ================= */

router.get('/settings', async (req, res) => {
  res.json({ autopilot: !!(await getSetting('autopilot')) });
});

router.put('/settings', validate(z.object({ autopilot: z.boolean({ error: 'Turn the autopilot on or off.' }) })), async (req, res) => {
  await setSetting('autopilot', req.body.autopilot);
  res.json({ autopilot: req.body.autopilot });
});

/* ================= Restaurants ================= */

const cents = (what, max = 100000) => z.number({ error: `Enter ${what}.` }).int(`${what[0].toUpperCase() + what.slice(1)} must be in whole cents.`).min(0, `${what[0].toUpperCase() + what.slice(1)} can’t be negative.`).max(max, `That ${what} is too high.`);
const minute = z.number().int().min(0).max(2880);
const hex = z.string().trim().regex(/^#[0-9a-fA-F]{3,8}$/, 'Colours look like #FFE2D1.');
const ILLUSTRATIONS = ['pizza', 'burger', 'ramen', 'sushi', 'bowl', 'taco', 'cupcake', 'breakfast', 'curry'];

const restaurantFields = {
  name: z.string({ error: 'Enter the restaurant’s name.' }).trim().min(2, 'Enter the restaurant’s name.').max(60, 'Use a shorter name.'),
  cuisines: z.array(z.string().trim().min(1).max(30)).max(6, 'Up to 6 cuisines.'),
  label: z.string().trim().max(40),
  tagline: z.string().trim().max(140, 'Keep the tagline under 140 characters.'),
  priceLevel: z.enum(['€', '€€', '€€€'], { error: 'Choose €, €€ or €€€.' }),
  eta: z.object({ min: z.number().int().min(5).max(120), max: z.number().int().min(5).max(180) }, { error: 'Enter the delivery time.' }).refine(e => e.max >= e.min, 'The longest delivery time must be at least the shortest.'),
  deliveryFee: cents('a delivery fee', 2000),
  minOrder: cents('a minimum order', 10000),
  hours: z.array(z.object({ open: minute, close: minute }).refine(h => h.close > h.open, 'Closing time must be after opening time (use times after midnight like 01:00 for late nights).')).min(1, 'Add opening hours.').max(4),
  color: hex,
  ink: hex,
  illustration: z.enum(ILLUSTRATIONS, { error: 'Choose an illustration.' }),
  paused: z.boolean()
};
const createRestaurant = z.object({ ...restaurantFields, cuisines: restaurantFields.cuisines.optional().default([]), label: restaurantFields.label.optional().default(''), tagline: restaurantFields.tagline.optional().default(''), priceLevel: restaurantFields.priceLevel.optional().default('€€'), color: hex.optional().default('#FFE2D1'), ink: hex.optional().default('#8A3413'), illustration: restaurantFields.illustration.optional().default('bowl'), paused: z.boolean().optional().default(false) });
const updateRestaurant = z.object(restaurantFields).partial();
const slugParams = z.object({ slug });

const restaurantRow = (r, counts) => ({
  _id: String(r._id), slug: r.slug, name: r.name, label: r.label, cuisines: r.cuisines, tagline: r.tagline, priceLevel: r.priceLevel,
  rating: r.rating, reviewCount: r.reviewCount, eta: r.eta, deliveryFee: r.deliveryFee, minOrder: r.minOrder,
  hours: r.hours.map(h => ({ open: h.open, close: h.close })), color: r.color, ink: r.ink, illustration: r.illustration,
  image: r.image || '', paused: !!r.paused, seeded: !!r.seeded,
  dishes: r.menu.reduce((s, x) => s + x.items.length, 0), soldOut: r.menu.reduce((s, x) => s + x.items.filter(i => i.soldOut).length, 0),
  ordersToday: counts.get(String(r._id)) || 0
});

router.get('/restaurants', async (req, res) => {
  const [list, today] = await Promise.all([
    Restaurant.find().sort({ sortOrder: 1, name: 1 }),
    Order.aggregate([{ $match: { createdAt: { $gte: startOfDay() }, status: { $ne: 'cancelled' } } }, { $group: { _id: '$restaurant', n: { $sum: 1 } } }])
  ]);
  const counts = new Map(today.map(x => [String(x._id), x.n]));
  res.json({ restaurants: list.map(r => restaurantRow(r, counts)) });
});

router.post('/restaurants', validate(createRestaurant), async (req, res) => {
  const base = slugify(req.body.name) || 'restaurant';
  let s = base, n = 2;
  while (await Restaurant.exists({ slug: s })) s = `${base}-${n++}`;
  const last = await Restaurant.findOne().sort({ sortOrder: -1 });
  const r = await Restaurant.create({ ...req.body, slug: s, sortOrder: last ? last.sortOrder + 1 : 0, menu: [], seeded: false });
  res.status(201).json({ restaurant: restaurantRow(r, new Map()) });
});

router.patch('/restaurants/:slug', validate(slugParams, 'params'), validate(updateRestaurant), async (req, res) => {
  const r = await Restaurant.findOne({ slug: req.valid.params.slug });
  if (!r) throw notFound('We couldn’t find that restaurant.');
  if (req.body.eta && req.body.eta.max < req.body.eta.min) throw badRequest('The longest delivery time must be at least the shortest.');
  Object.assign(r, req.body);
  await r.save();
  res.json({ restaurant: restaurantRow(r, new Map()) });
});

/* ================= Menus ================= */

const id = z.string().trim().min(1).max(40).regex(/^[a-zA-Z0-9-]+$/, 'Ids use letters, numbers and dashes.');
const choiceSchema = z.object({ id, name: z.string().trim().min(1, 'Every choice needs a name.').max(60), price: cents('a choice price', 5000) });
const groupSchema = z.object({
  key: id, name: z.string().trim().min(1, 'Every option group needs a name.').max(40),
  type: z.enum(['one', 'many']), max: z.number().int().min(1).max(10).optional(),
  choices: z.array(choiceSchema).min(1, 'Every option group needs at least one choice.').max(12)
}).refine(g => new Set(g.choices.map(c => c.id)).size === g.choices.length, 'Two choices in a group have the same id.');
const itemFields = {
  category: z.string({ error: 'Choose a category.' }).trim().min(1, 'Choose a category.').max(40),
  name: z.string({ error: 'Enter the dish name.' }).trim().min(2, 'Enter the dish name.').max(60, 'Use a shorter name.'),
  description: z.string().trim().max(240, 'Keep the description under 240 characters.'),
  price: cents('a price', 20000),
  kind: z.enum(['main', 'starter', 'side', 'drink', 'dessert', 'deal']),
  popular: z.boolean(),
  soldOut: z.boolean(),
  tags: z.array(z.enum(['vegetarian', 'vegan', 'spicy', 'gluten-free', 'contains-nuts'])).max(5),
  allergens: z.array(z.string().trim().min(1).max(30)).max(14),
  ingredients: z.array(z.object({ id, name: z.string().trim().min(1).max(60), removable: z.boolean() })).max(20),
  optionGroups: z.array(groupSchema).max(6),
  deal: z.object({
    parts: z.array(z.object({
      key: id, name: z.string().trim().min(1, 'Every part needs a name.').max(40), main: z.boolean().optional().default(false),
      choices: z.array(z.object({ itemSlug: slug, delta: cents('a surcharge', 2000) })).min(1, 'Every part needs at least one dish to choose from.').max(20)
    })).min(2, 'A meal deal has at least two parts.').max(5)
  }).nullable()
};
const createItem = z.object({
  ...itemFields,
  description: itemFields.description.optional().default(''), kind: itemFields.kind.optional().default('main'),
  popular: z.boolean().optional().default(false), soldOut: z.boolean().optional().default(false),
  tags: itemFields.tags.optional().default([]), allergens: itemFields.allergens.optional().default([]),
  ingredients: itemFields.ingredients.optional().default([]), optionGroups: itemFields.optionGroups.optional().default([]),
  deal: itemFields.deal.optional().default(null)
});
const updateItem = z.object(itemFields).partial();
const itemParams = z.object({ slug, itemSlug: slug });

const findIn = (r, itemSlug) => {
  for (const s of r.menu) { const i = s.items.findIndex(x => x.slug === itemSlug); if (i >= 0) return { section: s, index: i, item: s.items[i] }; }
  return null;
};

/* A deal must point at real dishes, and only one part is the main dish (the first if none is marked). */
function checkItem(r, data, selfSlug) {
  if (data.kind === 'deal') {
    if (!data.deal || !data.deal.parts.length) throw badRequest('A meal deal needs its parts (for example burger, side and drink).', 'invalid_deal');
    const keys = new Set();
    data.deal.parts.forEach((p, i) => {
      if (keys.has(p.key)) throw badRequest('Two parts of the deal have the same key.', 'invalid_deal');
      keys.add(p.key);
      for (const c of p.choices) {
        const d = findIn(r, c.itemSlug);
        if (!d || c.itemSlug === selfSlug) throw badRequest(`“${c.itemSlug}” isn’t a dish on this menu.`, 'invalid_deal');
        if (d.item.kind === 'deal') throw badRequest('A meal deal can’t include another meal deal.', 'invalid_deal');
      }
      if (i > 0 && p.main && data.deal.parts.slice(0, i).some(x => x.main)) throw badRequest('Only one part can be the main dish.', 'invalid_deal');
    });
    if (!data.deal.parts.some(p => p.main)) data.deal.parts[0].main = true;
  } else data.deal = null;
  if (new Set((data.optionGroups || []).map(g => g.key)).size !== (data.optionGroups || []).length) throw badRequest('Two option groups have the same key.', 'invalid_option');
  (data.optionGroups || []).forEach(g => { if (g.type === 'many') g.max = Math.min(g.max || g.choices.length, g.choices.length); else delete g.max; });
}

/* Dishes still used in a deal can't be deleted. */
const usedInDeal = (r, itemSlug) => r.menu.flatMap(s => s.items).find(it => it.kind === 'deal' && it.deal && it.deal.parts.some(p => p.choices.some(c => c.itemSlug === itemSlug)));

router.get('/restaurants/:slug/menu', validate(slugParams, 'params'), async (req, res) => {
  const r = await Restaurant.findOne({ slug: req.valid.params.slug });
  if (!r) throw notFound('We couldn’t find that restaurant.');
  /* Admins see the raw deal parts too (restaurantDetail adds names and prices). */
  res.json({ restaurant: restaurantDetail(r), categories: r.menu.map(s => s.category) });
});

router.post('/restaurants/:slug/items', validate(slugParams, 'params'), validate(createItem), async (req, res) => {
  const r = await Restaurant.findOne({ slug: req.valid.params.slug });
  if (!r) throw notFound('We couldn’t find that restaurant.');
  const { category, ...data } = req.body;
  const base = slugify(data.name) || 'dish';
  let s = base, n = 2;
  while (findIn(r, s)) s = `${base}-${n++}`;
  checkItem(r, data, s);
  let section = r.menu.find(x => x.category.toLowerCase() === category.toLowerCase());
  if (!section) { r.menu.push({ category, items: [] }); section = r.menu[r.menu.length - 1]; }
  section.items.push({ ...data, slug: s });
  await r.save();
  res.status(201).json({ restaurant: restaurantDetail(r), itemSlug: s });
});

router.patch('/restaurants/:slug/items/:itemSlug', validate(itemParams, 'params'), validate(updateItem), async (req, res) => {
  const r = await Restaurant.findOne({ slug: req.valid.params.slug });
  if (!r) throw notFound('We couldn’t find that restaurant.');
  const found = findIn(r, req.valid.params.itemSlug);
  if (!found) throw notFound('We couldn’t find that dish.');
  const { category, ...changes } = req.body;
  const current = found.item.toObject();
  const data = { ...current, ...changes };
  if (changes.kind && changes.kind !== 'deal' && current.kind === 'deal') data.deal = null;
  if (data.kind === 'deal' || 'deal' in changes) checkItem(r, data, found.item.slug);
  else if (changes.optionGroups) checkItem(r, data, found.item.slug);
  Object.assign(found.item, changes, { deal: data.deal, optionGroups: data.optionGroups });
  /* Moving to another category. */
  if (category && category.toLowerCase() !== found.section.category.toLowerCase()) {
    const moved = found.section.items.splice(found.index, 1)[0];
    let target = r.menu.find(x => x.category.toLowerCase() === category.toLowerCase());
    if (!target) { r.menu.push({ category, items: [] }); target = r.menu[r.menu.length - 1]; }
    target.items.push(moved.toObject ? moved.toObject() : moved);
    r.menu = r.menu.filter(x => x.items.length);
  }
  await r.save();
  res.json({ restaurant: restaurantDetail(r) });
});

router.delete('/restaurants/:slug/items/:itemSlug', validate(itemParams, 'params'), async (req, res) => {
  const r = await Restaurant.findOne({ slug: req.valid.params.slug });
  if (!r) throw notFound('We couldn’t find that restaurant.');
  const found = findIn(r, req.valid.params.itemSlug);
  if (!found) throw notFound('We couldn’t find that dish.');
  const deal = usedInDeal(r, found.item.slug);
  if (deal) throw conflict(`${found.item.name} is part of the “${deal.name}” meal deal. Remove it from the deal first, or mark it sold out.`, 'in_deal');
  found.section.items.splice(found.index, 1);
  r.menu = r.menu.filter(x => x.items.length);
  await r.save();
  res.json({ restaurant: restaurantDetail(r) });
});

/* ================= Orders ================= */

const ordersQuery = z.object({
  status: z.enum([...Order.STATUSES, 'active', 'all']).optional().default('all'),
  restaurant: slug.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().trim().max(60).optional().default(''),
  page: z.coerce.number().int().min(1).max(500).optional().default(1)
});
const ORDERS_PAGE = 25;
const localDate = (s, endOfDay) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d + (endOfDay ? 1 : 0)); };

router.get('/orders', validate(ordersQuery, 'query'), async (req, res) => {
  const { status, restaurant, from, to, q, page } = req.valid.query;
  const query = {};
  if (status === 'active') query.status = { $in: flow.ACTIVE };
  else if (status !== 'all') query.status = status;
  if (restaurant) {
    const r = await Restaurant.findOne({ slug: restaurant }, { _id: 1 });
    query.restaurant = r ? r._id : null;
  }
  if (from || to) query.createdAt = { ...(from ? { $gte: localDate(from) } : {}), ...(to ? { $lt: localDate(to, true) } : {}) };
  if (q) {
    const re = new RegExp(escapeRe(q), 'i');
    query.$or = [{ customerName: re }, { 'address.street': re }, ...(/^[a-f0-9]{6,24}$/i.test(q) ? [{ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: `${q}$`, options: 'i' } } }] : [])];
  }
  const [total, sums, list] = await Promise.all([
    Order.countDocuments(query),
    /* Revenue never counts cancelled orders. */
    Order.aggregate([{ $match: { ...query, status: status === 'cancelled' ? '__none__' : query.status || { $ne: 'cancelled' } } }, { $group: { _id: null, revenue: { $sum: '$pricing.total' } } }]),
    Order.find(query).sort({ createdAt: -1 }).skip((page - 1) * ORDERS_PAGE).limit(ORDERS_PAGE).populate('restaurant', 'slug')
  ]);
  const now = Date.now();
  res.json({ orders: list.map(o => orderOut(o, now)), total, revenue: sums[0] ? sums[0].revenue : 0, page, pageSize: ORDERS_PAGE, hasMore: page * ORDERS_PAGE < total });
});

router.get('/orders/:id', validate(z.object({ id: objectId('order') }), 'params'), async (req, res) => {
  const o = await Order.findById(req.valid.params.id).populate('restaurant', 'slug').populate('user', 'email name').populate('courier.user', 'email name');
  if (!o) throw notFound('We couldn’t find that order.');
  res.json({ order: { ...orderOut(o), customerEmail: o.user ? o.user.email : null, courierEmail: o.courier && o.courier.user ? o.courier.user.email : null } });
});

router.post('/orders/:id/status', validate(z.object({ id: objectId('order') }), 'params'), validate(z.object({
  status: z.enum(Order.STATUSES, { error: 'Choose a status.' }),
  reason: z.string().trim().max(160).optional().default('')
})), async (req, res) => {
  const o = await Order.findById(req.valid.params.id);
  if (!o) throw notFound('We couldn’t find that order.');
  if (req.body.status === 'cancelled' && !req.body.reason) throw badRequest('Give a reason for cancelling. The customer sees it.', 'validation_failed');
  await flow.adminSet(o, req.body.status, { reason: req.body.reason });
  res.json({ order: orderOut(await Order.findById(o._id).populate('restaurant', 'slug')) });
});

/* ================= Users ================= */

const usersQuery = z.object({
  q: z.string().trim().max(80).optional().default(''),
  role: z.enum([...User.ROLES, 'all', 'staff']).optional().default('all'),
  page: z.coerce.number().int().min(1).max(500).optional().default(1)
});
const USERS_PAGE = 30;

const userRow = (u, restaurants, orders) => ({
  _id: String(u._id), name: u.name, email: u.email, role: u.role, disabled: !!u.disabled, seeded: !!u.seeded,
  restaurant: u.restaurant ? String(u.restaurant) : null, restaurantName: u.restaurant ? (restaurants.get(String(u.restaurant)) || '') : '',
  vehicle: u.vehicle || null, createdAt: u.createdAt, orders: orders.get(String(u._id)) || 0
});

async function rowsFor(users) {
  const [rs, counts] = await Promise.all([
    Restaurant.find({}, { name: 1 }),
    Order.aggregate([{ $match: { user: { $in: users.map(u => u._id) } } }, { $group: { _id: '$user', n: { $sum: 1 } } }])
  ]);
  const restaurants = new Map(rs.map(r => [String(r._id), r.name]));
  const orders = new Map(counts.map(c => [String(c._id), c.n]));
  return users.map(u => userRow(u, restaurants, orders));
}

router.get('/users', validate(usersQuery, 'query'), async (req, res) => {
  const { q, role, page } = req.valid.query;
  const query = {};
  if (role === 'staff') query.role = { $in: ['partner', 'courier', 'admin'] };
  else if (role !== 'all') query.role = role;
  if (q) { const re = new RegExp(escapeRe(q), 'i'); query.$or = [{ name: re }, { email: re }]; }
  const [total, list] = await Promise.all([
    User.countDocuments(query),
    User.find(query).sort({ role: 1, createdAt: -1 }).skip((page - 1) * USERS_PAGE).limit(USERS_PAGE)
  ]);
  res.json({ users: await rowsFor(list), total, page, hasMore: page * USERS_PAGE < total });
});

const roleFields = {
  role: z.enum(User.ROLES, { error: 'Choose a role.' }),
  restaurant: objectId('restaurant').nullable().optional(),
  vehicle: z.enum(User.VEHICLES).nullable().optional()
};

/* Partners need a restaurant, couriers a vehicle; other roles have neither. */
async function roleData({ role, restaurant, vehicle }) {
  if (role === 'partner') {
    if (!restaurant) throw badRequest('Choose the restaurant this partner works for.', 'missing_restaurant');
    if (!(await Restaurant.exists({ _id: restaurant }))) throw badRequest('That restaurant doesn’t exist.', 'unknown_restaurant');
    return { role, restaurant, vehicle: null };
  }
  if (role === 'courier') return { role, restaurant: null, vehicle: vehicle || 'bike' };
  return { role, restaurant: null, vehicle: null };
}

router.post('/users', validate(z.object({
  name: z.string({ error: 'Enter their full name.' }).trim().min(2, 'Enter their full name.').max(80),
  email: z.string({ error: 'Enter their email.' }).trim().toLowerCase().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Enter an email like name@example.com.'),
  password: z.string({ error: 'Set a password.' }).min(8, 'Use at least 8 characters.').refine(p => Buffer.byteLength(p) <= 72, 'Use at most 72 characters.'),
  ...roleFields
})), async (req, res) => {
  if (await User.exists({ email: req.body.email })) throw conflict('An account with this email already exists. Change its role instead.', 'email_taken');
  const roles = await roleData(req.body);
  const user = await User.create({ name: req.body.name, email: req.body.email, passwordHash: await bcrypt.hash(req.body.password, 12), ...roles });
  res.status(201).json({ user: (await rowsFor([user]))[0] });
});

router.patch('/users/:id', validate(z.object({ id: objectId('user') }), 'params'), validate(z.object({
  role: roleFields.role.optional(), restaurant: roleFields.restaurant, vehicle: roleFields.vehicle,
  disabled: z.boolean().optional()
})), async (req, res) => {
  const user = await User.findById(req.valid.params.id);
  if (!user) throw notFound('We couldn’t find that account.');
  const self = String(user._id) === String(req.user._id);
  const losesAdmin = user.role === 'admin' && ((req.body.role && req.body.role !== 'admin') || req.body.disabled === true);
  if (self && losesAdmin) throw badRequest('You can’t remove your own admin access or disable your own account. Ask another admin.', 'self_change');
  if (losesAdmin && (await User.countDocuments({ role: 'admin', disabled: { $ne: true } })) <= 1) throw badRequest('Morsel needs at least one active admin.', 'last_admin');
  if (req.body.role || 'restaurant' in req.body || 'vehicle' in req.body) {
    Object.assign(user, await roleData({ role: req.body.role || user.role, restaurant: 'restaurant' in req.body ? req.body.restaurant : user.restaurant, vehicle: 'vehicle' in req.body ? req.body.vehicle : user.vehicle }));
  }
  if (typeof req.body.disabled === 'boolean' && req.body.disabled !== !!user.disabled) {
    user.disabled = req.body.disabled;
    /* Signs a disabled account out everywhere at once. */
    if (user.disabled) user.tokenVersion = (user.tokenVersion || 0) + 1;
  }
  await user.save();
  res.json({ user: (await rowsFor([user]))[0] });
});

/* ================= Reviews ================= */

const reviewsQuery = z.object({
  restaurant: slug.optional(),
  show: z.enum(['all', 'visible', 'hidden', 'low']).optional().default('all'),
  q: z.string().trim().max(80).optional().default(''),
  page: z.coerce.number().int().min(1).max(500).optional().default(1)
});
const REVIEWS_PAGE = 25;

router.get('/reviews', validate(reviewsQuery, 'query'), async (req, res) => {
  const { restaurant, show, q, page } = req.valid.query;
  const query = {};
  if (restaurant) { const r = await Restaurant.findOne({ slug: restaurant }, { _id: 1 }); query.restaurant = r ? r._id : null; }
  if (show === 'hidden') query.hidden = true;
  if (show === 'visible') query.hidden = { $ne: true };
  if (show === 'low') query.food = { $lte: 2 };
  if (q) { const re = new RegExp(escapeRe(q), 'i'); query.$or = [{ comment: re }, { author: re }]; }
  const [total, list, rs] = await Promise.all([
    Review.countDocuments(query),
    Review.find(query).sort({ createdAt: -1 }).skip((page - 1) * REVIEWS_PAGE).limit(REVIEWS_PAGE),
    Restaurant.find({}, { name: 1, slug: 1 })
  ]);
  const names = new Map(rs.map(r => [String(r._id), r]));
  res.json({
    reviews: list.map(x => ({ ...reviewOut(x), hidden: !!x.hidden, restaurantName: (names.get(String(x.restaurant)) || {}).name || '', restaurantSlug: (names.get(String(x.restaurant)) || {}).slug || '' })),
    total, page, hasMore: page * REVIEWS_PAGE < total
  });
});

/* Hidden reviews leave the restaurant page and its rating. */
router.patch('/reviews/:id', validate(z.object({ id: objectId('review') }), 'params'), validate(z.object({ hidden: z.boolean({ error: 'Say whether to hide the review.' }) })), async (req, res) => {
  const review = await Review.findByIdAndUpdate(req.valid.params.id, { $set: { hidden: req.body.hidden } }, { returnDocument: 'after' });
  if (!review) throw notFound('We couldn’t find that review.');
  await refreshRating(review.restaurant);
  res.json({ review: { ...reviewOut(review), hidden: !!review.hidden } });
});

/* ================= Promo codes ================= */

const promoFields = {
  code: z.string({ error: 'Enter a code.' }).trim().toUpperCase().min(3, 'Codes have at least 3 characters.').max(30).regex(/^[A-Z0-9-]+$/, 'Codes use letters, numbers and dashes.'),
  description: z.string().trim().max(160),
  type: z.enum(['percent', 'fixed', 'delivery'], { error: 'Choose a discount type.' }),
  value: z.number().int().min(0).max(100000),
  maxDiscount: z.number().int().min(0).max(100000).nullable(),
  minSubtotal: z.number().int().min(0).max(100000),
  firstOrderOnly: z.boolean(),
  active: z.boolean()
};
const checkPromoValue = p => {
  if (p.type === 'percent' && !(p.value >= 1 && p.value <= 100)) throw badRequest('A percentage discount is between 1 and 100.', 'validation_failed');
  if (p.type === 'fixed' && !(p.value >= 1)) throw badRequest('Enter how much the code takes off.', 'validation_failed');
};

async function promoRows(list) {
  const usage = await Order.aggregate([
    { $match: { promoCode: { $in: list.map(p => p.code) }, status: { $ne: 'cancelled' } } },
    { $group: { _id: '$promoCode', uses: { $sum: 1 }, discount: { $sum: { $add: ['$pricing.discount', '$pricing.deliveryDiscount'] } }, last: { $max: '$createdAt' } } }
  ]);
  const by = new Map(usage.map(u => [u._id, u]));
  return list.map(p => ({ _id: String(p._id), ...promoOut(p), rawDescription: p.description || '', active: p.active, seeded: !!p.seeded, uses: (by.get(p.code) || {}).uses || 0, discountGiven: (by.get(p.code) || {}).discount || 0, lastUsed: (by.get(p.code) || {}).last || null, createdAt: p.createdAt }));
}

router.get('/promos', async (req, res) => {
  res.json({ promos: await promoRows(await Promo.find().sort({ active: -1, code: 1 })) });
});

router.post('/promos', validate(z.object({
  ...promoFields, description: promoFields.description.optional().default(''), value: promoFields.value.optional().default(0),
  maxDiscount: promoFields.maxDiscount.optional().default(null), minSubtotal: promoFields.minSubtotal.optional().default(0),
  firstOrderOnly: z.boolean().optional().default(false), active: z.boolean().optional().default(true)
})), async (req, res) => {
  checkPromoValue(req.body);
  if (await Promo.exists({ code: req.body.code })) throw conflict(`${req.body.code} already exists. Edit it instead.`, 'code_taken');
  const p = await Promo.create(req.body);
  res.status(201).json({ promo: (await promoRows([p]))[0] });
});

router.patch('/promos/:id', validate(z.object({ id: objectId('promo') }), 'params'), validate(z.object(promoFields).omit({ code: true }).partial()), async (req, res) => {
  const p = await Promo.findById(req.valid.params.id);
  if (!p) throw notFound('We couldn’t find that promo code.');
  Object.assign(p, req.body);
  checkPromoValue(p);
  await p.save();
  res.json({ promo: (await promoRows([p]))[0] });
});

module.exports = router;
