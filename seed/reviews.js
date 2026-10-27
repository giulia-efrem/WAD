'use strict';

/* Builds 20-40 realistic reviews per restaurant for npm run seed. A seeded random generator
   keeps them the same on every run. Ratings centre on the restaurant's catalog rating with
   some lower ones mixed in; comments mention real dishes from its menu. */

const FIRST = ['Maya', 'Luca', 'Sofia', 'Andrei', 'Ines', 'Tom', 'Elena', 'Jonas', 'Priya', 'Marco', 'Chloe', 'Sam', 'Noah', 'Ava', 'Leo', 'Nina', 'Omar', 'Hana', 'Ivan', 'Zoe', 'Theo', 'Mila', 'Ravi', 'Lena', 'Daniel', 'Grace', 'Felix', 'Ana', 'Ben', 'Yuki', 'Carla', 'Ethan', 'Sara', 'Mateo', 'Ella', 'Adam', 'Iris', 'Kai', 'Rosa', 'Max'];
const LAST = 'ABCDEFGHJKLMNOPRSTVWZ';

const COMMENTS = {
  5: [
    'The {dish} was outstanding. Easily the best I’ve had in town.',
    'Arrived hot and quicker than the estimate. {Dish} was perfect.',
    '{Dish} is a must. Already planning my next order.',
    'Everything was spot on, especially the {dish}.',
    'Generous portions and the {dish} tasted really fresh.',
    'Courier was lovely and the {dish} was still piping hot.',
    'Ordered the {dish} for the third time this month. Never disappoints.',
    'Beautifully packed, nothing spilled, and the {dish} was delicious.',
    'Exactly like eating at the restaurant. The {dish} was a highlight.',
    'Great value. The {dish} and the {dish2} were both excellent.'
  ],
  4: [
    'Really good {dish}, just a little slower than usual tonight.',
    'Solid as always. The {dish} could use a touch more seasoning.',
    'Tasty {dish}, though the packaging could be better.',
    'Great food, arrived about ten minutes after the estimate.',
    'Loved the {dish}. The {dish2} was good but not quite as memorable.',
    'Very good overall. I’d ask for extra sauce next time.'
  ],
  3: [
    'The {dish} was fine but nothing special.',
    'Food was okay, but it arrived lukewarm.',
    'Decent, though the {dish} was smaller than I expected.',
    'Good flavour, but my note for the kitchen was ignored.'
  ],
  2: [
    'The {dish} was soggy by the time it got here.',
    'Missing the extra I paid for, and the {dish} was cold.',
    'Took almost an hour. The {dish} had clearly been waiting.'
  ],
  1: [
    'Arrived 40 minutes late and the {dish} was cold.',
    'Wrong order delivered. Support sorted a refund, but still disappointing.'
  ]
};

/* mulberry32: small, fast, deterministic */
function rng(seedText) {
  let a = 0;
  for (const ch of seedText) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) + 1) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* Ratings for one restaurant: mostly 5s and 4s with a few lower ones, nudged between 4 and 5
   until the average is close to the target (the catalog rating). */
function ratingsFor(rand, n, target) {
  const p5 = Math.min(0.85, Math.max(0.4, 0.45 + (target - 4.3)));
  const rest = 1 - p5;
  const weights = [[5, p5], [4, rest * 0.72], [3, rest * 0.16], [2, rest * 0.07], [1, rest * 0.05]];
  const draw = () => { let x = rand(); for (const [v, w] of weights) { if ((x -= w) < 0) return v; } return 5; };
  const list = Array.from({ length: n }, draw);
  if (!list.some(v => v <= 3)) list[Math.floor(rand() * n)] = 3;
  if (!list.some(v => v === 4)) list[Math.floor(rand() * n)] = 4;
  const mean = () => list.reduce((sum, v) => sum + v, 0) / list.length;
  for (let guard = 0; guard < 200 && Math.abs(mean() - target) > 0.05; guard++) {
    const i = Math.floor(rand() * n);
    if (mean() < target && list[i] === 4 && list.filter(v => v === 4).length > 1) list[i] = 5;
    else if (mean() > target && list[i] === 5) list[i] = 4;
  }
  return list;
}

/* restaurant: the catalog entry (slug, rating, menu). Returns plain review objects. */
function reviewsFor(restaurant, now = Date.now()) {
  const rand = rng(restaurant.slug);
  const n = 20 + Math.floor(rand() * 21);
  const dishes = restaurant.menu.flatMap(s => s.items);
  const popular = dishes.filter(d => d.popular);
  const ratings = ratingsFor(rand, n, restaurant.rating);
  const usedNames = new Set();
  return ratings.map((food, i) => {
    let author;
    do { author = `${pick(rand, FIRST)} ${pick(rand, LAST)}.`; } while (usedNames.has(author) && usedNames.size < 300);
    usedNames.add(author);
    const main = rand() < 0.65 && popular.length ? pick(rand, popular) : pick(rand, dishes);
    let second = pick(rand, dishes);
    if (second.slug === main.slug) second = dishes[(dishes.indexOf(main) + 1) % dishes.length];
    const qty = rand() < 0.3 ? 2 : 1;
    const both = rand() < 0.55;
    const ordered = [qty > 1 ? `${qty}× ${main.name}` : main.name, ...(both ? [second.name] : [])].join(', ');
    const withComment = food <= 3 || rand() < 0.75;
    const dishName = main.name.replace(/\s*\(\d+( pieces)?\)$/, '');
    const dish2Name = second.name.replace(/\s*\(\d+( pieces)?\)$/, '');
    const comment = withComment
      ? pick(rand, COMMENTS[food].filter(c => both || !c.includes('{dish2}'))).replace('{Dish}', cap(dishName)).replace('{dish}', dishName).replace('{dish2}', dish2Name)
      : '';
    const delivery = food >= 4 ? (rand() < 0.95 ? 'up' : 'down') : food === 3 ? (rand() < 0.6 ? 'up' : 'down') : (rand() < 0.15 ? 'up' : 'down');
    /* Spread over the last six months, newest first in insertion order. */
    const createdAt = new Date(now - Math.floor((i + rand()) / n * 180 * 86400000));
    return { author, food, delivery, comment, ordered, createdAt, updatedAt: createdAt };
  });
}

module.exports = { reviewsFor };
