'use strict';

/* The restaurants and their menus. Restaurant details are below; each menu lives in
   seed/menus/<slug>.js. Money is in cents, hours in minutes after midnight (close may go past
   1440). rating and reviewCount here are only the targets the seeded reviews aim for: the real
   values are recalculated from the reviews in the database. */

const OPTION_GROUPS = require('./options');

const HEADS = [
  { slug: 'forno-sette', name: 'Forno Sette', cuisines: ['pizza'], label: 'Pizza', tagline: 'Neapolitan pizza, ninety seconds in a wood oven', priceLevel: '€€', rating: 4.8, reviewCount: 2140, eta: { min: 25, max: 35 }, deliveryFee: 149, minOrder: 1000, hours: [{ open: 660, close: 1500 }], color: '#FFE2D1', ink: '#8A3413', illustration: 'pizza' },
  { slug: 'smash-society', name: 'Smash Society', cuisines: ['burgers'], label: 'Burgers', tagline: 'Crispy-edged smash burgers, any hour of the day', priceLevel: '€€', rating: 4.6, reviewCount: 3410, eta: { min: 20, max: 30 }, deliveryFee: 0, minOrder: 1200, hours: [{ open: 0, close: 1440 }], color: '#FFE9B8', ink: '#8A5A0B', illustration: 'burger' },
  { slug: 'bao-and-broth', name: 'Bao & Broth', cuisines: ['asian'], label: 'Ramen and bao', tagline: '18-hour broths and pillowy steamed buns', priceLevel: '€€', rating: 4.9, reviewCount: 1320, eta: { min: 30, max: 40 }, deliveryFee: 199, minOrder: 1200, hours: [{ open: 720, close: 1410 }], color: '#DCE8FB', ink: '#24406F', illustration: 'ramen' },
  { slug: 'kaze-sushi', name: 'Kaze Sushi', cuisines: ['sushi'], label: 'Sushi', tagline: 'Rolls and nigiri cut to order', priceLevel: '€€€', rating: 4.9, reviewCount: 760, eta: { min: 30, max: 40 }, deliveryFee: 249, minOrder: 1500, hours: [{ open: 720, close: 1380 }], color: '#DDF1EE', ink: '#1E5A50', illustration: 'sushi' },
  { slug: 'green-theory', name: 'Green Theory', cuisines: ['healthy'], label: 'Healthy bowls', tagline: 'Big bowls that actually keep you full', priceLevel: '€€', rating: 4.7, reviewCount: 980, eta: { min: 15, max: 25 }, deliveryFee: 99, minOrder: 1000, hours: [{ open: 540, close: 1320 }], color: '#DDF3E1', ink: '#2C6B35', illustration: 'bowl' },
  { slug: 'taqueria-luna', name: 'Taquería Luna', cuisines: ['mexican'], label: 'Mexican', tagline: 'Tacos on handmade tortillas until late', priceLevel: '€', rating: 4.7, reviewCount: 1580, eta: { min: 25, max: 35 }, deliveryFee: 149, minOrder: 1000, hours: [{ open: 720, close: 1560 }], color: '#FFF0C4', ink: '#8A6410', illustration: 'taco' },
  { slug: 'sweet-spot', name: 'The Sweet Spot', cuisines: ['desserts'], label: 'Desserts', tagline: 'Cakes, pastries and gelato made each morning', priceLevel: '€€', rating: 4.8, reviewCount: 870, eta: { min: 20, max: 30 }, deliveryFee: 0, minOrder: 800, hours: [{ open: 600, close: 1440 }], color: '#FCE0EC', ink: '#8A1F45', illustration: 'cupcake' },
  { slug: 'morning-club', name: 'Morning Club', cuisines: ['breakfast'], label: 'Breakfast and brunch', tagline: 'All-day eggs and very good coffee, until 3 pm', priceLevel: '€€', rating: 4.6, reviewCount: 640, eta: { min: 20, max: 30 }, deliveryFee: 99, minOrder: 1000, hours: [{ open: 420, close: 900 }], color: '#FFF4D6', ink: '#7A5A12', illustration: 'breakfast' },
  { slug: 'spice-route', name: 'Spice Route', cuisines: ['indian'], label: 'Indian', tagline: 'Slow-cooked curries and charcoal tandoor', priceLevel: '€€', rating: 4.7, reviewCount: 1120, eta: { min: 35, max: 45 }, deliveryFee: 199, minOrder: 1200, hours: [{ open: 660, close: 1740 }], color: '#FFE4CC', ink: '#8A3F10', illustration: 'curry' }
];

/* Builds each restaurant's menu ("Meal deals" first, then its categories) and checks it. */
function assemble(head) {
  const { deals, categories } = require(`./menus/${head.slug}`);
  const dishes = categories.flatMap(c => c.items);
  const bySlug = new Map();
  for (const d of [...dishes, ...deals]) {
    if (bySlug.has(d.slug)) throw new Error(`${head.slug}: duplicate slug "${d.slug}"`);
    bySlug.set(d.slug, d);
    for (const key of d.options) if (!OPTION_GROUPS[key]) throw new Error(`${head.slug}/${d.slug}: unknown option group "${key}"`);
  }
  if (dishes.length < 18 || dishes.length > 25) throw new Error(`${head.slug}: ${dishes.length} dishes, expected 18 to 25`);
  if (deals.length < 2 || deals.length > 4) throw new Error(`${head.slug}: ${deals.length} meal deals, expected 2 to 4`);
  for (const d of deals) {
    for (const part of d.deal.parts) {
      if (!part.choices.length) throw new Error(`${head.slug}/${d.slug}: part "${part.key}" has no choices`);
      for (const c of part.choices) {
        const item = bySlug.get(c.itemSlug);
        if (!item || item.kind === 'deal') throw new Error(`${head.slug}/${d.slug}: "${c.itemSlug}" isn't a dish on this menu`);
        if (!(c.delta >= 0)) throw new Error(`${head.slug}/${d.slug}: surcharge for "${c.itemSlug}" must be 0 or more`);
      }
    }
    const separately = d.deal.parts.reduce((s, p) => s + bySlug.get(p.choices[0].itemSlug).price, 0);
    if (separately - d.price <= 0) throw new Error(`${head.slug}/${d.slug}: the deal (${d.price}) must cost less than its default items bought separately (${separately})`);
  }
  const menu = [
    { category: 'Meal deals', items: deals },
    ...categories.map(c => ({ category: c.category, items: c.items }))
  ];
  return { ...head, menu };
}

const RESTAURANTS = HEADS.map(assemble);

module.exports = { OPTION_GROUPS, RESTAURANTS };
