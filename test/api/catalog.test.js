'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { client } = require('../client');

const anon = client();

test('the restaurant list: 9 cards with opening state, search data, no full menus', async () => {
  const r = await anon.get('/api/restaurants');
  assert.equal(r.status, 200);
  assert.equal(r.body.restaurants.length, 9);
  for (const x of r.body.restaurants) {
    assert.equal(typeof x.isOpen, 'boolean');
    assert.ok(!x.menu, 'no menus in the list');
    assert.ok(x.dishes.length >= 20, `${x.slug} lists its dishes for search`);
    for (const d of x.dishes) {
      assert.ok(d.slug && d.name && d.category && Number.isInteger(d.price), `${x.slug}/${d.slug} has what a search result shows`);
      assert.ok(Array.isArray(d.tags));
    }
  }
  assert.ok(r.body.restaurants.some(x => x.dishes.some(d => d.tags.includes('vegan'))));
});

test('a restaurant with its full menu; an unknown one is a 404', async () => {
  const r = await anon.get('/api/restaurants/forno-sette');
  assert.equal(r.status, 200);
  const items = r.body.restaurant.menu.flatMap(s => s.items);
  assert.equal(items.find(i => i.slug === 'margherita').optionGroups[0].key, 'size');
  for (const it of items.filter(i => i.kind !== 'deal')) {
    assert.ok(['main', 'starter', 'side', 'drink', 'dessert'].includes(it.kind));
    assert.ok(Array.isArray(it.allergens) && Array.isArray(it.tags) && it.ingredients.length);
  }
  const deals = items.filter(i => i.kind === 'deal');
  assert.ok(deals.length >= 2 && deals.every(d => d.deal.parts.length >= 2));
  const missing = await anon.get('/api/restaurants/nope');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, 'not_found');
});

test('reviews: a summary that adds up, sorting and pages', async () => {
  const r = await anon.get('/api/restaurants/smash-society/reviews');
  assert.equal(r.status, 200);
  const s = r.body.summary;
  assert.equal([5, 4, 3, 2, 1].reduce((n, k) => n + s.breakdown[k], 0), s.count);
  assert.equal(r.body.reviews.length, 10);
  assert.equal(r.body.hasMore, true);
  const high = await anon.get('/api/restaurants/smash-society/reviews?sort=highest&page=2');
  assert.equal(high.body.page, 2);
  assert.ok(high.body.reviews.every((x, i, a) => !i || a[i - 1].food >= x.food));
  assert.equal((await anon.get('/api/restaurants/smash-society/reviews?sort=random')).status, 400);
});

test('photo credits list every photo with its photographer', async () => {
  const r = await anon.get('/api/credits');
  assert.equal(r.status, 200);
  assert.ok(r.body.credits.length > 10);
  assert.ok(r.body.credits.every(c => c.imageCredit && c.imageCredit.name && c.imageCredit.profileUrl));
});

test('unknown API routes and bad JSON answer in the usual error format', async () => {
  const r = await anon.get('/api/nothing-here');
  assert.equal(r.status, 404);
  assert.equal(r.body.error.code, 'not_found');
  const bad = await fetch(process.env.MORSEL_TEST_BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error.code, 'invalid_json');
});

test('pages of the app are served at their own addresses', async () => {
  for (const path of ['/', '/r/forno-sette', '/search?q=pizza', '/checkout/smash-society', '/order/abc', '/account', '/help', '/credits', '/admin', '/partner', '/courier']) {
    const r = await fetch(process.env.MORSEL_TEST_BASE + path);
    assert.equal(r.status, 200, path);
    assert.match(r.headers.get('content-type'), /html/);
  }
  assert.equal((await fetch(process.env.MORSEL_TEST_BASE + '/no/such/page')).status, 404);
});
