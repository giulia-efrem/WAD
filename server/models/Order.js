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
  /* Meal deals: the dish chosen for each part. options and removed above belong to the main one. */
  parts: {
    type: [new mongoose.Schema({ group: String, itemSlug: String, name: String, price: Number, options: { type: [optionSchema], default: [] } }, { _id: false })],
    default: []
  },
  /* Ingredients left out, e.g. [{ id: 'basil', name: 'Basil' }] */
  removed: { type: [new mongoose.Schema({ id: String, name: String }, { _id: false })], default: [] },
  note: { type: String, default: '' }
}, { _id: false });

/* The steps an order goes through. cancelled can happen before pickup. */
const STATUSES = ['placed', 'accepted', 'preparing', 'ready', 'pickedup', 'delivered', 'cancelled'];
const ACTORS = ['customer', 'partner', 'courier', 'admin', 'autopilot'];

const orderSchema = new mongoose.Schema({
  /* null once the customer deletes their account (the order stays for the restaurant's records). */
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  customerName: { type: String, default: '' },
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
  /* When the kitchen should start: now for ASAP orders, earlier than the arrival time for scheduled ones. */
  startAt: { type: Date, required: true },
  status: { type: String, enum: STATUSES, default: 'placed', index: true },
  statusAt: { type: Date, default: Date.now },
  /* Every step: who moved the order on, and when. */
  timeline: {
    type: [new mongoose.Schema({ status: { type: String, enum: STATUSES }, at: Date, by: { type: String, enum: ACTORS }, note: String }, { _id: false })],
    default: []
  },
  /* Set by the restaurant when it accepts (or by the autopilot), in minutes. */
  prepMinutes: { type: Number, default: null },
  /* user is set when a real courier takes the delivery; the autopilot assigns a demo courier by name only. */
  courier: { user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, name: String, vehicle: String },
  cancelReason: { type: String, default: '' },
  seeded: { type: Boolean, default: false },
  /* The customer's feedback, also saved as a Review. food is 1-5 stars, delivery is 'up' or 'down'. */
  review: {
    type: new mongoose.Schema({ food: { type: Number, min: 1, max: 5 }, delivery: { type: String, enum: ['up', 'down'] }, comment: String, reviewedAt: Date }, { _id: false }),
    default: null
  }
}, { timestamps: true });

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ restaurant: 1, createdAt: -1 });
orderSchema.index({ 'courier.user': 1, status: 1 });

module.exports = mongoose.model('Order', orderSchema);
module.exports.STATUSES = STATUSES;
