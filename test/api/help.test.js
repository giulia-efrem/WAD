'use strict';

/* "Forgot password" and the Help centre's contact form, with its messages in the admin dashboard. */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { client, as, newCustomer } = require('../client');

const tokenOf = link => new URL(link, 'http://x').searchParams.get('token');

test('forgot password: the same answer for every email, a one-time link in demo mode', async () => {
  const c = await newCustomer();
  const nobody = await client().post('/api/auth/forgot', { email: 'nobody.at.all@example.com' });
  const real = await client().post('/api/auth/forgot', { email: c.email.toUpperCase() });
  assert.equal(nobody.status, 200);
  assert.equal(real.status, 200);
  assert.equal(nobody.body.message, real.body.message, 'the answer doesn’t reveal whether the account exists');
  assert.equal(nobody.body.demoLink, undefined);
  assert.match(real.body.demoLink, /^\/reset-password\?token=[\w-]{20,}$/);
  assert.equal((await client().post('/api/auth/forgot', { email: 'not-an-email' })).status, 400);

  const token = tokenOf(real.body.demoLink);
  assert.equal((await client().post('/api/auth/reset/check', { token })).body.email, c.email);
  assert.equal((await client().post('/api/auth/reset', { token, password: 'short' })).status, 400);
  /* An existing session is signed out by the reset. */
  const reset = client();
  const r = await reset.post('/api/auth/reset', { token, password: 'a-brand-new-pass' });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.body.user.email, c.email, 'the reset also logs you in');
  assert.equal((await c.get('/api/auth/me')).body.user, null, 'other sessions end');
  assert.equal((await client().post('/api/auth/login', { email: c.email, password: c.password })).status, 401, 'the old password stops working');
  await client().login(c.email, 'a-brand-new-pass');
  const again = await client().post('/api/auth/reset', { token, password: 'another-new-pass' });
  assert.equal(again.body.error.code, 'invalid_token', 'a link works once');
  assert.equal((await client().post('/api/auth/reset/check', { token: 'x'.repeat(43) })).body.error.code, 'invalid_token');
});

test('forgot password: a newer link replaces the older one', async () => {
  const c = await newCustomer();
  const first = tokenOf((await client().post('/api/auth/forgot', { email: c.email })).body.demoLink);
  const second = tokenOf((await client().post('/api/auth/forgot', { email: c.email })).body.demoLink);
  assert.equal((await client().post('/api/auth/reset/check', { token: first })).status, 400);
  assert.equal((await client().post('/api/auth/reset/check', { token: second })).status, 200);
});

test('contact form: anyone can write; validation explains what’s missing', async () => {
  const anon = client();
  const ok = await anon.post('/api/contact', { name: 'Ada Visitor', email: 'ada@example.com', topic: 'other', body: 'Do you deliver to the airport?' });
  assert.equal(ok.status, 201, ok.text);
  const short = await anon.post('/api/contact', { name: 'Ada', email: 'ada@example.com', topic: 'other', body: 'Hi' });
  assert.equal(short.status, 400);
  assert.match(short.body.error.message, /at least 10/);
  assert.equal((await anon.post('/api/contact', { name: 'Ada', email: 'ada@example.com', topic: 'nonsense', body: 'Long enough message here' })).status, 400);
  const asks = await anon.post('/api/contact', { name: 'Ada', email: 'ada@example.com', topic: 'order', orderId: 'a'.repeat(24), body: 'Where is my order please?' });
  assert.equal(asks.body.error.code, 'login_required');
});

test('contact form: a customer can name one of their own orders, not someone else’s', async () => {
  const demo = await as('customer');
  const mine = (await demo.get('/api/orders/mine')).body.orders[0]._id;
  const r = await demo.post('/api/contact', { name: 'Alex Morgan', email: 'demo@morsel.app', topic: 'order', orderId: mine, body: 'The fries were missing from this order.' });
  assert.equal(r.status, 201, r.text);
  const other = await newCustomer();
  assert.equal((await other.post('/api/contact', { name: 'Other', email: other.email, topic: 'order', orderId: mine, body: 'Not my order at all, really.' })).body.error.code, 'invalid_order');
});

test('messages appear in the admin dashboard and can be marked as handled', async () => {
  const admin = await as('admin');
  const before = (await admin.get('/api/admin/overview')).body.unreadMessages;
  await client().post('/api/contact', { name: 'Ben Unread', email: 'ben@example.com', topic: 'partner', body: 'I would like to list my bakery on Morsel.' });
  assert.equal((await admin.get('/api/admin/overview')).body.unreadMessages, before + 1);
  const list = await admin.get('/api/admin/messages?status=new&q=bakery');
  assert.equal(list.status, 200);
  const m = list.body.messages.find(x => x.name === 'Ben Unread');
  assert.ok(m && m.topic === 'partner' && m.status === 'new');
  const withOrder = (await admin.get('/api/admin/messages?status=all&q=fries')).body.messages[0];
  assert.ok(withOrder.order && withOrder.order.restaurantName && withOrder.account.email === 'demo@morsel.app');
  const done = await admin.patch(`/api/admin/messages/${m._id}`, { status: 'done', note: 'Sent the partner pack.' });
  assert.equal(done.body.message.status, 'done');
  assert.ok(done.body.message.handledBy);
  assert.equal((await admin.get('/api/admin/overview')).body.unreadMessages, before);
  const cust = await as('customer');
  assert.equal((await cust.get('/api/admin/messages')).status, 403);
  assert.equal((await client().get('/api/admin/messages')).status, 401);
});

test('a restaurant’s details include its address and the allergens on its menu', async () => {
  const r = (await client().get('/api/restaurants/forno-sette')).body.restaurant;
  assert.deepEqual(r.address, { street: '7 Mill Lane', area: 'Old Town' });
  assert.ok(r.allergens.includes('gluten') && r.allergens.includes('milk'));
});
