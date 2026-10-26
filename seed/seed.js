'use strict';

/* npm run seed
   Resets the 9 restaurants and menus from the reference (keeping each restaurant's _id
   stable by slug, so existing favourites and orders still point at the right place), sets
   photos from seed/images.json, and recreates the demo account with one delivered order. */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('../server/config');
const db = require('../server/db');
const User = require('../server/models/User');
const Restaurant = require('../server/models/Restaurant');
const Order = require('../server/models/Order');
const { fieldsFromImagesEntry } = require('../server/lib/photos');
const { OPTION_GROUPS, RESTAURANTS } = require('./catalog');

const DEMO = { name: 'Alex Morgan', email: 'demo@morsel.app', password: 'morsel-demo-2026' };

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
    const data = buildRestaurant(r, i, images);
    let doc = await Restaurant.findOne({ slug: r.slug });
    if (doc) doc.overwrite(data);
    else doc = new Restaurant(data);
    await doc.save();
    bySlug[r.slug] = doc;
  }
  const removed = await Restaurant.deleteMany({ slug: { $nin: RESTAURANTS.map(r => r.slug) } });
  const photos = Object.values(images).filter(v => fieldsFromImagesEntry(v).image).length;
  console.log(`  ${RESTAURANTS.length} restaurants and menus saved${removed.deletedCount ? `, ${removed.deletedCount} old ones removed` : ''}, ${photos} photos from images.json`);
  return bySlug;
}

async function seedDemo(bySlug) {
  const existing = await User.findOne({ email: DEMO.email });
  if (existing) {
    await Order.deleteMany({ user: existing._id });
    await existing.deleteOne();
  }
  const user = await User.create({
    name: DEMO.name,
    email: DEMO.email,
    passwordHash: await bcrypt.hash(DEMO.password, 12),
    role: config.adminEmail === DEMO.email ? 'admin' : 'user',
    addresses: [{ label: 'Home', street: '14 Linden Street', details: 'Flat 3, second floor', city: 'Old Town', isDefault: true }]
  });

  const r = bySlug['bao-and-broth'];
  const when = new Date(Date.now() - 3 * 86400000);
  const order = new Order({
    user: user._id,
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
    courier: { name: 'Maya', vehicle: 'bike' },
    rating: { stars: 5, comment: 'The broth was incredible.', ratedAt: new Date(when.getTime() + 3600000) },
    createdAt: when,
    updatedAt: new Date(when.getTime() + 3600000)
  });
  await order.save({ timestamps: false });
  console.log(`  Demo account ${DEMO.email} (password ${DEMO.password}) with 1 saved address and 1 delivered, rated order`);
}

(async () => {
  try {
    await db.connect();
    console.log('Seeding Morsel…');
    await Promise.all([User.init(), Restaurant.init(), Order.init()]);
    const bySlug = await seedRestaurants();
    await seedDemo(bySlug);
    console.log('Done.');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.disconnect();
  }
})();
