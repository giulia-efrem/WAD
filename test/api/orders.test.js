'use strict';

/* The customer side: addresses, favourites, promo codes, placing orders (priced on the server),
   following them, reviews, cancelling and ownership. */

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { client, newCustomer } = require('../client');

let a, addr;
before(async () => {
  a = await newCustomer('Test User');
  const r = await a.post('/api/addresses', { label: 'Home', street: '1 Test Street', details: 'Flat 2', city: 'Old Town' });
  addr = r.body.addressId;
});
const order = (c, items, extra = {}) => c.post('/api/orders', { restaurantSlug: 'smash-society', items, addressId: addr, payment: 'cash', delivery: { type: 'asap' }, tip: 0, ...extra });

test('addresses: the first is the default, another can take over, delete, validation', async () => {
  const c = await newCustomer();
  const first = await c.post('/api/addresses', { label: 'Home', street: '1 Test Street', city: 'Old Town' });
  assert.equal(first.status, 201);
  assert.equal(first.body.user.addresses[0].isDefault, true);
  const second = await c.post('/api/addresses', { label: 'Work', street: '99 Office Road', city: 'Docklands', makeDefault: true });
  assert.equal(second.body.user.addresses.filter(x => x.isDefault).length, 1);
  assert.equal(second.body.user.addresses.find(x => x.isDefault)._id, second.body.addressId);
  const back = await c.patch(`/api/addresses/${first.body.addressId}/default`);
  assert.equal(back.body.user.addresses.find(x => x.isDefault)._id, first.body.addressId);
  assert.equal((await c.del(`/api/addresses/${second.body.addressId}`)).body.user.addresses.length, 1);
  assert.equal((await c.post('/api/addresses', { label: 'Castle', street: 'x', city: '' })).status, 400);
  assert.equal((await client().post('/api/addresses', { label: 'Home', street: '1 Test Street', city: 'Old Town' })).status, 401);
});

test('favourites toggle on and off', async () => {
  const list = (await a.get('/api/restaurants')).body.restaurants;
  const id = list.find(r => r.slug === 'smash-society')._id;
  const on = await a.post(`/api/favorites/${id}/toggle`);
  assert.ok(on.body.user.favorites.includes(id));
  const off = await a.post(`/api/favorites/${id}/toggle`);
  assert.ok(!off.body.user.favorites.includes(id));
});

test('promo codes are checked on the server', async () => {
  const anon = await client().post('/api/promo/validate', { code: 'welcome20', restaurantSlug: 'forno-sette' });
  assert.equal(anon.status, 400);
  assert.match(anon.body.error.message, /Log in to use WELCOME20/);
  assert.equal((await a.post('/api/promo/validate', { code: 'welcome20', restaurantSlug: 'forno-sette' })).body.code, 'WELCOME20');
  const free = await a.post('/api/promo/validate', { code: 'FREEDEL', restaurantSlug: 'smash-society' });
  assert.match(free.body.error.message, /already free/);
  assert.equal((await a.post('/api/promo/validate', { code: 'FREEDEL', restaurantSlug: 'forno-sette' })).body.valid, true);
  assert.equal((await a.post('/api/promo/validate', { code: 'BOGUS' })).body.error.code, 'invalid_promo');
});

test('an order is priced on the server, whatever the browser sends', async () => {
  /* Classic smash 990 + extra patty 250 + bacon 180 = 1420, x2 = 2840; truffle fries 500. Subtotal 3340.
     Service 5% = 167, free delivery, WELCOME20 = 20% = 668, tip 200. Total 3039. */
  const r = await order(a, [
    { itemSlug: 'classic', qty: 2, options: { sauce: 'bbq', burgerExtras: ['bacon', 'patty'] }, unitPrice: 1, name: 'Free burger' },
    { itemSlug: 'fries', qty: 1, options: { fries: 'truffle' }, unitPrice: 0 }
  ], { payment: 'card', promoCode: 'WELCOME20', tip: 200, pricing: { total: 1 } });
  assert.equal(r.status, 201, r.text);
  const p = r.body.order.pricing;
  assert.deepEqual([p.subtotal, p.serviceFee, p.discount, p.tip, p.total], [3340, 167, 668, 200, 3039]);
  assert.equal(r.body.order.items[0].unitPrice, 1420);
  assert.equal(r.body.order.items[0].name, 'Classic smash');
  const again = await a.get(`/api/orders/${r.body.order._id}`);
  assert.equal(again.body.order.status, 'placed');
  assert.equal(again.body.order.items[0].options.map(o => o.choice).join(), 'Smoky BBQ,Extra patty,Crispy bacon');
  const second = await order(a, [{ itemSlug: 'rings', qty: 1 }], { promoCode: 'WELCOME20' });
  assert.match(second.body.error.message, /first order only/);
  const mismatch = await order(a, [{ itemSlug: 'rings', qty: 1 }], { expectedTotal: 1 });
  assert.equal(mismatch.body.error.code, 'price_mismatch');
});

test('orders that make no sense are refused with a clear reason', async () => {
  const cases = [
    [[{ itemSlug: 'lobster', qty: 1 }], 'unknown_item'],
    [[{ itemSlug: 'classic', qty: 1, options: { sauce: 'ketchup' } }], 'unknown_option'],
    [[{ itemSlug: 'classic', qty: 1 }], 'missing_option'],
    [[{ itemSlug: 'classic', qty: 1, options: { sauce: 'house' }, remove: ['unicorn'] }], 'unknown_ingredient'],
    [[{ itemSlug: 'classic', qty: 1, options: { sauce: 'house' }, remove: ['brioche-bun'] }], 'not_removable'],
    [[{ itemSlug: 'smash-menu', qty: 1, parts: { burger: 'classic', side: 'fries' }, options: { sauce: 'house' } }], 'missing_part'],
    [[{ itemSlug: 'smash-menu', qty: 1, parts: { burger: 'classic', side: 'wings', drink: 'cola' }, options: { sauce: 'house' } }], 'unknown_part']
  ];
  for (const [items, code] of cases) {
    const r = await order(a, items);
    assert.equal(r.status, 400, code);
    assert.equal(r.body.error.code, code);
  }
  for (const qty of [0, 21]) assert.match((await order(a, [{ itemSlug: 'rings', qty }])).body.error.message, /between 1 and 20/);
  assert.equal((await order(a, [{ itemSlug: 'rings', qty: 1 }], { tip: 5000 })).body.error.code, 'validation_failed');
  const soon = await order(a, [{ itemSlug: 'rings', qty: 1 }], { delivery: { type: 'scheduled', at: Date.now() + 10 * 60e3 } });
  assert.equal(soon.body.error.code, 'invalid_time');
});

test('a meal deal and removed ingredients are priced and kept with the order', async () => {
  const deal = await order(a, [{ itemSlug: 'smash-menu', qty: 2, parts: { burger: 'double', side: 'rings', drink: 'cola' }, options: { sauce: 'bbq', burgerExtras: ['bacon'] }, remove: ['pickles'], unitPrice: 1 }]);
  assert.equal(deal.status, 201, deal.text);
  const line = deal.body.order.items[0];
  assert.equal(line.unitPrice, 1920);
  assert.equal(line.parts.map(p => `${p.group}=${p.name}`).join(), 'Burger=Double trouble,Side=Onion rings,Drink=House cola');
  assert.equal(line.removed[0].name, 'Pickles');
  const custom = await order(a, [{ itemSlug: 'classic', qty: 1, options: { sauce: 'garlic', burgerExtras: ['cheese'] }, remove: ['pickles', 'onion'], note: 'Well done' }]);
  assert.equal(custom.body.order.items[0].removed.map(r => r.name).join(), 'Pickles,Onion');
  assert.equal(custom.body.order.items[0].note, 'Well done');
});

test('follow an order to delivered, then review it once', async () => {
  const r = await order(a, [{ itemSlug: 'rings', qty: 3 }]);
  const id = r.body.order._id;
  assert.equal((await a.post(`/api/orders/${id}/review`, { food: 5, delivery: 'up' })).body.error.code, 'not_delivered');
  const ORDER = ['placed', 'accepted', 'preparing', 'ready', 'pickedup', 'delivered'];
  let last = 0;
  for (let i = 0; i < 6; i++) {
    const s = ORDER.indexOf((await a.post(`/api/orders/${id}/skip`)).body.order.status);
    assert.ok(s >= last, 'only moves forward');
    last = s;
  }
  assert.equal(ORDER[last], 'delivered');
  assert.equal((await a.post(`/api/orders/${id}/review`, { food: 9, delivery: 'up' })).status, 400);
  const before = (await a.get('/api/restaurants/smash-society/reviews')).body.summary.count;
  const rv = await a.post(`/api/orders/${id}/review`, { food: 1, delivery: 'down', comment: 'Rings were cold' });
  assert.equal(rv.status, 200);
  assert.equal((await a.post(`/api/orders/${id}/review`, { food: 5, delivery: 'up' })).body.error.code, 'already_reviewed');
  const after = await a.get('/api/restaurants/smash-society/reviews?sort=lowest');
  assert.equal(after.body.summary.count, before + 1);
  assert.ok(after.body.reviews.some(x => x.mine && x.author === 'Test U.' && x.comment === 'Rings were cold'));
});

test('cancel a new order; my orders come newest first', async () => {
  const r = await order(a, [{ itemSlug: 'rings', qty: 1 }]);
  const c = await a.post(`/api/orders/${r.body.order._id}/cancel`);
  assert.equal(c.body.order.status, 'cancelled');
  const mine = (await a.get('/api/orders/mine')).body.orders;
  assert.ok(mine.length >= 4);
  assert.ok(mine.every((o, i) => !i || new Date(mine[i - 1].createdAt) >= new Date(o.createdAt)));
  assert.equal((await a.get('/api/orders/nothex')).status, 400);
});

test('nobody else can see, change or use your order and address', async () => {
  const mine = (await a.get('/api/orders/mine')).body.orders[0]._id;
  const b = await newCustomer('Other Person');
  assert.equal((await b.get(`/api/orders/${mine}`)).status, 404);
  assert.equal((await b.post(`/api/orders/${mine}/skip`)).status, 404);
  assert.equal((await b.post(`/api/orders/${mine}/cancel`)).status, 404);
  assert.equal((await order(b, [{ itemSlug: 'rings', qty: 1 }])).body.error.code, 'invalid_address');
  assert.equal((await b.del(`/api/addresses/${addr}`)).status, 404);
  assert.equal((await b.get('/api/orders/mine')).body.orders.length, 0);
});
