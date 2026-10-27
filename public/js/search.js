/* Search across restaurants and dishes, in the browser, from the restaurant list.
   - Accents and capitals don't matter ("taqueria" finds Taquería).
   - Each word may be the start of a word ("chee" finds cheesecake) or have a small typo
     (one letter off, two in long words: "ramne", "chesecake").
   - Cuisines and dietary labels have everyday names ("ramen" finds the Asian kitchen,
     "veggie" and "plant based" find vegetarian and vegan dishes, "gf" finds gluten-free).
   - Every word must match somewhere; a match in the name counts more than one in the description. */

import { catalog, CATS } from './state.js';

export const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const words = s => norm(s).split(' ').filter(Boolean);

/* Everyday words for each dietary label, and the label's name as shown. */
export const DIETS = {
  vegetarian: { label: 'Vegetarian', words: 'vegetarian veggie meat free meatless' },
  vegan: { label: 'Vegan', words: 'vegan plant based dairy free' },
  'gluten-free': { label: 'Gluten-free', words: 'gluten free glutenfree gf coeliac celiac' }
};
const TAG_WORDS = { ...Object.fromEntries(Object.entries(DIETS).map(([k, v]) => [k, v.words])), spicy: 'spicy hot chilli chili', 'contains-nuts': 'nuts nut' };
const CUISINE_WORDS = {
  pizza: 'pizza pizzeria italian', burgers: 'burger burgers american', asian: 'ramen asian japanese noodles bao',
  sushi: 'sushi japanese', healthy: 'healthy salad bowls', mexican: 'mexican tacos', indian: 'indian curry',
  breakfast: 'breakfast brunch', desserts: 'desserts dessert sweets cake'
};
const STOP = new Set(['and', 'with', 'the', 'a', 'of', 'in', 'or', 'for', 'some']);

/* Damerau-Levenshtein distance, stopping early once it is over `max`. */
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}

/* How well one typed word matches one word of the text: 1 exact, 0.9 start of a word, less for a typo. */
function wordScore(t, w) {
  if (w === t) return 1;
  if (w.startsWith(t)) return t.length >= 2 ? 0.9 : 0;
  if (t.length < 4) return 0;
  const max = t.length >= 8 ? 2 : 1;
  const d = Math.min(distance(t, w, max), w.length > t.length ? distance(t, w.slice(0, t.length), max) : max + 1);
  return d <= max ? 0.75 - 0.12 * d : 0;
}

/* fields: [[text, weight], ...]. Returns 0 unless every typed word matches somewhere.
   The result also says whether a typo was needed for any word. */
function score(tokens, fields) {
  let total = 0, fuzzy = false;
  for (const t of tokens) {
    let best = 0, bestQ = 0;
    for (const [ws, weight] of fields) for (const w of ws) { const q = wordScore(t, w), s = q * weight; if (s > best) { best = s; bestQ = q; } }
    if (!best) return { total: 0, fuzzy: false };
    if (bestQ < 0.9) fuzzy = true;
    total += best;
  }
  return { total, fuzzy };
}

/* The words of each restaurant and dish, worked out once per restaurant list. */
let indexFor = null, index = null;
function buildIndex() {
  if (indexFor === catalog.list) return index;
  indexFor = catalog.list;
  index = catalog.list.map(r => {
    const cuisine = r.cuisines.map(c => (CUISINE_WORDS[c] || c) + ' ' + ((CATS.find(x => x.id === c) || {}).name || '')).join(' ');
    return {
      r,
      fields: [[words(r.name), 3], [words(r.label + ' ' + cuisine), 2.2], [words(r.tagline + (r.deliveryFee ? '' : ' free delivery')), 1]],
      dishes: (r.dishes || []).map(d => ({ d, fields: dishFields(d) }))
    };
  });
  return index;
}
export function dishFields(d) {
  return [[words(d.name), 3], [words((d.tags || []).map(t => TAG_WORDS[t] || t).join(' ')), 2], [words(d.category), 1.5], [words(d.description), 1]];
}

/* Single letters are left out (except digits): they would match almost everything. */
export const queryTokens = q => words(q).filter((t, i, all) => (t.length > 1 || /\d/.test(t)) && (!STOP.has(t) || all.length === 1));

/* Restaurants (best first, with how many of their dishes match) and dishes. */
export function search(q) {
  const tokens = queryTokens(q);
  if (!tokens.length) return { restaurants: [], dishes: [], tokens };
  /* Typo matches only count when nothing matches as typed: "brunch" shouldn't bring up "crunchy". */
  const all = buildIndex().map(entry => ({ entry, own: score(tokens, entry.fields), dishes: entry.dishes.map(x => ({ x, s: score(tokens, x.fields) })) }));
  const exact = all.some(a => (a.own.total && !a.own.fuzzy) || a.dishes.some(d => d.s.total && !d.s.fuzzy));
  const keep = s => (s.total && (!exact || !s.fuzzy) ? s.total : 0);
  const restaurants = [], dishes = [];
  for (const { entry, own: ownScore, dishes: scored } of all) {
    const own = keep(ownScore);
    const hits = [];
    for (const { x, s } of scored) { const v = keep(s); if (v) hits.push({ r: entry.r, d: x.d, score: v }); }
    hits.sort((a, b) => b.score - a.score);
    dishes.push(...hits);
    /* A restaurant found only through its dishes ranks below one whose name or cuisine matches. */
    const viaDishes = hits.length ? hits[0].score * 0.55 + Math.min(hits.length, 10) * 0.05 : 0;
    if (own || viaDishes) restaurants.push({ r: entry.r, score: Math.max(own, viaDishes) + (own ? 0.5 : 0), hits: hits.length, top: own ? null : hits[0].d });
  }
  restaurants.sort((a, b) => b.score - a.score || b.r.rating - a.r.rating);
  dishes.sort((a, b) => b.score - a.score || KIND_RANK[a.d.kind] - KIND_RANK[b.d.kind] || (b.d.popular - a.d.popular));
  return { restaurants, dishes, tokens };
}

/* Equal matches list food before sides and drinks. */
const KIND_RANK = { main: 0, starter: 1, deal: 1, dessert: 2, side: 3, drink: 4 };

/* Food (not drinks or meal deals) that carries every one of the given dietary labels. */
export const dietDishes = (r, diets) => (r.dishes || []).filter(d => d.kind !== 'deal' && d.kind !== 'drink' && diets.every(t => (d.tags || []).includes(t)));

/* For the menu search box: does this dish match the typed words? */
export function dishMatches(q, d) {
  const tokens = queryTokens(q);
  return !tokens.length || score(tokens, dishFields(d)).total > 0;
}

/* Words to try when nothing matches. */
export const SUGGESTIONS = ['Pizza', 'Ramen', 'Tacos', 'Vegan', 'Sushi', 'Cheesecake', 'Curry', 'Gluten-free'];
