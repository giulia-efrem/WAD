'use strict';

const mongoose = require('mongoose');

const choiceSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 }
}, { _id: false });

/* An option group such as size, extras or spice level. `one` groups are required and take a
   single choice; `many` groups are optional and take up to `max` choices. */
const optionGroupSchema = new mongoose.Schema({
  key: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['one', 'many'], required: true },
  max: { type: Number },
  choices: { type: [choiceSchema], default: [] }
}, { _id: false });

/* Where a photo came from, so it can be credited. Only Unsplash photos have one. */
const creditSchema = new mongoose.Schema({
  source: { type: String, enum: ['unsplash'], default: 'unsplash' },
  unsplashId: String,
  name: String,
  username: String,
  profileUrl: String,
  photoUrl: String,
  downloadLocation: String
}, { _id: false });

/* image is a URL (Unsplash raw URL, any pasted URL or /uploads/…). The rest describe it. */
const photoFields = {
  image: { type: String, default: '' },
  imageColor: { type: String, default: '' },
  imageBlurHash: { type: String, default: '' },
  imageAlt: { type: String, default: '' },
  imageCredit: { type: creditSchema, default: null }
};

/* What a dish is made of. Removable ones can be left out ("No basil"), at no change in price. */
const ingredientSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  removable: { type: Boolean, default: false }
}, { _id: false });

const itemSchema = new mongoose.Schema({
  slug: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  popular: { type: Boolean, default: false },
  ...photoFields,
  ingredients: { type: [ingredientSchema], default: [] },
  optionGroups: { type: [optionGroupSchema], default: [] }
}, { _id: false });

const sectionSchema = new mongoose.Schema({
  category: { type: String, required: true },
  items: { type: [itemSchema], default: [] }
}, { _id: false });

const restaurantSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  cuisines: { type: [String], default: [] },
  label: { type: String, default: '' },
  tagline: { type: String, default: '' },
  priceLevel: { type: String, default: '€€' },
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  eta: { min: { type: Number, required: true }, max: { type: Number, required: true } },
  deliveryFee: { type: Number, required: true, min: 0 },
  minOrder: { type: Number, required: true, min: 0 },
  hours: { type: [{ open: Number, close: Number, _id: false }], default: [] },
  color: { type: String, default: '#EEE' },
  ink: { type: String, default: '#333' },
  illustration: { type: String, default: 'bowl' },
  ...photoFields,
  sortOrder: { type: Number, default: 0 },
  menu: { type: [sectionSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Restaurant', restaurantSchema);
