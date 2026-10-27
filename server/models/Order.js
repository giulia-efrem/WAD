'use strict';

const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  group: String,
  choice: String,
  price: Number
}, { _id: false });

const lineSchema = new mongoose.Schema({
  itemSlug: { type: String, required: true },
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 1, max: 20 },
  unitPrice: { type: Number, required: true, min: 0 },
  options: { type: [optionSchema], default: [] },
  /* Ingredients left out, e.g. [{ id: 'basil', name: 'Basil' }] */
  removed: { type: [new mongoose.Schema({ id: String, name: String }, { _id: false })], default: [] },
  note: { type: String, default: '' }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  restaurantName: { type: String, required: true },
  items: { type: [lineSchema], validate: v => v.length > 0 },
  pricing: {
    subtotal: Number, deliveryFee: Number, serviceFee: Number, smallOrderFee: Number,
    discount: Number, deliveryDiscount: Number, tip: Number, total: Number
  },
  address: { label: String, street: String, details: String, city: String },
  payment: { type: String, enum: ['card', 'cash'], required: true },
  courierNote: { type: String, default: '' },
  delivery: {
    type: { type: String, enum: ['asap', 'scheduled'], required: true },
    at: { type: Date }
  },
  promoCode: { type: String, default: null },
  etaMin: { type: Number, required: true },
  startAt: { type: Date, required: true },
  courier: { name: String, vehicle: String },
  /* The customer's feedback, also saved as a Review. food is 1-5 stars, delivery is 'up' or 'down'. */
  review: {
    type: new mongoose.Schema({ food: { type: Number, min: 1, max: 5 }, delivery: { type: String, enum: ['up', 'down'] }, comment: String, reviewedAt: Date }, { _id: false }),
    default: null
  }
}, { timestamps: true });

orderSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
