'use strict';

/* The parts a real delivery site has: forgot password, the Help centre and its contact form (read
   in the admin dashboard), restaurant info, receipts, the cookie notice and the phone navigation. */

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { BASE, newPage, loginAs, signUp, text, closeBrowser } = require('./helpers');

after(closeBrowser);

test('forgot password: ask for a link, open it, choose a new password, and you are logged in', async () => {
  const page = await newPage();
  const acct = await signUp(page);
  await page.request.post(BASE + '/api/auth/logout');
  await page.goto(BASE + '/');
  await page.click('#acct-btn');
  await page.click('[data-mode="forgot"]');
  await page.waitForSelector('#fp-email');
  await page.fill('#fp-email', acct.email);
  await page.click('#fp-send');
  await page.waitForSelector('.demo-link a');
  assert.match(await text(page, '.fp-sent'), /If there’s an account with that email/);
  const href = await page.getAttribute('.demo-link a', 'href');
  await page.click('.demo-link a');
  await page.waitForSelector('#rs-pass');
  assert.equal(new URL(page.url()).pathname, '/reset-password');
  assert.match(await text(page, '.reset-page'), new RegExp(acct.email.replace(/\./g, '\\.')));
  await page.fill('#rs-pass', 'short');
  await page.click('#rs-save');
  assert.match(await text(page, '#e-rs-pass'), /at least 8/);
  await page.fill('#rs-pass', 'my-new-password-1');
  await page.click('#rs-save');
  await page.waitForSelector('#acct-btn .avatar');
  assert.equal(new URL(page.url()).pathname, '/');
  /* The link works once. */
  await page.goto(BASE + href);
  await page.waitForSelector('text=This link doesn’t work any more');
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('Help centre: the FAQ opens, the contact form checks itself, and the message reaches the admin', async () => {
  const page = await newPage({ width: 375 });
  await page.goto(BASE + '/help');
  await page.waitForSelector('.faq-item');
  await page.click('.faq-item summary >> nth=0');
  assert.ok(await page.locator('.faq-item[open]').count() === 1);
  await page.click('#ct-send');
  assert.match(await text(page, '#e-ct-name'), /Enter your name/);
  await page.fill('#ct-name', 'Rita Tester');
  await page.fill('#ct-email', 'rita@example.com');
  await page.selectOption('#ct-topic', 'restaurant');
  await page.fill('#ct-body', 'Could Kaze Sushi add brown rice to the rolls?');
  await page.click('#ct-send');
  await page.waitForSelector('.contact-done');
  assert.match(await text(page, '.contact-done'), /Thanks, Rita/);
  const admin = await newPage();
  await loginAs(admin, 'admin', '/admin#messages');
  await admin.waitForSelector('.a-message');
  assert.match(await text(admin, '#side a[data-sec="messages"]'), /Messages\s*\d+/);
  const row = admin.locator('.a-message', { hasText: 'Rita Tester' });
  assert.match(await row.textContent(), /brown rice/);
  await row.locator('[data-act="msg-status"]').click();
  await admin.waitForFunction(() => ![...document.querySelectorAll('.a-message')].some(li => li.textContent.includes('Rita Tester')));
  assert.deepEqual([...page.problems, ...admin.problems], []);
  await page.context().close();
  await admin.context().close();
});

test('Help centre: a logged-in customer can pick one of their orders', async () => {
  const page = await newPage();
  await loginAs(page, 'customer', '/help');
  await page.waitForSelector('#ct-topic');
  assert.equal(await page.inputValue('#ct-email'), 'demo@morsel.app');
  await page.selectOption('#ct-topic', 'order');
  await page.waitForFunction(() => document.querySelectorAll('#ct-order option').length > 1);
  await page.selectOption('#ct-order', { index: 1 });
  await page.fill('#ct-body', 'The dessert was missing from my order.');
  await page.click('#ct-send');
  await page.waitForSelector('.contact-done');
  await page.context().close();
});

test('restaurant info: address, opening hours for the week and allergens', async () => {
  const page = await newPage();
  await page.goto(BASE + '/r/forno-sette');
  await page.waitForSelector('[data-act="r-info"]');
  await page.click('[data-act="r-info"]');
  await page.waitForSelector('#info-title');
  const info = await text(page, '.modal');
  assert.match(info, /7 Mill Lane, Old Town/);
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) assert.ok(info.includes(day), day);
  assert.match(info, /11:00/);
  assert.match(info, /gluten/i);
  assert.ok(await page.locator('.info-hours [aria-current="date"]').count() === 1, 'today is marked');
  await page.keyboard.press('Escape');
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('receipt: from the order page, with every line and the total, and a print button', async () => {
  const page = await newPage();
  await loginAs(page, 'customer', '/orders');
  await page.waitForSelector('.order-row');
  await page.click('.order-row [data-act="track"] >> nth=0');
  await page.waitForSelector('#tr-title:not(:empty)');
  await page.click('a[href^="/receipt/"]');
  await page.waitForSelector('.receipt');
  assert.match(new URL(page.url()).pathname, /^\/receipt\/[a-f0-9]{24}$/);
  const r = await text(page, '.receipt');
  assert.match(r, /Receipt/);
  assert.match(r, /Order [A-F0-9]{8}/);
  assert.match(r, /Total/);
  assert.ok(await page.locator('.rc-lines tbody tr').count() >= 1);
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.click('[data-act="print"]');
  assert.equal(await page.evaluate(() => window.__printed), true);
  /* Printed, only the receipt shows. */
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.topbar').isVisible(), false);
  assert.equal(await page.locator('.site-footer').isVisible(), false);
  const other = await newPage();
  await signUp(other);
  await other.goto(page.url());
  await other.waitForSelector('text=Receipt not found');
  assert.deepEqual(page.problems, []);
  await page.context().close();
  await other.context().close();
});

test('cookie notice: shown once, says we only use essential cookies, and stays dismissed', async () => {
  const page = await newPage({ cookies: true });
  await page.goto(BASE + '/');
  await page.waitForSelector('.cookie-note');
  assert.match(await text(page, '.cookie-note'), /only uses essential cookies/);
  await page.click('.cookie-note button');
  await page.waitForSelector('.cookie-note', { state: 'detached' });
  await page.reload();
  await page.waitForSelector('#results .card');
  assert.equal(await page.locator('.cookie-note').count(), 0);
  await page.context().close();
});

test('phones: a bottom navigation bar with Home, Search, Orders and Account', async () => {
  const page = await newPage({ width: 375 });
  await page.goto(BASE + '/');
  await page.waitForSelector('.tabbar');
  assert.deepEqual(await page.$$eval('.tabbar a', els => els.map(e => e.textContent.trim())), ['Home', 'Search', 'Orders', 'Account']);
  assert.equal(await page.getAttribute('.tabbar a[href="/"]', 'aria-current'), 'page');
  await page.click('.tabbar a[href="/search"]');
  await page.waitForSelector('#sq');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sq');
  assert.equal(await page.getAttribute('.tabbar a[href="/search"]', 'aria-current'), 'page');
  await page.click('.tabbar a[href="/orders"]');
  await page.waitForSelector('text=Your account');
  await page.click('.tabbar a[href="/account"]');
  await loginAs(page, 'customer', '/orders');
  await page.waitForSelector('.order-row');
  assert.equal(await page.getAttribute('.tabbar a[href="/orders"]', 'aria-current'), 'page');
  await page.click('.tabbar a[href="/account"]');
  await page.waitForSelector('#pf-name');
  /* It stays out of the way: hidden at checkout, and never on a desktop screen. */
  await page.goto(BASE + '/checkout');
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.tabbar').isVisible(), false);
  const desk = await newPage();
  await desk.goto(BASE + '/');
  await desk.waitForSelector('#results .card');
  assert.equal(await desk.locator('.tabbar').isVisible(), false);
  assert.deepEqual(page.problems, []);
  await page.context().close();
  await desk.context().close();
});
