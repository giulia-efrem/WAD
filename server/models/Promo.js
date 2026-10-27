'use strict';

const mongoose = require('mongoose');

/* Promo codes. percent: value% off food, up to maxDiscount. fixed: value cents off food.
   delivery: free delivery (refused where delivery is already free). */
const promoSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 30 },
  description: { type: String, default: '', maxlength: 160 },
  type: { type: String, enum: ['percent', 'fixed', 'delivery'], required: true },
  value: { type: Number, default: 0, min: 0 },
  maxDiscount: { type: Number, default: null, min: 0 },
  minSubtotal: { type: Number, default: 0, min: 0 },
  firstOrderOnly: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  seeded: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Promo', promoSchema);
