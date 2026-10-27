'use strict';

const express = require('express');
const Restaurant = require('../models/Restaurant');
const { photoOut } = require('../lib/present');

const router = express.Router();

/* Every Unsplash photo in use, with its photographer, for the /credits page. */
router.get('/', async (req, res) => {
  const list = await Restaurant.find().sort({ sortOrder: 1 });
  const credits = [];
  const add = (r, e, dish) => {
    const p = photoOut(e);
    if (p.image && p.imageCredit) credits.push({ restaurant: r.name, restaurantSlug: r.slug, dish: dish ? e.name : null, dishSlug: dish ? e.slug : null, ...p });
  };
  for (const r of list) {
    add(r, r, false);
    for (const s of r.menu) for (const it of s.items) add(r, it, true);
  }
  res.json({ credits });
});

module.exports = router;
