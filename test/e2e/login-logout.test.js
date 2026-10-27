'use strict';

/* Every way in and out: the header button, the demo buttons, each role's own page, checkout,
   after an order, a page refresh, a session that ends elsewhere, and logging out from each page.
   The first tests guard the bug where the login form stopped working after logging out. */

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { BASE, ACCOUNTS, newPage, loginAs, signUp, text, closeBrowser } = require('./helpers');

after(closeBrowser);

/* Types slowly, the way a person does, so that anything redrawing the form in the
   background (the bug) wipes the text before it is finished. */
async function typeSlowly(page, sel, value, ms = 350) {
  await page.click(sel);
  for (const ch of value) { await page.keyboard.type(ch); await page.waitForTimeout(ms); }
}

const BASKET = () => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem('morsel.baskets', JSON.stringify({ promo: null, baskets: { 'smash-society': { updatedAt: Date.now(), lines: [
    { key: 'fries|fries:classic||', itemSlug: 'fries', name: 'Fries', unitPrice: 350, qty: 1, options: [{ group: 'Style', choice: 'Classic', price: 0 }], removed: [], sel: { fries: 'classic' }, remove: [], note: '' }] } } }));
};

async function openLogin(page) {
  await page.click('#acct-btn');
  await page.waitForSelector('#a-email');
}
async function logInWithForm(page, role = 'customer') {
  await page.fill('#a-email', ACCOUNTS[role][0]);
  await page.fill('#a-pass', ACCOUNTS[role][1]);
  await page.click('#auth-submit');
  await page.waitForSelector('#acct-btn .avatar');
}
async function logOutFromAccount(page) {
  await page.goto(BASE + '/account');
  await page.click('[data-tab="profile"]');
  await page.click('[data-act="logout"]');
  await page.waitForFunction(() => !document.querySelector('#acct-btn .avatar'));
}

for (const role of ['partner', 'courier', 'admin']) {
  test(`${role} page: after logging out, the login form keeps what you type (regression)`, async () => {
    const page = await newPage();
    await loginAs(page, role, '/' + role);
    await page.waitForSelector('#logout');
    await page.waitForTimeout(1500);
    await page.click('#logout');
    await page.waitForSelector('#l-email');
    /* Longer than two refresh cycles (4 s each) of the partner and courier boards. */
    await typeSlowly(page, '#l-email', ACCOUNTS[role][0], 600);
    assert.equal(await page.inputValue('#l-email'), ACCOUNTS[role][0], 'the email field still holds what was typed');
    await page.fill('#l-pass', ACCOUNTS[role][1]);
    await page.click('#login button[type="submit"]');
    await page.waitForSelector('#logout');
    assert.deepEqual(page.problems, []);
    await page.context().close();
  });

  test(`${role} page: the demo account button logs in`, async () => {
    const page = await newPage();
    await page.goto(BASE + '/' + role);
    await page.waitForSelector('#demo-login');
    await page.click('#demo-login');
    await page.waitForSelector('#logout');
    assert.match(await text(page, '#who'), /Log out/);
    assert.deepEqual(page.problems, []);
    await page.context().close();
  });
}

test('main site: log in from the header, log out, and the login window works again', async () => {
  const page = await newPage();
  await page.goto(BASE + '/');
  await page.waitForSelector('#results .card');
  await openLogin(page);
  await logInWithForm(page);
  await logOutFromAccount(page);
  assert.equal(await page.locator('.modal-wrap').count(), 0, 'no window left open');
  assert.equal(await page.evaluate(() => document.body.classList.contains('locked')), false, 'the page scrolls again');
  await openLogin(page);
  await typeSlowly(page, '#a-email', 'demo@morsel.app', 120);
  assert.equal(await page.inputValue('#a-email'), 'demo@morsel.app');
  await page.waitForSelector('[data-demo-role="customer"]');
  await page.click('[data-demo-role="customer"]');
  await page.waitForSelector('#acct-btn .avatar');
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('main site: the demo buttons log in each role and staff land on their own page', async () => {
  for (const [role, path] of [['customer', '/'], ['partner', '/partner'], ['courier', '/courier'], ['admin', '/admin']]) {
    const page = await newPage();
    await page.goto(BASE + '/');
    await openLogin(page);
    await page.waitForSelector(`[data-demo-role="${role}"]`);
    await page.click(`[data-demo-role="${role}"]`);
    if (path === '/') await page.waitForSelector('#acct-btn .avatar');
    else { await page.waitForURL(u => u.pathname === path); await page.waitForSelector('#logout'); }
    assert.deepEqual(page.problems, [], role);
    await page.context().close();
  }
});

test('main site: log in and out with the demo buttons twice in a row', async () => {
  const page = await newPage({ width: 375 });
  await page.goto(BASE + '/');
  for (let i = 0; i < 2; i++) {
    await openLogin(page);
    await page.waitForSelector('[data-demo-role="customer"]');
    await page.click('[data-demo-role="customer"]');
    await page.waitForSelector('#acct-btn .avatar');
    await logOutFromAccount(page);
  }
  await openLogin(page);
  await page.fill('#a-email', 'still@works.com');
  assert.equal(await page.inputValue('#a-email'), 'still@works.com');
  await page.context().close();
});

test('checkout: log in when placing the order, then the order goes through', async () => {
  const page = await newPage();
  await page.addInitScript(BASKET);
  await page.goto(BASE + '/checkout/smash-society');
  await page.waitForSelector('#place-btn');
  await page.click('#place-btn');
  await page.waitForSelector('#a-email');
  assert.match(await text(page, '.modal-head p'), /Log in to place your order/);
  await logInWithForm(page);
  await page.waitForSelector('#place-btn');
  assert.match(page.url(), /\/checkout\/smash-society/, 'still on checkout after logging in');
  await page.click('#place-btn');
  await page.waitForURL(/\/order\//);
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('after an order: log out from the account page, the tracking link asks you to log in', async () => {
  const page = await newPage();
  const acct = await signUp(page);
  await page.addInitScript(BASKET);
  await page.goto(BASE + '/checkout/smash-society');
  await page.waitForSelector('#place-btn');
  await page.click('[data-act="add-addr"]');
  await page.fill('#f-street', '1 Test Street');
  await page.fill('#f-city', 'Old Town');
  await page.click('#addr-save');
  await page.waitForSelector('input[name="co-addr"]');
  await page.click('#place-btn');
  await page.waitForURL(/\/order\//);
  const orderUrl = page.url();
  await logOutFromAccount(page);
  await page.goto(orderUrl);
  await page.waitForSelector('text=Log in to see this order');
  await page.click('[data-act="login"]');
  await page.fill('#a-email', acct.email);
  await page.fill('#a-pass', acct.password);
  await page.click('#auth-submit');
  await page.waitForSelector('#tr-title');
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('a page refresh keeps you logged in, and logged out after logging out', async () => {
  const page = await newPage();
  await loginAs(page, 'customer', '/');
  await page.waitForSelector('#acct-btn .avatar');
  await page.reload();
  await page.waitForSelector('#acct-btn .avatar');
  await logOutFromAccount(page);
  await page.reload();
  await page.waitForSelector('#results .card');
  assert.equal(await page.locator('#acct-btn .avatar').count(), 0);
  for (const role of ['partner', 'courier', 'admin']) {
    await loginAs(page, role, '/' + role);
    await page.waitForSelector('#logout');
    await page.reload();
    await page.waitForSelector('#logout');
    await page.click('#logout');
    await page.waitForSelector('#l-email');
    await page.reload();
    await page.waitForSelector('#l-email');
  }
  await page.context().close();
});

test('a session that ends elsewhere brings back a working login window', async () => {
  const page = await newPage();
  const acct = await signUp(page);
  await page.goto(BASE + '/account');
  await page.waitForSelector('.acct-head');
  /* Another device changes the password: this session's cookie stops working. */
  const other = await (await newPage()).context().request;
  await other.post(BASE + '/api/auth/login', { data: { email: acct.email, password: acct.password } });
  await other.post(BASE + '/api/auth/password', { data: { current: acct.password, password: 'brand-new-pass-9' } });
  await page.click('[data-tab="addresses"]');
  await page.click('[data-act="add-addr"]').catch(() => {});
  await page.goto(BASE + '/account');
  await page.waitForFunction(() => !document.querySelector('#acct-btn .avatar'));
  await openLogin(page);
  await typeSlowly(page, '#a-email', acct.email, 60);
  await page.fill('#a-pass', 'brand-new-pass-9');
  await page.click('#auth-submit');
  await page.waitForSelector('#acct-btn .avatar');
  await page.context().close();
});

test('logging out works from every staff section', async () => {
  const page = await newPage();
  for (const section of ['overview', 'orders', 'restaurants', 'menus', 'users', 'reviews', 'promos', 'settings']) {
    await loginAs(page, 'admin', '/admin#' + section);
    await page.waitForSelector('#logout');
    await page.waitForTimeout(300);
    await page.click('#logout');
    await page.waitForSelector('#l-email');
    assert.equal(await page.locator('#side').isVisible(), false, `${section}: the admin menu is hidden after logging out`);
  }
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('every customer page shows the logged-out state cleanly after logging out', async () => {
  const page = await newPage();
  await loginAs(page, 'customer', '/');
  await page.waitForSelector('#acct-btn .avatar');
  await logOutFromAccount(page);
  for (const path of ['/', '/r/smash-society', '/checkout', '/account', '/order/000000000000000000000000', '/credits', '/help', '/about', '/#r-smash-society']) {
    await page.goto(BASE + path);
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('#acct-btn .avatar').count(), 0, path);
  }
  assert.deepEqual(page.problems, []);
  await page.context().close();
});
