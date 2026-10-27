'use strict';

/* Roles and the staff side: who may do what, the manual order flow (restaurant, then courier),
   rejecting and cancelling, sold out and paused, review replies and hiding, users and promo codes. */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { client, as, newCustomer } = require('../client');

let cust, addr, partner, otherPartner, courier, courier2, admin;
before(async () => {
  cust = await newCustomer('Test User');
  addr = (await cust.post('/api/addresses', { label: 'Home', street: '1 Test Street', city: 'Old Town' })).body.addressId;
  partner = await as('partner');
  otherPartner = client(); await otherPartner.login('partner.forno-sette@morsel.app', 'morsel-partner-2026');
  courier = await as('courier');
  courier2 = client(); await courier2.login('courier2@morsel.app', 'morsel-courier-2026');
  admin = await as('admin');
  /* Every test here works with the autopilot off, so nothing moves on its own. */
  await admin.put('/api/admin/settings', { autopilot: false });
});
after(async () => { await admin.put('/api/admin/settings', { autopilot: true }); });

const place = items => cust.post('/api/orders', { restaurantSlug: 'smash-society', items, addressId: addr, payment: 'cash', delivery: { type: 'asap' }, tip: 0 });

test('each role only reaches its own pages', async () => {
  const anon = client();
  assert.equal((await anon.get('/api/admin/users')).status, 401);
  assert.equal((await cust.get('/api/admin/overview')).status, 403);
  assert.equal((await cust.get('/api/partner/orders')).status, 403);
  assert.equal((await cust.get('/api/courier/deliveries')).status, 403);
  assert.equal((await partner.get('/api/admin/overview')).status, 403);
  assert.equal((await partner.get('/api/courier/deliveries')).status, 403);
  assert.equal((await courier.get('/api/partner/orders')).status, 403);
  assert.equal((await partner.put('/api/admin/settings', { autopilot: true })).status, 403);
  const o = await admin.get('/api/admin/overview');
  assert.equal(o.status, 200);
  assert.equal(o.body.days.length, 14);
});

test('an order goes from the restaurant to the courier to the door, each step by the right person', async () => {
  const id = (await place([{ itemSlug: 'classic', qty: 1, options: { sauce: 'bbq' } }])).body.order._id;
  const board = await partner.get('/api/partner/orders');
  assert.ok(board.body.active.some(o => o._id === id), 'the restaurant sees the new order');
  assert.equal((await otherPartner.post(`/api/partner/orders/${id}/accept`, { prepMinutes: 10 })).status, 404, 'another restaurant can’t touch it');
  assert.ok((await courier.post(`/api/courier/deliveries/${id}/accept`)).status >= 400, 'no courier before the restaurant accepts');
  assert.equal((await partner.post(`/api/partner/orders/${id}/accept`, { prepMinutes: 99 })).status, 400);
  assert.equal((await partner.post(`/api/partner/orders/${id}/accept`, { prepMinutes: 15 })).body.order.status, 'accepted');
  assert.ok((await partner.post(`/api/partner/orders/${id}/accept`, { prepMinutes: 15 })).status >= 400, 'accepting twice is refused');
  assert.ok((await cust.post(`/api/orders/${id}/cancel`)).status >= 400, 'the customer can’t cancel once accepted');
  assert.ok((await courier.get('/api/courier/deliveries')).body.available.some(o => o._id === id));
  assert.equal((await courier.post(`/api/courier/deliveries/${id}/accept`)).status, 200);
  assert.ok((await courier2.post(`/api/courier/deliveries/${id}/accept`)).status >= 400, 'a second courier can’t take it');
  assert.ok((await courier.post(`/api/courier/deliveries/${id}/pickedup`)).status >= 400, 'not ready yet');
  await partner.post(`/api/partner/orders/${id}/preparing`);
  assert.equal((await partner.post(`/api/partner/orders/${id}/ready`)).body.order.status, 'ready');
  assert.ok((await courier.post(`/api/courier/deliveries/${id}/delivered`)).status >= 400, 'pick up first');
  assert.equal((await courier2.post(`/api/courier/deliveries/${id}/pickedup`)).status, 404, 'only the courier who took it');
  assert.equal((await courier.post(`/api/courier/deliveries/${id}/pickedup`)).body.order.status, 'pickedup');
  assert.equal((await courier.post(`/api/courier/deliveries/${id}/delivered`)).body.order.status, 'delivered');
  const seen = (await cust.get(`/api/orders/${id}`)).body.order;
  assert.equal(seen.status, 'delivered');
  assert.ok(seen.courier && seen.courier.name, 'the customer sees who delivered it');
  assert.ok((await courier.get('/api/courier/deliveries')).body.today.deliveries >= 1);
});

test('rejecting needs a reason; the customer and the admin can cancel', async () => {
  const r = (await place([{ itemSlug: 'rings', qty: 1 }])).body.order._id;
  assert.equal((await partner.post(`/api/partner/orders/${r}/reject`, { reason: '' })).status, 400);
  assert.equal((await partner.post(`/api/partner/orders/${r}/reject`, { reason: 'Too busy right now' })).status, 200);
  const rejected = (await cust.get(`/api/orders/${r}`)).body.order;
  assert.equal(rejected.status, 'cancelled');
  assert.equal(rejected.cancelReason, 'Too busy right now');
  const c = (await place([{ itemSlug: 'rings', qty: 1 }])).body.order._id;
  assert.equal((await cust.post(`/api/orders/${c}/cancel`)).body.order.status, 'cancelled');
  const s = (await place([{ itemSlug: 'rings', qty: 1 }])).body.order._id;
  assert.equal((await admin.post(`/api/admin/orders/${s}/status`, { status: 'cancelled', reason: 'Refunded by support' })).status, 200);
  const list = await admin.get('/api/admin/orders?status=cancelled&restaurant=smash-society&q=Test%20User');
  assert.ok(list.body.orders.length >= 3 && list.body.orders.every(o => o.status === 'cancelled'));
});

test('sold out dishes and a paused restaurant can’t be ordered', async () => {
  assert.equal((await partner.patch('/api/partner/menu/fries', { soldOut: true })).status, 200);
  const menu = (await client().get('/api/restaurants/smash-society')).body.restaurant.menu.flatMap(s => s.items);
  assert.equal(menu.find(i => i.slug === 'fries').soldOut, true);
  assert.ok((await place([{ itemSlug: 'fries', qty: 1, options: { fries: 'classic' } }])).status >= 400);
  await partner.patch('/api/partner/menu/fries', { soldOut: false });
  assert.equal((await partner.patch('/api/partner/menu/not-a-dish', { soldOut: true })).status, 404);
  await partner.patch('/api/partner/restaurant', { paused: true });
  assert.equal((await client().get('/api/restaurants')).body.restaurants.find(r => r.slug === 'smash-society').paused, true);
  assert.ok((await place([{ itemSlug: 'rings', qty: 1 }])).status >= 400);
  await partner.patch('/api/partner/restaurant', { paused: false });
  assert.equal((await place([{ itemSlug: 'rings', qty: 1 }])).status, 201);
});

test('a partner replies to a review in public; an admin can hide one', async () => {
  const list = (await partner.get('/api/partner/reviews')).body.reviews;
  const rv = list.find(r => !r.reply) || list[0];
  assert.equal((await partner.put(`/api/partner/reviews/${rv._id}/reply`, { text: 'Thanks for ordering, see you soon!' })).status, 200);
  assert.equal((await otherPartner.put(`/api/partner/reviews/${rv._id}/reply`, { text: 'Not my restaurant' })).status, 404);
  const pub = (await client().get('/api/restaurants/smash-society/reviews?sort=newest&page=1')).body.reviews;
  const all = pub.concat((await client().get('/api/restaurants/smash-society/reviews?page=2')).body.reviews, (await client().get('/api/restaurants/smash-society/reviews?page=3')).body.reviews);
  assert.ok(all.some(r => r._id === rv._id && r.reply && r.reply.text === 'Thanks for ordering, see you soon!'));
  const before = (await client().get('/api/restaurants/smash-society/reviews')).body.summary.count;
  assert.equal((await admin.patch(`/api/admin/reviews/${rv._id}`, { hidden: true })).status, 200);
  assert.equal((await client().get('/api/restaurants/smash-society/reviews')).body.summary.count, before - 1);
  await admin.patch(`/api/admin/reviews/${rv._id}`, { hidden: false });
});

test('admins create staff, change roles and disable accounts; the last admin stays', async () => {
  const email = `test.courier.${Date.now()}@example.com`;
  const made = await admin.post('/api/admin/users', { name: 'Test Courier', email, password: 'courier-pass-1', role: 'courier', vehicle: 'bike' });
  assert.equal(made.status, 201, made.text);
  const c = client();
  assert.equal((await c.login(email, 'courier-pass-1')).role, 'courier');
  assert.equal((await c.get('/api/courier/deliveries')).status, 200);
  const off = await admin.patch(`/api/admin/users/${made.body.user._id}`, { disabled: true });
  assert.equal(off.body.user.disabled, true);
  const gone = await c.get('/api/courier/deliveries');
  assert.equal(gone.body.error.code, 'account_disabled', 'its session stops working at once, with the reason');
  assert.equal((await client().post('/api/auth/login', { email, password: 'courier-pass-1' })).status, 403);
  const me = (await admin.get('/api/auth/me')).body.user;
  assert.equal((await admin.patch(`/api/admin/users/${me._id}`, { role: 'customer' })).body.error.code, 'self_change');
  const found = await admin.get(`/api/admin/users?q=${encodeURIComponent(email)}`);
  assert.equal(found.body.users.length, 1);
});

test('promo codes: create, use and turn off', async () => {
  const code = `TEST${Date.now() % 100000}`;
  const made = await admin.post('/api/admin/promos', { code, description: '€5 off', type: 'fixed', value: 500, minSubtotal: 0, maxDiscount: null, firstOrderOnly: false, active: true });
  assert.equal(made.status, 201, made.text);
  assert.equal((await admin.post('/api/admin/promos', { code, type: 'fixed', value: 500 })).body.error.code, 'code_taken');
  const r = await cust.post('/api/orders', { restaurantSlug: 'smash-society', items: [{ itemSlug: 'classic', qty: 2, options: { sauce: 'bbq' } }], addressId: addr, payment: 'cash', delivery: { type: 'asap' }, tip: 0, promoCode: code });
  assert.equal(r.body.order.pricing.discount, 500);
  const row = (await admin.get('/api/admin/promos')).body.promos.find(p => p.code === code);
  assert.equal(row.uses, 1);
  await admin.patch(`/api/admin/promos/${row._id}`, { active: false });
  assert.equal((await cust.post('/api/promo/validate', { code, restaurantSlug: 'smash-society' })).status, 400);
});
