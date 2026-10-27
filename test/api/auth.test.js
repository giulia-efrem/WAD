'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { client, as, newCustomer } = require('../client');

test('sign up, log out, log in again', async () => {
  const c = client();
  const email = `Test.${Date.now()}@Example.com`;
  const r = await c.post('/api/auth/signup', { name: 'Test Signup', email, password: 'secret-pass-1' });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.email, email.toLowerCase(), 'email is stored in lower case');
  assert.equal(r.body.user.role, 'customer');
  assert.ok(!('passwordHash' in r.body.user), 'the password hash never leaves the server');
  const cookie = r.headers.getSetCookie().join(';');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);

  assert.equal((await c.get('/api/auth/me')).body.user.email, email.toLowerCase());
  assert.equal((await c.post('/api/auth/logout')).status, 200);
  assert.equal((await c.get('/api/auth/me')).body.user, null, 'logged out');
  await c.login(email.toLowerCase(), 'secret-pass-1');
  assert.equal((await c.get('/api/auth/me')).body.user.name, 'Test Signup');
});

test('signup and login errors', async () => {
  const c = await newCustomer();
  const dup = await client().post('/api/auth/signup', { name: 'Again', email: c.email, password: 'secret-pass-1' });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, 'email_taken');
  const bad = await client().post('/api/auth/signup', { name: 'X', email: 'bad', password: 'short' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'validation_failed');
  const wrong = await client().post('/api/auth/login', { email: c.email, password: 'wrong-password' });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error.code, 'bad_credentials');
});

test('nobody can make themselves staff by signing up', async () => {
  const c = client();
  const r = await c.post('/api/auth/signup', { name: 'Sneaky Person', email: `test.sneaky.${Date.now()}@example.com`, password: 'secret-pass-1', role: 'admin' });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.role, 'customer');
  assert.equal((await c.get('/api/admin/overview')).status, 403);
});

test('demo logins sign in each role without a password', async () => {
  const demo = await client().get('/api/auth/demo');
  assert.equal(demo.body.enabled, true);
  assert.deepEqual([...new Set(demo.body.accounts.map(a => a.role))].sort(), ['admin', 'courier', 'customer', 'partner']);
  for (const role of ['customer', 'partner', 'courier', 'admin']) {
    const c = client();
    const r = await c.post('/api/auth/demo', { role });
    assert.equal(r.status, 200, role);
    assert.equal(r.body.user.role, role);
  }
  const forno = await client().post('/api/auth/demo', { role: 'partner', restaurant: 'forno-sette' });
  const r = (await client().get('/api/restaurants/forno-sette')).body.restaurant;
  assert.equal(forno.body.user.restaurant, String(r._id), 'the partner for the restaurant being viewed');
});

test('change your name and password; other sessions are signed out', async () => {
  const c = await newCustomer();
  const other = client();
  await other.login(c.email, c.password);
  assert.equal((await c.patch('/api/auth/me', { name: 'New Name' })).body.user.name, 'New Name');
  const same = await c.post('/api/auth/password', { current: c.password, password: c.password });
  assert.equal(same.body.error.code, 'same_password');
  const wrong = await c.post('/api/auth/password', { current: 'not-it-at-all', password: 'another-pass-2' });
  assert.equal(wrong.body.error.code, 'wrong_password');
  assert.equal((await c.post('/api/auth/password', { current: c.password, password: 'another-pass-2' })).status, 200);
  assert.ok((await c.get('/api/auth/me')).body.user, 'this session stays logged in');
  assert.equal((await other.get('/api/auth/me')).body.user, null, 'the other session is logged out');
  await client().login(c.email, 'another-pass-2');
});

test('delete your account: orders stay as "Former customer"', async () => {
  const c = await newCustomer();
  const wrong = await c.del('/api/auth/me', { password: 'nope-nope-nope' });
  assert.equal(wrong.status, 400);
  assert.equal((await c.del('/api/auth/me', { password: c.password })).status, 200);
  assert.equal((await c.get('/api/auth/me')).body.user, null);
  assert.equal((await client().post('/api/auth/login', { email: c.email, password: c.password })).status, 401);
});

test('staff accounts cannot delete themselves', async () => {
  const p = await as('partner');
  assert.equal((await p.del('/api/auth/me', { password: 'morsel-partner-2026' })).status, 403);
});
