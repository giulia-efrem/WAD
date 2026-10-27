'use strict';

/* Compact notation for the menus in this folder.

   dish(slug, name, description, price, opts)
     opts.k    kind: 'main' (default), 'starter', 'side', 'drink', 'dessert'
     opts.pop  true for popular dishes (shown in the Popular section)
     opts.o    option group keys from seed/options.js, e.g. ['size', 'pizzaExtras']
     opts.i    ingredients, comma separated; a leading ~ means it can be left out
     opts.t    dietary tags: v vegetarian, ve vegan, sp spicy, gf gluten-free, n contains nuts
     opts.a    allergens (EU list): gluten milk egg fish crustaceans molluscs nuts peanuts soy sesame mustard celery sulphites lupin

   deal(slug, name, description, price, parts, opts)
     parts: [key, label, choices] where choices is 'dishSlug dishSlug:surcharge ...'.
     The first part is the main dish: it gets that dish's own customisation. */

const TAGS = { v: 'vegetarian', ve: 'vegan', sp: 'spicy', gf: 'gluten-free', n: 'contains-nuts' };
const ALLERGENS = ['gluten', 'milk', 'egg', 'fish', 'crustaceans', 'molluscs', 'nuts', 'peanuts', 'soy', 'sesame', 'mustard', 'celery', 'sulphites', 'lupin'];

const idOf = name => name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const words = s => (s || '').split(/\s+/).filter(Boolean);

function dish(slug, name, description, price, opts = {}) {
  const tags = words(opts.t).map(t => {
    if (!TAGS[t]) throw new Error(`${slug}: unknown tag "${t}"`);
    return TAGS[t];
  });
  /* Vegan already says vegetarian. */
  const finalTags = tags.includes('vegan') ? tags.filter(t => t !== 'vegetarian') : tags;
  const allergens = words(opts.a);
  for (const a of allergens) if (!ALLERGENS.includes(a)) throw new Error(`${slug}: unknown allergen "${a}"`);
  const ingredients = (opts.i || '').split(',').map(s => s.trim()).filter(Boolean).map(entry => {
    const removable = entry.startsWith('~');
    const nm = removable ? entry.slice(1).trim() : entry;
    return { id: idOf(nm), name: nm, removable };
  });
  if (!ingredients.length) throw new Error(`${slug}: no ingredients`);
  return { slug, name, description, price, kind: opts.k || 'main', popular: !!opts.pop, options: opts.o || [], ingredients, tags: finalTags, allergens };
}

function deal(slug, name, description, price, parts, opts = {}) {
  return {
    slug, name, description, price, kind: 'deal', popular: !!opts.pop, options: [], ingredients: [], tags: [], allergens: [],
    deal: {
      parts: parts.map(([key, label, choices], i) => ({
        key, name: label, main: i === 0,
        choices: words(choices).map(c => { const [itemSlug, delta] = c.split(':'); return { itemSlug, delta: Number(delta || 0) }; })
      }))
    }
  };
}

module.exports = { dish, deal, idOf, TAGS, ALLERGENS };
