'use strict';

/* Visits every page for every role at phone and desktop width, then clicks every visible
   button, link and tab on it, one after another. It fails on any browser error, any server
   error (5xx), a page wider than the screen, or "undefined", "NaN" or "[object Object]" shown
   as text. Runs last, on the test database, because clicking everything changes data. */

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { BASE, newPage, loginAs, closeBrowser } = require('../e2e/helpers');

after(closeBrowser);

/* Buttons that would end the session or remove the things the next clicks rely on. */
const SKIP_ACTS = new Set(['logout', 'disable', 'role', 'del-addr', 'del-row', 'del-block', 'photo-remove', 'pause-rest', 'pause', 'autopilot', 'reject', 'reload', 'switch']);
const SKIP_IDS = new Set(['logout', 'switch']);
const MAX_CLICKS = 60;

async function pageIssues(page) {
  return page.evaluate(() => {
    const out = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push(`page is ${document.documentElement.scrollWidth}px wide on a ${window.innerWidth}px screen`);
    const body = document.body.innerText;
    for (const bad of ['undefined', 'NaN', '[object Object]', 'null null']) if (new RegExp(`(^|[^a-z])${bad.replace(/[[\]]/g, '\\$&')}([^a-z]|$)`).test(body)) out.push(`shows “${bad}”`);
    return out;
  });
}

/* Everything clickable that's visible, in page order, outside open windows. */
const candidates = page => page.evaluate(({ skipActs, skipIds }) => {
  const els = [...document.querySelectorAll('button, a[href], [role="tab"], summary')].filter(el => {
    if (el.closest('.modal-wrap, #modal-root, .toast')) return false;
    if (el.disabled || el.closest('[inert]')) return false;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return false;
    if (skipActs.includes(el.dataset.act) || skipIds.includes(el.id) || el.matches('[data-remove], [data-choose]')) return false;
    if (el.tagName === 'A') { const u = new URL(el.href, location.href); if (u.origin !== location.origin || el.target === '_blank' || u.pathname.startsWith('/api')) return false; }
    return true;
  });
  return els.map(el => (el.dataset.act ? `[${el.dataset.act}${el.dataset.id ? ' ' + el.dataset.id : ''}] ` : '') + (el.getAttribute('aria-label') || el.textContent || el.getAttribute('href') || '').replace(/\s+/g, ' ').trim().slice(0, 50));
}, { skipActs: [...SKIP_ACTS], skipIds: [...SKIP_IDS] });

async function clickNth(page, n) {
  return page.evaluate(({ n, skipActs, skipIds }) => {
    const els = [...document.querySelectorAll('button, a[href], [role="tab"], summary')].filter(el => {
      if (el.closest('.modal-wrap, #modal-root, .toast')) return false;
      if (el.disabled || el.closest('[inert]')) return false;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return false;
      if (skipActs.includes(el.dataset.act) || skipIds.includes(el.id) || el.matches('[data-remove], [data-choose]')) return false;
      if (el.tagName === 'A') { const u = new URL(el.href, location.href); if (u.origin !== location.origin || el.target === '_blank' || u.pathname.startsWith('/api')) return false; }
      return true;
    });
    const el = els[n];
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  }, { n, skipActs: [...SKIP_ACTS], skipIds: [...SKIP_IDS] });
}

/* Loads `path` and checks it. With click: true it then clicks each candidate in turn: an open
   window is closed with Escape, and the page is loaded again only when a click went somewhere else. */
async function sweep(page, path, found, { click = true } = {}) {
  const load = async () => {
    await page.goto('about:blank');
    await page.goto(BASE + path);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(250);
  };
  await load();
  for (const issue of await pageIssues(page)) found.push(`${path}: ${issue}`);
  if (!click) return 0;
  const labels = (await candidates(page)).slice(0, MAX_CLICKS);
  const there = new URL(BASE + path);
  for (let i = 0; i < labels.length; i++) {
    const before = page.problems.length;
    const ok = await clickNth(page, i);
    if (!ok) continue;
    await page.waitForTimeout(220);
    for (const issue of await pageIssues(page)) found.push(`${path} → ${labels[i]}: ${issue}`);
    if (page.problems.length > before) found.push(...page.problems.slice(before).map(p => `${path} → ${labels[i]}: ${p}`));
    for (let k = 0; k < 3 && await page.locator('.modal-wrap').count(); k++) { await page.keyboard.press('Escape'); await page.waitForTimeout(80); }
    const moved = new URL(page.url());
    const away = moved.pathname !== there.pathname || moved.hash !== there.hash || (moved.search !== there.search && !moved.searchParams.has('dish'));
    if (away || await page.locator('.modal-wrap').count()) await load();
  }
  return labels.length;
}

const CUSTOMER_PAGES = ['/', '/r/forno-sette', '/r/smash-society', '/r/bao-and-broth', '/r/kaze-sushi', '/r/green-theory', '/r/taqueria-luna', '/r/sweet-spot', '/r/morning-club', '/r/spice-route',
  '/search?q=pizza', '/search?q=vegan', '/search?q=xyzzy', '/search', '/checkout/smash-society', '/account', '/credits', '/about', '/help', '/terms', '/privacy', '/no-such-page'];
/* Every page is loaded and checked; these are also clicked through. The other restaurant pages
   are built from the same code as these two. */
const FULL = new Set(['/', '/r/forno-sette', '/r/smash-society', '/search?q=vegan', '/search?q=xyzzy', '/search', '/checkout/smash-society', '/account', '/help', '/no-such-page']);
const BASKET = () => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem('morsel.baskets', JSON.stringify({ promo: null, baskets: { 'smash-society': { updatedAt: Date.now(), lines: [
    { key: 'fries|fries:classic||', itemSlug: 'fries', name: 'Fries', unitPrice: 350, qty: 1, options: [{ group: 'Style', choice: 'Classic', price: 0 }], removed: [], sel: { fries: 'classic' }, remove: [], note: '' }] } } }));
};

for (const width of [1440, 375]) {
  test(`guest: every page and button at ${width}px`, { timeout: 15 * 60e3 }, async () => {
    const page = await newPage({ width });
    await page.addInitScript(BASKET);
    const found = [];
    let clicks = 0;
    for (const p of CUSTOMER_PAGES) clicks += await sweep(page, p, found, { click: FULL.has(p) });
    assert.ok(clicks > 100, `clicked ${clicks} things`);
    assert.deepEqual(found, []);
    await page.context().close();
  });

  test(`customer: every page and button at ${width}px`, { timeout: 15 * 60e3 }, async () => {
    const page = await newPage({ width });
    await page.addInitScript(BASKET);
    await loginAs(page, 'customer');
    const orders = await (await page.request.get(BASE + '/api/orders/mine')).json();
    const found = [];
    const pages = [...CUSTOMER_PAGES, `/order/${orders.orders[0]._id}`, `/order/${orders.orders[orders.orders.length - 1]._id}`];
    for (const p of pages) await sweep(page, p, found, { click: FULL.has(p) || p.startsWith('/order/') });
    assert.deepEqual(found, []);
    await page.context().close();
  });

  test(`staff: partner, courier and admin pages at ${width}px`, { timeout: 15 * 60e3 }, async () => {
    const found = [];
    for (const [role, paths] of [['partner', ['/partner']], ['courier', ['/courier']],
      ['admin', ['/admin', '/admin#orders', '/admin#restaurants', '/admin#menus', '/admin#menus/forno-sette', '/admin#users', '/admin#reviews', '/admin#promos', '/admin#settings', '/admin/photos']]]) {
      const page = await newPage({ width });
      await loginAs(page, role);
      for (const p of paths) await sweep(page, p, found);
      await page.context().close();
    }
    assert.deepEqual(found, []);
  });
}
