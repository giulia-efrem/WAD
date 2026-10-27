'use strict';

/* Logging out: from the account menu in the header, for every role, after logging in with the demo
   buttons, at phone and desktop width, with the keyboard, and from the staff pages. Afterwards the
   login cookie is gone, the server sees nobody, the page shows nobody, and you're on the home page. */

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { BASE, ACCOUNTS, newPage, closeBrowser, text } = require('./helpers');

after(closeBrowser);

const sessionCookie = async page => (await page.context().cookies()).find(c => c.name === 'morsel_session');
const serverUser = async page => (await (await page.request.get(BASE + '/api/auth/me')).json()).user;

/* Logs in on the main site with a demo button. Staff land on their own page; this brings them back. */
async function demoLogin(page, role) {
  await page.goto(BASE + '/');
  await page.click('#acct-btn');
  await page.waitForSelector(`[data-demo-role="${role}"]`);
  await page.click(`[data-demo-role="${role}"]`);
  if (role !== 'customer') { await page.waitForURL(u => u.pathname === '/' + role); await page.goto(BASE + '/'); }
  await page.waitForSelector('#acct-btn .avatar');
}

async function assertLoggedOut(page, label) {
  await page.waitForFunction(() => !document.querySelector('#acct-btn .avatar'));
  assert.equal(new URL(page.url()).pathname, '/', `${label}: back on the home page`);
  assert.equal(await sessionCookie(page), undefined, `${label}: the login cookie is gone`);
  assert.equal(await serverUser(page), null, `${label}: the server sees nobody`);
  assert.equal(await page.getAttribute('#acct-btn', 'aria-label'), 'Log in or sign up', `${label}: the header offers Log in`);
  assert.equal(await page.locator('#acct-pop').isVisible(), false, `${label}: the menu is closed`);
  assert.match(await text(page, '#toast'), /logged out/);
}

for (const width of [1440, 375]) {
  for (const role of ['customer', 'partner', 'courier', 'admin']) {
    test(`${role}, ${width}px: log in with the demo button, then Log out from the account menu`, async () => {
      const page = await newPage({ width });
      await demoLogin(page, role);
      assert.ok(await sessionCookie(page), 'logged in: there is a login cookie');
      await page.click('#acct-btn');
      await page.waitForSelector('#acct-pop:not([hidden])');
      assert.equal(await page.getAttribute('#acct-btn', 'aria-expanded'), 'true');
      /* The menu names who is logged in (the partner button picks the default demo restaurant). */
      const who = role === 'partner' ? /partner\.[a-z-]+@morsel\.app/ : new RegExp(ACCOUNTS[role][0].replace(/\./g, '\\.'));
      assert.match(await text(page, '#acct-pop .menu-who'), who);
      assert.ok(await page.locator('#menu-logout').isVisible(), 'Log out is in the menu, in view');
      await page.click('#menu-logout');
      await assertLoggedOut(page, role);
      /* Nothing of the account is left on screen or in the page's state. */
      await page.goto(BASE + '/orders');
      await page.waitForSelector('text=Log in to see your orders');
      assert.deepEqual(page.problems, []);
      await page.context().close();
    });
  }
}

test('logging out from deep inside the app (a restaurant, an order, the account page) goes home', async () => {
  const page = await newPage();
  await demoLogin(page, 'customer');
  const orders = (await (await page.request.get(BASE + '/api/orders/mine')).json()).orders;
  for (const path of ['/r/forno-sette', `/order/${orders[0]._id}`, '/account', '/search?q=pizza', '/help']) {
    await page.goto(BASE + path);
    await page.waitForSelector('#acct-btn .avatar');
    await page.click('#acct-btn');
    await page.click('#menu-logout');
    await assertLoggedOut(page, path);
    await page.request.post(BASE + '/api/auth/demo', { data: { role: 'customer' } });
  }
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('the account menu works with the keyboard, and Escape closes it', async () => {
  const page = await newPage();
  await demoLogin(page, 'customer');
  await page.focus('#acct-btn');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#acct-pop:not([hidden])');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#acct-pop').isVisible(), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'acct-btn', 'focus returns to the button');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#acct-pop:not([hidden])');
  await page.keyboard.press('End');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'menu-logout');
  await page.keyboard.press('Enter');
  await assertLoggedOut(page, 'keyboard');
  await page.context().close();
});

test('the Log out button on the account page still works', async () => {
  const page = await newPage({ width: 375 });
  await demoLogin(page, 'customer');
  await page.goto(BASE + '/account');
  await page.click('#acct-panel [data-act="logout"]');
  await assertLoggedOut(page, 'account page');
  await page.context().close();
});

test('if the server can’t be reached, you stay logged in and are told so', async () => {
  const page = await newPage();
  await demoLogin(page, 'customer');
  await page.route('**/api/auth/logout', r => r.abort());
  await page.click('#acct-btn');
  await page.click('#menu-logout');
  await page.waitForSelector('#toast.show');
  assert.match(await text(page, '#toast'), /couldn’t log you out/);
  assert.ok(await page.locator('#acct-btn .avatar').count(), 'still shown as logged in, because the cookie still works');
  await page.unroute('**/api/auth/logout');
  await page.click('#acct-btn');
  await page.click('#menu-logout');
  await assertLoggedOut(page, 'after retrying');
  await page.context().close();
});

for (const role of ['partner', 'courier', 'admin']) {
  test(`${role} page: Log out in the header clears the cookie and shows the login form`, async () => {
    const page = await newPage();
    await page.goto(BASE + '/' + role);
    await page.waitForSelector('#demo-login');
    await page.click('#demo-login');
    await page.waitForSelector('#logout');
    await page.click('#logout');
    await page.waitForSelector('#l-email');
    assert.equal(await sessionCookie(page), undefined);
    assert.equal(await serverUser(page), null);
    assert.deepEqual(page.problems, []);
    await page.context().close();
  });
}
