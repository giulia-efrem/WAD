'use strict';

/* npm run screenshots [-- --out=screenshots --views=home,restaurant --widths=375,1440 --themes=light,dark]
   Screenshots the main views at phone, tablet and desktop widths in light and dark mode, using
   the Microsoft Edge (or Chrome) already installed, so Playwright doesn't download a browser.

   Needs the server running (npm run dev) and the seed loaded. It logs in as the demo account,
   places one order for the tracking view (deleted afterwards) and, for /admin/photos, creates a
   temporary admin user that is removed again at the end. */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { chromium } = require('playwright');
const config = require('../server/config');
const db = require('../server/db');
const User = require('../server/models/User');
const Order = require('../server/models/Order');

const BASE = process.env.BASE_URL || `http://localhost:${config.port}`;
const arg = (name, fallback) => { const a = process.argv.find(x => x.startsWith(`--${name}=`)); return a ? a.split('=')[1] : fallback; };
const OUT = path.resolve(config.root, arg('out', 'screenshots'));
const WIDTHS = arg('widths', '375,768,1440').split(',').map(Number);
const THEMES = arg('themes', 'light,dark').split(',');
const VIEWS = arg('views', 'home,restaurant,dish,basket,checkout,order,account,admin-photos,credits').split(',');
const HEIGHT = { 375: 812, 768: 1024, 1440: 900 };
const MAX_PAGE = 3600;
const TEMP_ADMIN = 'screenshots-admin@morsel.invalid';

async function api(method, url, { cookie, body } = {}) {
  const res = await fetch(BASE + '/api' + url, {
    method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${JSON.stringify(data)}`);
  return { data, setCookie: res.headers.get('set-cookie') };
}
const cookieValue = setCookie => /morsel_session=([^;]+)/.exec(setCookie || '')[1];

async function setup() {
  await db.connect();
  /* Demo session, one live order and a bag to show. */
  const login = await api('POST', '/auth/login', { body: { email: 'demo@morsel.app', password: 'morsel-demo-2026' } });
  const demoToken = cookieValue(login.setCookie);
  const cookie = `morsel_session=${demoToken}`;
  const me = login.data.user;
  const menu = (await api('GET', '/restaurants/smash-society')).data.restaurant;
  const item = slug => menu.menu.flatMap(s => s.items).find(i => i.slug === slug);
  const classic = item('classic'), fries = item('fries');
  const order = (await api('POST', '/orders', { cookie, body: {
    restaurantSlug: 'smash-society', addressId: me.addresses[0]._id, payment: 'card', delivery: { type: 'asap' }, tip: 100,
    items: [{ itemSlug: 'classic', qty: 2, options: { sauce: 'bbq', burgerExtras: ['bacon'] } }, { itemSlug: 'fries', qty: 1, options: { fries: 'truffle' } }]
  } })).data.order;
  /* Move it to “on the way” so the map and courier show. */
  await Order.updateOne({ _id: order._id }, { $set: { startAt: new Date(Date.now() - (order.etaMin - 6) * config.simMinuteMs) } });
  /* One basket at Smash Society (shown) and one at Forno Sette (so "Your baskets" appears). */
  const cart = {
    promo: null,
    baskets: {
      'smash-society': { updatedAt: Date.now(), lines: [
        { key: 'classic|burgerExtras:bacon+sauce:bbq|pickles|', itemSlug: 'classic', name: classic.name, unitPrice: classic.price + 180, qty: 2, options: [{ group: 'Sauce', choice: 'Smoky BBQ', price: 0 }, { group: 'Add to your burger', choice: 'Crispy bacon', price: 180 }], removed: [{ id: 'pickles', name: 'Pickles' }], sel: { sauce: 'bbq', burgerExtras: ['bacon'] }, remove: ['pickles'], note: '' },
        { key: 'fries|fries:truffle||', itemSlug: 'fries', name: fries.name, unitPrice: fries.price + 150, qty: 1, options: [{ group: 'Style', choice: 'Truffle and parmesan', price: 150 }], removed: [], sel: { fries: 'truffle' }, remove: [], note: '' }
      ] },
      'forno-sette': { updatedAt: Date.now() - 60000, lines: [
        { key: 'margherita|size:40||', itemSlug: 'margherita', name: 'Margherita', unitPrice: 1350, qty: 1, options: [{ group: 'Size', choice: '40 cm', price: 400 }], removed: [], sel: { size: '40', pizzaExtras: [] }, remove: [], note: '' }
      ] }
    }
  };
  /* Temporary admin, signed in with a token, so ADMIN_EMAIL is never touched. */
  await User.deleteMany({ email: TEMP_ADMIN });
  const admin = await User.create({ name: 'Screenshot Admin', email: TEMP_ADMIN, role: 'admin', passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 4) });
  const adminToken = jwt.sign({ sub: String(admin._id) }, config.jwtSecret, { expiresIn: '1h', algorithm: 'HS256' });
  return { demoToken, adminToken, orderId: order._id, etaMin: order.etaMin, cart };
}

async function teardown(ctx) {
  try {
    if (ctx && ctx.orderId) await Order.deleteOne({ _id: ctx.orderId });
    await User.deleteMany({ email: TEMP_ADMIN });
  } finally { await db.disconnect(); }
}

/* Lets lazy images load and waits until every photo has finished (or failed). */
async function settle(page) {
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; }));
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function shoot(page, file, full) {
  if (full) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    const vp = page.viewportSize();
    await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y: 0, width: vp.width, height: Math.min(h, MAX_PAGE) } });
  } else await page.screenshot({ path: file });
}

const VIEW_STEPS = {
  async home(page) { await page.goto(BASE + '/'); await page.waitForSelector('.card'); return true; },
  async restaurant(page) { await page.goto(BASE + '/#r-forno-sette'); await page.waitForSelector('.item'); return true; },
  async dish(page) {
    await page.goto(BASE + '/#r-forno-sette'); await page.waitForSelector('.item[data-i="margherita"]');
    await page.click('.item[data-i="margherita"]'); await page.waitForSelector('#item-add'); return false;
  },
  /* Desktop: the order panel next to the menu. Phones and tablets: the order opened as a sheet. */
  async basket(page) {
    await page.goto(BASE + '/#r-smash-society'); await page.waitForSelector('.item');
    if (page.viewportSize().width < 1100) { await page.click('#orderbar'); await page.waitForSelector('#sheet-order .oline'); }
    else { await page.waitForSelector('#order-panel .oline'); }
    return false;
  },
  async checkout(page) { await page.goto(BASE + '/#checkout-smash-society'); await page.waitForSelector('#place-btn'); return true; },
  async order(page, ctx) {
    /* Put the order back to “on the way” for every shot, since demo time keeps running. */
    await Order.updateOne({ _id: ctx.orderId }, { $set: { startAt: new Date(Date.now() - (ctx.etaMin - 6) * config.simMinuteMs) } });
    await page.goto(`${BASE}/#order-${ctx.orderId}`); await page.waitForSelector('#tr-title:not(:empty)'); await page.waitForTimeout(800); return true; },
  async account(page) { await page.goto(BASE + '/#account'); await page.waitForSelector('.order-row'); return true; },
  async 'admin-photos'(page) { await page.goto(BASE + '/admin/photos'); await page.waitForSelector('.rv'); return true; },
  async credits(page) { await page.goto(BASE + '/credits'); await page.waitForSelector('.credit-list, .credit-group, #credits-list p'); return true; }
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let ctx;
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
  const problems = [];
  try {
    ctx = await setup();
    for (const theme of THEMES) for (const width of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height: HEIGHT[width] || 900 }, colorScheme: theme, reducedMotion: 'reduce', deviceScaleFactor: 1 });
      for (const view of VIEWS) {
        const admin = view === 'admin-photos';
        await context.clearCookies();
        await context.addCookies([{ name: 'morsel_session', value: admin ? ctx.adminToken : ctx.demoToken, url: BASE, httpOnly: true, sameSite: 'Lax' }]);
        const page = await context.newPage();
        page.on('pageerror', e => problems.push(`${view} ${width} ${theme}: ${e.message}`));
        page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`${view} ${width} ${theme}: ${m.text()}`); });
        await page.addInitScript(cart => { try { localStorage.setItem('morsel.baskets', JSON.stringify(cart)); localStorage.setItem('morsel.promoDismissed', 'false'); } catch (e) { /* ignore */ } }, ctx.cart);
        try {
          const full = await VIEW_STEPS[view](page, ctx);
          await settle(page);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          if (overflow > 0) problems.push(`${view} ${width} ${theme}: page is ${overflow}px wider than the screen`);
          await shoot(page, path.join(OUT, `${view}-${width}-${theme}.png`), full);
          process.stdout.write('.');
        } catch (err) {
          problems.push(`${view} ${width} ${theme}: ${err.message.split('\n')[0]}`);
          process.stdout.write('x');
        }
        await page.close();
      }
      await context.close();
    }
  } catch (err) {
    console.error(`
Screenshots stopped: ${err.message}
Is the server running (npm run dev) and the seed loaded (npm run seed)?`);
    process.exitCode = 1;
  } finally {
    await browser.close();
    await teardown(ctx);
  }
  console.log(`\nSaved to ${OUT}`);
  if (problems.length) { console.log('Problems:'); problems.forEach(p => console.log('  - ' + p)); process.exitCode = 1; }
})();
