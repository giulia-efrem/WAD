'use strict';

/* npm run seed
   Resets the 9 catalog restaurants and menus (keeping each restaurant's _id stable by slug, so
   favourites and orders still point at the right place), sets photos from seed/images.json, and
   recreates the demo data: the demo customer, staff accounts, 30 days of order history, seeded
   reviews and the WELCOME20 and FREEDEL codes. Only demo data is replaced. Accounts, orders,
   reviews, promo codes and restaurants you created yourself are kept. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../server/db');
const User = require('../server/models/User');
const Restaurant = require('../server/models/Restaurant');
const Order = require('../server/models/Order');
const Review = require('../server/models/Review');
const Promo = require('../server/models/Promo');
const { customers, historyOrders } = require('./history');
const { DEMO_CUSTOMER: DEMO, ADMIN, PARTNER_PASSWORD, PARTNER_NAMES, partnerEmail, COURIER_PASSWORD, COURIERS, HISTORY_DOMAIN, reservedEmails } = require('./staff');
const { reviewsFor } = require('./reviews');
const { refreshRating } = require('../server/lib/reviews');
const { fieldsFromImagesEntry } = require('../server/lib/photos');
const { OPTION_GROUPS, RESTAURANTS } = require('./catalog');


function loadImages() {
  const file = path.join(__dirname, 'images.json');
  if (!fs.existsSync(file)) return {};
  const images = JSON.parse(fs.readFileSync(file, 'utf8'));
  const known = new Set(RESTAURANTS.flatMap(r => [r.slug, ...r.menu.flatMap(s => s.items.map(it => `${r.slug}/${it.slug}`))]));
  for (const key of Object.keys(images)) {
    if (!known.has(key)) console.warn(`  images.json: “${key}” doesn’t match any restaurant or dish, skipped`);
  }
  return images;
}

/* Photo fields for a key: a plain URL, or a full Unsplash entry with colour and credit. */
const photoFor = (images, key) => fieldsFromImagesEntry(images[key]);

function buildRestaurant(r, i, images) {
  return {
    slug: r.slug,
    name: r.name,
    cuisines: r.cuisines,
    label: r.label,
    tagline: r.tagline,
    priceLevel: r.priceLevel,
    rating: r.rating,
    reviewCount: r.reviewCount,
    eta: r.eta,
    deliveryFee: r.deliveryFee,
    minOrder: r.minOrder,
    hours: r.hours,
    address: r.address,
    color: r.color,
    ink: r.ink,
    illustration: r.illustration,
    ...photoFor(images, r.slug),
    sortOrder: i,
    menu: r.menu.map(s => ({
      category: s.category,
      items: s.items.map(it => ({
        slug: it.slug,
        name: it.name,
        description: it.description,
        price: it.price,
        popular: it.popular,
        ...photoFor(images, `${r.slug}/${it.slug}`),
        kind: it.kind,
        tags: it.tags,
        allergens: it.allergens,
        deal: it.deal || null,
        ingredients: it.ingredients,
        optionGroups: it.options.map(key => {
          if (!OPTION_GROUPS[key]) throw new Error(`Unknown option group “${key}” on ${r.slug}/${it.slug}`);
          return OPTION_GROUPS[key];
        })
      }))
    }))
  };
}

async function seedRestaurants() {
  const images = loadImages();
  const bySlug = {};
  for (const [i, r] of RESTAURANTS.entries()) {
    const data = { ...buildRestaurant(r, i, images), seeded: true };
    let doc = await Restaurant.findOne({ slug: r.slug });
    if (doc) doc.overwrite(data);
    else doc = new Restaurant(data);
    await doc.save();
    bySlug[r.slug] = doc;
  }
  /* Restaurants added in /admin are left alone. */
  const own = await Restaurant.countDocuments({ slug: { $nin: RESTAURANTS.map(r => r.slug) } });
  const photos = Object.values(images).filter(v => fieldsFromImagesEntry(v).image).length;
  console.log(`  ${RESTAURANTS.length} restaurants and menus reset to the catalog${own ? ` (${own} of your own kept)` : ''}, ${photos} photos from images.json`);
  return bySlug;
}

/* Removes the previous run's demo data only: seeded accounts (and the reserved demo emails),
   their orders and reviews, and seeded orders, reviews and promo codes. Accounts, orders and
   reviews you created yourself are never touched. */
async function clearDemoData() {
  const historyEmail = new RegExp(`@${HISTORY_DOMAIN.replace(/\./g, '\\.')}$`);
  const demoUsers = await User.find({ $or: [{ seeded: true }, { email: { $in: reservedEmails() } }, { email: historyEmail }] }, { _id: 1 });
  const ids = demoUsers.map(u => u._id);
  const orders = await Order.deleteMany({ $or: [{ seeded: true }, { user: { $in: ids } }] });
  const reviews = await Review.deleteMany({ $or: [{ seeded: true }, { user: { $in: ids } }] });
  /* Your own orders that a demo courier delivered keep the courier's name. */
  await Order.updateMany({ 'courier.user': { $in: ids } }, { $set: { 'courier.user': null } });
  await User.deleteMany({ _id: { $in: ids } });
  await Promo.deleteMany({ seeded: true });
  /* Accounts from before roles existed. */
  await User.updateMany({ role: 'user' }, { $set: { role: 'customer' } });
  console.log(`  Cleared the previous demo data: ${ids.length} demo accounts, ${orders.deletedCount} orders, ${reviews.deletedCount} reviews`);
}

const hash = p => bcrypt.hash(p, 12);

async function seedStaff(bySlug) {
  const admin = await User.create({ name: ADMIN.name, email: ADMIN.email, passwordHash: await hash(ADMIN.password), role: 'admin', seeded: true });
  const partnerHash = await hash(PARTNER_PASSWORD);
  for (const r of RESTAURANTS) {
    await User.create({ name: PARTNER_NAMES[r.slug], email: partnerEmail(r.slug), passwordHash: partnerHash, role: 'partner', restaurant: bySlug[r.slug]._id, seeded: true });
  }
  const courierHash = await hash(COURIER_PASSWORD);
  const couriers = [];
  for (const c of COURIERS) couriers.push(await User.create({ name: c.name, email: c.email, passwordHash: courierHash, role: 'courier', vehicle: c.vehicle, seeded: true }));
  console.log(`  Staff: admin ${admin.email}, ${RESTAURANTS.length} partners (partner.<restaurant>@morsel.app), ${couriers.length} couriers (courier1-3@morsel.app). Passwords are in README.md`);
  return { admin, couriers };
}

/* WELCOME20 and FREEDEL. A code you created yourself with the same name is kept as it is. */
async function seedPromos() {
  const defs = [
    { code: 'WELCOME20', type: 'percent', value: 20, maxDiscount: 800, minSubtotal: 0, firstOrderOnly: true, description: '20% off food, up to €8, on your first order' },
    { code: 'FREEDEL', type: 'delivery', value: 0, maxDiscount: null, minSubtotal: 0, firstOrderOnly: false, description: 'Free delivery' }
  ];
  const out = {};
  for (const d of defs) out[d.code] = (await Promo.findOne({ code: d.code })) || await Promo.create({ ...d, active: true, seeded: true });
  console.log(`  Promo codes ${defs.map(d => d.code).join(' and ')}`);
  return out;
}

async function seedDemo(bySlug) {
  const user = await User.create({
    name: DEMO.name,
    email: DEMO.email,
    passwordHash: await hash(DEMO.password),
    role: 'customer',
    seeded: true,
    addresses: [{ label: 'Home', street: '14 Linden Street', details: 'Flat 3, second floor', city: 'Old Town', isDefault: true }]
  });

  const r = bySlug['bao-and-broth'];
  const when = new Date(Date.now() - 3 * 86400000);
  const at = m => new Date(when.getTime() + m * 60000);
  const order = new Order({
    user: user._id,
    customerName: user.name,
    restaurant: r._id,
    restaurantName: r.name,
    items: [
      { itemSlug: 'tonkotsu', name: 'Tonkotsu ramen', qty: 2, unitPrice: 1350, options: [{ group: 'Spice level', choice: 'Medium', price: 0 }], note: '' },
      { itemSlug: 'porkbao', name: 'Pork belly bao (2)', qty: 1, unitPrice: 750, options: [], note: '' }
    ],
    pricing: { subtotal: 3450, deliveryFee: 199, serviceFee: 173, smallOrderFee: 0, discount: 0, deliveryDiscount: 0, tip: 200, total: 4022 },
    address: { label: 'Home', street: '14 Linden Street', details: 'Flat 3, second floor', city: 'Old Town' },
    payment: 'card',
    courierNote: '',
    delivery: { type: 'asap' },
    promoCode: null,
    etaMin: 35,
    startAt: when,
    status: 'delivered',
    statusAt: at(36),
    prepMinutes: 16,
    timeline: [
      { status: 'placed', at: when, by: 'customer' }, { status: 'accepted', at: at(1), by: 'partner' },
      { status: 'preparing', at: at(2), by: 'partner' }, { status: 'ready', at: at(18), by: 'partner' },
      { status: 'pickedup', at: at(22), by: 'courier' }, { status: 'delivered', at: at(36), by: 'courier' }
    ],
    courier: { user: null, name: 'Maya', vehicle: 'bike' },
    review: { food: 5, delivery: 'up', comment: 'The broth was incredible.', reviewedAt: at(60) },
    seeded: true,
    createdAt: when,
    updatedAt: at(60)
  });
  await order.save({ timestamps: false });
  await new Review({
    restaurant: r._id, user: user._id, order: order._id, author: 'Alex M.', food: 5, delivery: 'up',
    comment: 'The broth was incredible.', ordered: '2× Tonkotsu ramen, Pork belly bao (2)', seeded: true,
    reply: { text: 'Thank you, Alex! The broth simmers for 18 hours, so this means a lot. See you soon.', at: at(200), by: PARTNER_NAMES['bao-and-broth'] },
    createdAt: at(60), updatedAt: at(200)
  }).save({ timestamps: false });
  console.log(`  Demo account ${DEMO.email} (password ${DEMO.password}) with 1 saved address and 1 delivered, reviewed order`);
}

/* Customers and 30 days of past orders behind the admin dashboard. */
async function seedHistory(bySlug, couriers, promos) {
  const passwordHash = await hash(crypto.randomBytes(24).toString('hex'));
  const users = await User.insertMany(customers(20, HISTORY_DOMAIN).map(c => ({ name: c.name, email: c.email, passwordHash, role: 'customer', seeded: true, addresses: [c.address] })));
  const restaurants = RESTAURANTS.map(r => bySlug[r.slug]);
  const docs = historyOrders({ restaurants, users, couriers, promos });
  await Order.insertMany(docs, { timestamps: false });
  console.log(`  ${users.length} customers with ${docs.length} past orders over 30 days`);
}

const REPLIES = {
  low: ['Sorry this wasn’t up to our usual standard, {name}. We’ve shared your note with the kitchen team.', 'Thanks for telling us, {name}. That’s not how it should arrive, and we’re looking into it.', 'We’re sorry, {name}. Please give us another try, we’d love to get it right.'],
  high: ['Thank you, {name}! The whole team is happy to hear it.', 'Thanks so much, {name}. See you next time!']
};

/* The seeded reviews, with a few public replies from the restaurant, then every rating. */
async function seedReviews(bySlug) {
  let total = 0, replies = 0;
  for (const r of RESTAURANTS) {
    const doc = bySlug[r.slug];
    const docs = reviewsFor(r).map((x, i) => {
      const name = x.author.split(' ')[0];
      const low = x.food <= 3 && !!x.comment;
      const list = REPLIES[low ? 'low' : 'high'];
      const reply = (low && i % 2 === 0) || (!low && x.comment && i % 9 === 4)
        ? { text: list[i % list.length].replace('{name}', name), at: new Date(x.createdAt.getTime() + 5 * 3600000), by: PARTNER_NAMES[r.slug] }
        : null;
      if (reply) replies++;
      return { ...x, restaurant: doc._id, seeded: true, reply };
    });
    await Review.insertMany(docs, { timestamps: false });
    total += docs.length;
  }
  const ratings = [];
  for (const r of RESTAURANTS) { const res = await refreshRating(bySlug[r.slug]._id); ratings.push(`${r.slug} ${res.rating} (${res.reviewCount})`); }
  console.log(`  ${total} seeded reviews, ${replies} with a reply. Ratings: ${ratings.join(', ')}`);
}

(async () => {
  try {
    await db.connect();
    console.log('Seeding Morsel…');
    await Promise.all([User.init(), Restaurant.init(), Order.init(), Review.init(), Promo.init()]);
    const bySlug = await seedRestaurants();
    await clearDemoData();
    const promos = await seedPromos();
    const { couriers } = await seedStaff(bySlug);
    await seedDemo(bySlug);
    await seedHistory(bySlug, couriers, promos);
    await seedReviews(bySlug);
    console.log('Done.');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.disconnect();
  }
})();
