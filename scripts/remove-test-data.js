/* Removes what automated tests once left in a database: accounts with test.*@example.com emails,
   their orders and reviews, orders of test accounts that were deleted during a test, TEST* promo
   codes and Test Kitchen restaurants. Seeded demo data and anything you created yourself are kept.
   Usage: node scripts/remove-test-data.js [--dry-run]   (uses MONGODB_URI from .env) */
const mongoose = require('mongoose');
const config = require('../server/config');
const User = require('../server/models/User');
const Order = require('../server/models/Order');
const Review = require('../server/models/Review');
const Promo = require('../server/models/Promo');
const Restaurant = require('../server/models/Restaurant');
const { refreshRating } = require('../server/lib/reviews');

const dry = process.argv.includes('--dry-run');
const TEST_EMAIL = /^test\.[a-z.]*\d+@example\.com$/;

(async () => {
  await mongoose.connect(config.mongoUri);
  const users = await User.find({ seeded: { $ne: true }, email: TEST_EMAIL });
  const userIds = users.map(u => u._id);
  const kitchens = await Restaurant.find({ slug: /^test-kitchen-\d+$/ });
  const promos = await Promo.find({ code: /^TEST(UI)?\d+$/ });
  /* Orders from test accounts, orders at test restaurants, and orders a test placed with a TEST code. */
  const orderQuery = { seeded: { $ne: true }, $or: [{ user: { $in: userIds } }, { restaurant: { $in: kitchens.map(k => k._id) } }, { promoCode: { $in: promos.map(p => p.code) } }] };
  const orders = await Order.find(orderQuery);
  /* A test that deletes its own account leaves its orders with no user, named "Former customer".
     Those are only removed when they were placed during the same minutes as other test orders. */
  const times = orders.map(o => o.createdAt.getTime());
  const orphans = times.length ? await Order.find({ seeded: { $ne: true }, user: null, createdAt: { $gte: new Date(Math.min(...times)), $lte: new Date(Math.max(...times) + 10 * 60e3) } }) : [];
  const allOrders = [...orders, ...orphans];
  const reviews = await Review.find({ seeded: { $ne: true }, $or: [{ user: { $in: userIds } }, { order: { $in: allOrders.map(o => o._id) } }] });

  console.log(`${dry ? 'Would remove' : 'Removing'}:`);
  console.log(`  ${users.length} test accounts: ${users.map(u => u.email).join(', ') || '-'}`);
  console.log(`  ${allOrders.length} orders (${orphans.length} from deleted test accounts)`);
  console.log(`  ${reviews.length} reviews`);
  console.log(`  ${promos.length} promo codes: ${promos.map(p => p.code).join(', ') || '-'}`);
  console.log(`  ${kitchens.length} restaurants: ${kitchens.map(k => k.name).join(', ') || '-'}`);
  if (!dry) {
    const touched = new Set(reviews.map(r => String(r.restaurant)));
    await Review.deleteMany({ _id: { $in: reviews.map(r => r._id) } });
    await Order.deleteMany({ _id: { $in: allOrders.map(o => o._id) } });
    await Promo.deleteMany({ _id: { $in: promos.map(p => p._id) } });
    await Restaurant.deleteMany({ _id: { $in: kitchens.map(k => k._id) } });
    await User.deleteMany({ _id: { $in: userIds } });
    for (const id of touched) if (!kitchens.some(k => String(k._id) === id)) await refreshRating(id);
    console.log('Done.');
  }
  await mongoose.disconnect();
})().catch(err => { console.error(err); process.exit(1); });
