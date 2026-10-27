'use strict';

/* Search, home filters, favourites, addresses, promo codes and reorder, as a customer would use them. */

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { BASE, newPage, loginAs, signUp, text, closeBrowser } = require('./helpers');

after(closeBrowser);

const visibleNames = page => page.$$eval('#results .card h3', els => els.map(e => e.textContent));

test('search: instant suggestions tolerate typos and accents, and work with the keyboard', async () => {
  const page = await newPage();
  await page.goto(BASE + '/');
  await page.waitForSelector('#results .card');
  await page.click('#q');
  await page.keyboard.type('chesecake');
  await page.waitForSelector('#q-suggest:not([hidden])');
  const opts = await page.$$eval('#q-suggest .suggest-opt', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  assert.ok(opts.some(o => o.startsWith('Pistachio cheesecake')), 'a typo still finds the dish');
  assert.equal(await page.getAttribute('#q', 'aria-expanded'), 'true');
  /* Down to the first dish (after the restaurants), then Enter opens it in its restaurant. */
  const firstDish = opts.findIndex(o => o.startsWith('Pistachio cheesecake'));
  for (let i = 0; i <= firstDish; i++) await page.keyboard.press('ArrowDown');
  assert.match(await page.evaluate(() => document.getElementById(document.querySelector('#q').getAttribute('aria-activedescendant')).textContent), /Pistachio cheesecake/);
  await page.keyboard.press('Enter');
  await page.waitForSelector('#item-title');
  assert.equal(await text(page, '#item-title'), 'Pistachio cheesecake');
  assert.match(page.url(), /\/r\/sweet-spot\?dish=pistachio$/);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !location.search);

  for (const [q, expect] of [['TAQUERIA', 'Taquería Luna'], ['ramne', 'Bao & Broth'], ['margerita', 'Margherita'], ['gf', 'Gluten-free'], ['veggie', 'Vegetarian']]) {
    await page.goto(BASE + '/search?q=' + encodeURIComponent(q));
    await page.waitForSelector('.res-h');
    assert.ok((await text(page, '#search-results')).includes(expect), `“${q}” finds ${expect}`);
  }
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('search: results view, filters, a dish result opens its dish, and a friendly empty state', async () => {
  const page = await newPage({ width: 375 });
  await page.goto(BASE + '/');
  await page.waitForSelector('#q');
  await page.fill('#q', 'tacos');
  await page.press('#q', 'Enter');
  await page.waitForSelector('.res-h');
  assert.match(page.url(), /\/search\?q=tacos$/);
  assert.ok(await page.locator('.dish-row').count() >= 3);
  await page.click('[data-act="diet"][data-diet="vegan"]');
  const vegan = await page.$$eval('.dish-row strong', els => els.map(e => e.textContent));
  assert.ok(vegan.length >= 1 && vegan.length < 7, 'the vegan filter narrows the dishes');
  await page.click('.dish-row');
  await page.waitForSelector('#item-title');
  assert.match(page.url(), /\/r\/taqueria-luna\?dish=/);
  await page.goBack();
  await page.waitForSelector('.res-h');
  await page.goto(BASE + '/search?q=xyzzy');
  await page.waitForSelector('.empty');
  assert.match(await text(page, '.empty h2'), /No results for “xyzzy”/);
  await page.click('[data-act="search-for"][data-q="Ramen"]');
  await page.waitForSelector('.res-h');
  assert.match(page.url(), /q=Ramen/);
  await page.goto(BASE + '/search');
  await page.waitForSelector('.search-start');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'sq', 'the empty search page puts you in the field');
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('menu search inside a restaurant', async () => {
  const page = await newPage();
  await page.goto(BASE + '/r/forno-sette');
  await page.waitForSelector('#menu-q');
  await page.fill('#menu-q', 'diavla');
  const shown = await page.$$eval('.menu-sec:not([hidden]) .item:not([hidden]) .item-name', els => els.map(e => e.firstChild.textContent));
  assert.deepEqual(shown, ['Diavola']);
  assert.equal(await page.locator('#menu-tabs button:not([hidden])').count(), 1, 'only the matching section keeps its tab');
  await page.fill('#menu-q', 'nothing like this');
  assert.ok(await page.isVisible('#menu-empty .empty'));
  await page.click('#menu-empty [data-act="clear-menu-q"]');
  assert.ok(await page.locator('.menu-sec:not([hidden]) .item').count() > 20, 'the whole menu is back');
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('home filters and sorting, including dietary filters', async () => {
  const page = await newPage();
  await page.goto(BASE + '/');
  await page.waitForSelector('#results .card');
  const all = await visibleNames(page);
  assert.equal(all.length, 9);
  await page.click('.cat[data-id="pizza"]');
  assert.deepEqual(await visibleNames(page), ['Forno Sette']);
  await page.click('.cat[data-id="all"]');
  await page.click('[data-act="filter"][data-f="freeDel"]');
  assert.deepEqual((await visibleNames(page)).sort(), ['Smash Society', 'The Sweet Spot']);
  await page.click('[data-act="filter"][data-f="freeDel"]');
  await page.click('[data-act="filter"][data-f="topRated"]');
  assert.ok((await page.$$eval('#results .rating-chip', els => els.map(e => parseFloat(e.textContent)))).every(v => v >= 4.8));
  await page.click('[data-act="filter"][data-f="topRated"]');
  await page.selectOption('#sort', 'fastest');
  const etas = await page.$$eval('#results .card:not(.is-closed) .card-facts span:first-child', els => els.map(e => parseInt(e.textContent)));
  assert.deepEqual(etas, [...etas].sort((a, b) => a - b), 'open restaurants are listed fastest first');
  await page.selectOption('#sort', 'recommended');
  await page.click('#results-wrap [data-act="diet"][data-diet="vegan"], .toolbar [data-act="diet"][data-diet="vegan"]');
  const notes = await page.$$eval('#results .match', els => els.map(e => e.textContent));
  assert.ok(notes.length > 0 && notes.every(n => /\d+ vegan dish/.test(n)), 'cards say how many vegan dishes');
  await page.click('.toolbar [data-act="diet"][data-diet="gluten-free"]');
  assert.ok((await page.$$eval('#results .match', els => els.map(e => e.textContent))).every(n => /vegan, gluten-free/.test(n)));
  assert.equal(await page.locator('.row-sec').count(), 0, 'the rows step aside while filtering');
  await page.click('.toolbar [data-act="diet"][data-diet="vegan"]');
  await page.click('.toolbar [data-act="diet"][data-diet="gluten-free"]');
  assert.equal(await page.locator('.row-sec').count(), 4);
  await page.click('.row-sec [data-act="see-all"] >> nth=2');
  await page.waitForTimeout(400);
  assert.equal(await page.getAttribute('[data-act="filter"][data-f="freeDel"]', 'aria-pressed'), 'true', '"See all" on Free delivery turns that filter on');
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('favourites: logged out asks to log in; logged in saves and lists them', async () => {
  const page = await newPage();
  await page.goto(BASE + '/');
  await page.waitForSelector('#results .card');
  await page.click('#results .card .fav >> nth=0');
  await page.waitForSelector('#a-email');
  assert.match(await text(page, '.modal-head p'), /favourite/);
  await page.keyboard.press('Escape');
  await signUp(page);
  await page.reload();
  await page.waitForSelector('#results .card');
  const name = (await page.$$eval('#results .card h3', els => els.map(e => e.textContent)))[0];
  await page.click('#results .card .fav >> nth=0');
  await page.waitForFunction(() => document.querySelector('#results .card .fav').getAttribute('aria-pressed') === 'true');
  await page.goto(BASE + '/account');
  await page.click('[data-tab="favorites"]');
  await page.waitForSelector('#acct-panel .card');
  assert.deepEqual(await page.$$eval('#acct-panel .card h3', els => els.map(e => e.textContent)), [name]);
  await page.click('#acct-panel .card .fav');
  await page.waitForSelector('#acct-panel .empty');
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('addresses: add, make default, choose in the header, delete', async () => {
  const page = await newPage();
  await signUp(page);
  await page.goto(BASE + '/account');
  await page.click('[data-tab="addresses"]');
  for (const [street, city] of [['1 First Street', 'Old Town'], ['2 Second Street', 'Riverside']]) {
    await page.click('[data-act="add-addr"]');
    await page.fill('#f-street', street);
    await page.fill('#f-city', city);
    await page.click('#addr-save');
    await page.waitForSelector(`.addr-row:has-text("${street}")`);
  }
  assert.match(await text(page, '.addr-row:has-text("1 First Street")'), /Default/);
  await page.click('.addr-row:has-text("2 Second Street") [data-act="default-addr"]');
  await page.waitForSelector('.addr-row:has-text("2 Second Street") .default-tag');
  assert.match(await text(page, '#addr-label'), /2 Second Street|Home|Second/);
  await page.click('.addr-row:has-text("1 First Street") [data-act="del-addr"]');
  const confirm = page.locator('[data-cf="1"]');
  if (await confirm.count()) await confirm.click();
  await page.waitForFunction(() => !document.body.textContent.includes('1 First Street'));
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('promo codes at checkout: a wrong code explains why, WELCOME20 applies and can be removed', async () => {
  const page = await newPage();
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('morsel.baskets', JSON.stringify({ promo: null, baskets: { 'smash-society': { updatedAt: Date.now(), lines: [
      { key: 'classic|sauce:bbq||', itemSlug: 'classic', name: 'Classic smash', unitPrice: 990, qty: 2, options: [{ group: 'Sauce', choice: 'Smoky BBQ', price: 0 }], removed: [], sel: { sauce: 'bbq', burgerExtras: [] }, remove: [], note: '' }] } } }));
  });
  await signUp(page);
  await page.goto(BASE + '/checkout/smash-society');
  await page.waitForSelector('#place-btn');
  const before = await text(page, '#place-btn');
  await page.fill('#promo', 'NOPE123');
  await page.click('[data-act="apply-promo"]');
  await page.waitForFunction(() => document.querySelector('#promo-err') && document.querySelector('#promo-err').textContent.length > 3);
  await page.fill('#promo', 'welcome20');
  await page.click('[data-act="apply-promo"]');
  await page.waitForSelector('.applied:has-text("WELCOME20")');
  assert.notEqual(await text(page, '#place-btn'), before, 'the total goes down');
  await page.click('[data-act="remove-promo"]');
  await page.waitForSelector('#promo');
  assert.equal(await text(page, '#place-btn'), before);
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('reorder from the account page fills the basket again', async () => {
  const page = await newPage();
  await loginAs(page, 'customer', '/orders');
  await page.waitForSelector('.order-row');
  const reorder = page.locator('.order-row [data-act="reorder"]').first();
  await reorder.click();
  await page.waitForURL(/\/r\//);
  await page.waitForSelector('#toast.show');
  assert.match(await text(page, '#toast'), /Added|aren’t on the menu/);
  assert.deepEqual(page.problems, []);
  await page.context().close();
});
