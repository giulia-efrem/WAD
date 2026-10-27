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

/* A meal deal is a dish made of parts (burger, side, drink...). Each part lists the dishes the
   customer can pick, with a surcharge (delta, in cents). The first part is the main dish. */
const dealSchema = new mongoose.Schema({
  parts: {
    type: [new mongoose.Schema({
      key: { type: String, required: true },
      name: { type: String, required: true },
      main: { type: Boolean, default: false },
      choices: { type: [new mongoose.Schema({ itemSlug: { type: String, required: true }, delta: { type: Number, default: 0, min: 0 } }, { _id: false })], default: [] }
    }, { _id: false })],
    default: []
  }
}, { _id: false });

const KINDS = ['main', 'starter', 'side', 'drink', 'dessert', 'deal'];
const TAGS = ['vegetarian', 'vegan', 'spicy', 'gluten-free', 'contains-nuts'];

const itemSchema = new mongoose.Schema({
  slug: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  popular: { type: Boolean, default: false },
  /* Sold out: shown but can't be ordered, set by the restaurant or an admin. */
  soldOut: { type: Boolean, default: false },
  kind: { type: String, enum: KINDS, default: 'main' },
  tags: { type: [{ type: String, enum: TAGS }], default: [] },
  /* From the 14 EU allergens, e.g. ['gluten', 'milk'] */
  allergens: { type: [String], default: [] },
  deal: { type: dealSchema, default: null },
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
  /* Where the kitchen is, shown in the restaurant's info section. */
  address: { street: { type: String, default: '', trim: true, maxlength: 120 }, area: { type: String, default: '', trim: true, maxlength: 80 } },
  color: { type: String, default: '#EEE' },
  ink: { type: String, default: '#333' },
  illustration: { type: String, default: 'bowl' },
  ...photoFields,
  sortOrder: { type: Number, default: 0 },
  /* Paused (or closed by an admin): no new orders until switched back. */
  paused: { type: Boolean, default: false },
  /* From the catalog in seed/; restaurants you add in /admin are never touched by npm run seed. */
  seeded: { type: Boolean, default: false },
  menu: { type: [sectionSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Restaurant', restaurantSchema);
