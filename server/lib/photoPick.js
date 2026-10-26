'use strict';

/* Ranks Unsplash search results for a restaurant cover or a dish. The API can't see faces or
   text in a photo, so this reads the photo's alt text, description and tags, then prefers the
   right shape, a sharp original and a close match with the query. A person should still review
   the picks at /admin/photos. */

const PEOPLE = /\b(person|people|man|men|woman|women|girl|boy|child|children|kid|kids|lady|guy|couple|friends|family|chef|waiter|waitress|face|smiling|smile|portrait|selfie|eating|holding|hands?|fingers?)\b/i;
const TEXT = /\b(text|logo|sign|signage|menu|poster|typography|letters?|lettering|brand|branding|label|packaging|neon|words?|quote|chalkboard|blackboard|board with)\b/i;
const NOT_FOOD = /\b(illustration|vector|3d render|cartoon|drawing|painting|toy|plastic|mockup)\b/i;

/* Lower-case words with simple plurals folded (sushies -> sushi, tacos -> taco, dumplings -> dumpling). */
const stem = w => w.replace(/ies$/, 'y').replace(/(ch|sh|s|x|z)es$/, '$1').replace(/([^s])s$/, '$1').replace(/ie$/, 'i');
const words = s => (s || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2).map(stem);

function textOf(c) {
  return [c.alt_description, c.description, ...(c.tags || [])].join(' ');
}

/* Higher is better. Photos with people, text or illustrations sink to the bottom. */
function score(c, { query, kind }) {
  const t = textOf(c);
  const ratio = c.width / c.height;
  let s = 0;
  if (PEOPLE.test(t)) s -= 100;
  if (TEXT.test(t)) s -= 60;
  if (NOT_FOOD.test(t)) s -= 80;
  if (kind === 'cover') s += ratio >= 1.3 ? 20 : ratio >= 1.1 ? 0 : -40;
  else s += ratio >= 0.9 && ratio <= 1.7 ? 15 : ratio > 1.7 ? 0 : -10;
  const hay = new Set(words(t));
  const q = words(query);
  const hits = q.filter(w => hay.has(w)).length;
  s += hits / Math.max(1, q.length) * 40;
  if (!hits) s -= 15;
  if (Math.min(c.width, c.height) >= 2000) s += 5;
  if (!c.alt_description && !c.description && !(c.tags || []).length) s -= 10;
  return s;
}

/* Keeps Unsplash's own relevance order as a tie-breaker. */
function rank(candidates, ctx) {
  return candidates
    .map((c, i) => ({ c, s: score(c, ctx) - i * 0.5 }))
    .sort((a, b) => b.s - a.s)
    .map(x => x.c);
}

/* The best candidate not already used elsewhere and not obviously unsuitable. */
function pickBest(ranked, used, ctx) {
  const ok = ranked.filter(c => !used.has(c.id));
  return ok.find(c => score(c, ctx) > -50) || null;
}

module.exports = { score, rank, pickBest };
