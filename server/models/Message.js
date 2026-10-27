'use strict';

const mongoose = require('mongoose');

/* A message sent with the contact form in the Help centre. Admins read and answer them
   in the dashboard; `status` tracks whether someone has dealt with it. */
const TOPICS = ['order', 'payment', 'account', 'restaurant', 'partner', 'other'];
const STATUSES = ['new', 'done'];

const messageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  topic: { type: String, enum: TOPICS, default: 'other' },
  /* Optional: the order it's about (only one of the sender's own). */
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  body: { type: String, required: true, trim: true, maxlength: 2000 },
  /* The account that sent it, when someone was logged in. */
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: STATUSES, default: 'new' },
  note: { type: String, default: '', trim: true, maxlength: 1000 },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  handledAt: { type: Date, default: null }
}, { timestamps: true });

messageSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
module.exports.TOPICS = TOPICS;
module.exports.STATUSES = STATUSES;
