'use strict';

const mongoose = require('mongoose');

/* A review of a restaurant. Customer reviews belong to one order (one review per order);
   seeded reviews have no user or order. The restaurant's rating is the average of food. */
const reviewSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  author: { type: String, required: true, maxlength: 40 },
  food: { type: Number, required: true, min: 1, max: 5 },
  delivery: { type: String, enum: ['up', 'down'], required: true },
  comment: { type: String, default: '', maxlength: 500 },
  ordered: { type: String, default: '', maxlength: 300 },
  /* Hidden by an admin: not shown and not counted in the rating. */
  hidden: { type: Boolean, default: false },
  /* The restaurant's public reply, shown under the review. */
  reply: { type: new mongoose.Schema({ text: { type: String, maxlength: 600 }, at: Date, by: String }, { _id: false }), default: null },
  seeded: { type: Boolean, default: false }
}, { timestamps: true });

reviewSchema.index({ order: 1 }, { unique: true, partialFilterExpression: { order: { $type: 'objectId' } } });
reviewSchema.index({ restaurant: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
