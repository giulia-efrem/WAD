'use strict';

const Review = require('../models/Review');
const Restaurant = require('../models/Restaurant');

/* "Alex Morgan" -> "Alex M." */
function authorName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Morsel customer';
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

/* "2× Tonkotsu ramen, Pork belly bao (2)" */
const orderedText = items => items.map(l => (l.qty > 1 ? `${l.qty}× ${l.name}` : l.name)).join(', ').slice(0, 300);

/* Sets a restaurant's rating and review count from its reviews. */
async function refreshRating(restaurantId) {
  const [agg] = await Review.aggregate([
    { $match: { restaurant: restaurantId, hidden: { $ne: true } } },
    { $group: { _id: null, avg: { $avg: '$food' }, count: { $sum: 1 } } }
  ]);
  const rating = agg ? Math.round(agg.avg * 10) / 10 : 0;
  const reviewCount = agg ? agg.count : 0;
  await Restaurant.updateOne({ _id: restaurantId }, { $set: { rating, reviewCount } });
  return { rating, reviewCount };
}

/* Average, count, 5-to-1 breakdown and the share of thumbs-up deliveries. */
async function summary(restaurantId) {
  const rows = await Review.aggregate([
    { $match: { restaurant: restaurantId, hidden: { $ne: true } } },
    { $group: { _id: '$food', count: { $sum: 1 }, up: { $sum: { $cond: [{ $eq: ['$delivery', 'up'] }, 1, 0] } } } }
  ]);
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let count = 0, total = 0, up = 0;
  for (const r of rows) { breakdown[r._id] = r.count; count += r.count; total += r._id * r.count; up += r.up; }
  return {
    average: count ? Math.round((total / count) * 10) / 10 : 0,
    count,
    breakdown,
    deliveryUpShare: count ? Math.round((up / count) * 100) : null
  };
}

const reviewOut = r => ({
  _id: String(r._id),
  author: r.author,
  food: r.food,
  delivery: r.delivery,
  comment: r.comment || '',
  ordered: r.ordered || '',
  createdAt: r.createdAt,
  /* The restaurant's public reply. */
  reply: r.reply && r.reply.text ? { text: r.reply.text, at: r.reply.at } : null,
  mine: false
});

module.exports = { authorName, orderedText, refreshRating, summary, reviewOut };
