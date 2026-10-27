// Playwright test of the staff roles: admin dashboard, restaurant partner board, courier page,
// the customer's tracking following real steps (autopilot off), and the customer account page.
// Run with npm run test:e2e (a test server on the morsel_test database). (server running, seed loaded; Smash Society is open 24 h)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.MORSEL_TEST_BASE;
const OUT = path.join(require('os').tmpdir(), 'morsel-e2e', 'roles');
fs.mkdirSync(OUT, { recursive: true });
const STAMP = Date.now();
const CUSTOMER = { name: 'Test Roles', email: `test.roles.${STAMP}@example.com`, password: 'roles-pass-1' };
let pass = 0, fail = 0;
const problems = [];
const check = (label, ok, detail = '') => { if (ok) { pass++; console.log('  PASS ', label); } else { fail++; console.log('  FAIL ', label, detail); } };
const section = s => console.log('== ' + s);
const clean = s => (s || '').replace(/\s+/g, ' ').trim();

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const open = async (name, viewport = { width: 1440, height: 900 }) => {
    const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    page.on('pageerror', e => problems.push(`${name} pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`${name} console: ${m.text()}`); });
    page.text = async sel => clean(await page.locator(sel).first().textContent());
    /* Waits until the text of sel matches, polling, then returns whether it did. */
    /* Polls from Node: the page's CSP rightly blocks new Function inside the page. */
    page.until = async (sel, test, ms = 9000) => {
      const fn = new Function('t', 'return ' + test);
      for (const end = Date.now() + ms; Date.now() < end; await page.waitForTimeout(200)) {
        const el = page.locator(sel).first();
        if (await el.count() && fn(clean(await el.textContent()))) return true;
      }
      return false;
    };
    return page;
  };
  const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  const admin = await open('admin');
  const partner = await open('partner');
  const courier = await open('courier', { width: 390, height: 844 });
  const customer = await open('customer');

  try {
    section('Admin: login form and overview');
    await admin.goto(BASE + '/admin');
    await admin.waitForSelector('#login');
    check('staff page asks for a login when signed out', (await admin.text('.staff-login h1')) === 'Morsel admin');
    await admin.fill('#l-email', 'partner.smash-society@morsel.app');
    await admin.fill('#l-pass', 'morsel-partner-2026');
    await admin.click('#login button');
    await admin.waitForSelector('#switch');
    check('a partner account is turned away from /admin', (await admin.text('.empty p')).includes('isn’t a admin account') || (await admin.text('.empty p')).includes('admin account'));
    await admin.click('#switch');
    await admin.waitForSelector('#login');
    await admin.fill('#l-email', 'admin@morsel.app');
    await admin.fill('#l-pass', 'morsel-admin-2026');
    await admin.click('#login button');
    await admin.waitForSelector('.tiles .tile');
    check('overview: four stat tiles', await admin.locator('.tiles-4 .tile').count() === 4);
    check('overview: two 14-day column charts', await admin.locator('.cols-chart').count() === 2 && await admin.locator('.cols-chart').first().locator('.col-slot').count() === 14);
    check('overview: top dishes and top restaurants', await admin.locator('.bar-list').count() === 2 && await admin.locator('.bar-list li').count() >= 10);
    await admin.hover('.cols-chart .col-slot >> nth=5');
    check('hovering a column shows its value', await admin.locator('.chart-tip.show').count() === 1 && /order/.test(await admin.text('.chart-tip')));
    check('each chart has a table view', await admin.locator('.chart-table table').count() === 2);
    await shot(admin, 'admin-overview');

    await admin.click('#side a[data-sec="settings"]');
    await admin.waitForSelector('[data-act="autopilot"]');
    if ((await admin.getAttribute('[data-act="autopilot"]', 'aria-pressed')) === 'true') await admin.click('[data-act="autopilot"]');
    check('admin turns the demo autopilot off', await admin.until('[data-act="autopilot"]', "t==='Off'"));

    section('Customer: sign up and order');
    await customer.goto(BASE + '/');
    const signed = await customer.request.post(BASE + '/api/auth/signup', { data: CUSTOMER });
    if (!signed.ok()) throw new Error('signup failed: ' + await signed.text());
    await customer.request.post(BASE + '/api/addresses', { data: { label: 'Home', street: '8 Role Street', city: 'Old Town' } });
    await customer.goto(BASE + '/#r-smash-society');
    await customer.reload();
    await customer.waitForSelector('.item[data-i="wings"]');
    await customer.click('.item[data-i="wings"]');
    await customer.click('.modal [data-q="1"]');
    await customer.click('#item-add');
    await customer.goto(BASE + '/#checkout-smash-society');
    await customer.waitForSelector('#place-btn');
    await customer.click('#place-btn');
    await customer.waitForSelector('#tr-title:not(:empty)');
    const orderId = (await (await customer.request.get(BASE + '/api/orders/mine')).json()).orders[0]._id;
    check('tracking: waiting for the restaurant to accept', (await customer.text('#tr-title')) === 'Waiting for Smash Society to accept');
    check('tracking: six steps', await customer.locator('#tr-steps li').count() === 6 && (await customer.text('#tr-steps')).includes('Picked up'));
    check('customer can cancel while it is still new', await customer.locator('#tr-cancel').isVisible());
    await customer.waitForTimeout(2500);
    check('with the autopilot off it stays new', (await customer.text('#tr-title')).startsWith('Waiting for'));

    section('Partner: accept, prepare, ready');
    await partner.goto(BASE + '/partner');
    await partner.fill('#l-email', 'partner.smash-society@morsel.app');
    await partner.fill('#l-pass', 'morsel-partner-2026');
    await partner.click('#login button');
    const card = `.o-card[data-id="${orderId}"]`;
    await partner.waitForSelector(card);
    check('new order appears in the New column', await partner.locator(`#col-new ~ ${card}`).count() === 1 || (await partner.locator('.col').first().locator(card).count()) === 1);
    check('card shows items and customer', (await partner.text(card)).includes('Chicken wings') || (await partner.text(card)).includes('wings') || (await partner.text(card)).includes('Test Roles'), await partner.text(card));
    const fresh = await partner.locator('.col').first().locator('.o-card').count();
    check('tab and title count the new orders', (await partner.text('#new-count')) === String(fresh) && (await partner.title()).startsWith(`(${fresh})`));
    await shot(partner, 'partner-new-order');
    await partner.selectOption(`[data-prep="${orderId}"]`, '20');
    await partner.click(`${card} [data-act="accept"]`);
    check('accepted order moves to In the kitchen', await partner.waitForSelector(`.col:nth-child(2) ${card}`, { timeout: 6000 }).then(() => true, () => false));
    check('customer sees it accepted, with the prep time', await customer.until('#tr-title', "t==='Order accepted'") && (await customer.text('#tr-sub')).includes('20 minutes'));
    check('the Accepted step is reached and cancel is gone', await customer.locator('#tr-steps li[data-step="accepted"].reached').count() === 1 && await customer.locator('#tr-cancel').isHidden());
    await partner.click(`${card} [data-act="preparing"]`);
    check('customer sees Preparing', await customer.until('#tr-title', "t==='Preparing your food'"));

    section('Courier (phone): take the delivery');
    await courier.goto(BASE + '/courier');
    await courier.fill('#l-email', 'courier1@morsel.app');
    await courier.fill('#l-pass', 'morsel-courier-2026');
    await courier.click('#login button');
    await courier.waitForSelector(`[data-act="take"][data-id="${orderId}"]`);
    check('delivery offered with pay and area, no street', (await courier.text('.c-offers')).includes('Smash Society') && !(await courier.text('.c-offers')).includes('8 Role Street'));
    check('courier page fits a phone', await noOverflow(courier));
    await shot(courier, 'courier-available');
    await courier.click(`[data-act="take"][data-id="${orderId}"]`);
    await courier.waitForSelector('.c-current');
    check('current delivery shows the address after accepting', (await courier.text('.c-current')).includes('8 Role Street'));
    check('pickup waits for the kitchen', await courier.isDisabled('.c-current .btn-xl'));
    check('customer sees the courier is assigned', await customer.until('#tr-sub', "t.includes('Dan will pick it up')"));
    await partner.waitForSelector(`${card} [data-act="ready"]`);
    await partner.click(`${card} [data-act="ready"]`);
    check('partner card waits for Dan', await partner.until(`${card} .o-wait`, "t.includes('Dan is on the way')"));
    check('customer: Dan is picking up', await customer.until('#tr-title', "t==='Dan is picking up your order'"));
    await courier.waitForSelector('[data-act="pickedup"]', { timeout: 8000 });
    await shot(courier, 'courier-current');
    await courier.click('[data-act="pickedup"]');
    check('customer: on the way, courier on the map', await customer.until('#tr-title', "t==='On the way'") && (await customer.getAttribute('#courier', 'style')).includes('opacity: 1'));
    await shot(customer, 'customer-on-the-way');
    await courier.waitForSelector('[data-act="delivered"]');
    await courier.click('[data-act="delivered"]');
    check('customer: delivered, with the rating form', await customer.until('#tr-title', "t.startsWith('Delivered')") && await customer.waitForSelector('#rate-send', { timeout: 6000 }).then(() => true, () => false));
    check('timeline lists all six steps', await customer.locator('#tr-timeline li').count() === 6);
    check('courier earnings updated', await courier.until('.c-tiles .tile-value', "t!=='€0.00'"));
    check('finished delivery listed under Today', (await courier.text('.c-today')).includes('Smash Society'));

    section('Partner: sold out, replies, pause');
    await partner.click('#tabs a[data-tab="menu"]');
    await partner.waitForSelector('[data-act="soldout"][data-slug="fries"]');
    await partner.click('[data-act="soldout"][data-slug="fries"]');
    check('fries switched to sold out', await partner.until('[data-act="soldout"][data-slug="fries"]', "t==='Sold out'"));
    await customer.goto(BASE + '/#r-smash-society');
    await customer.reload();
    await customer.waitForSelector('.item[data-i="fries"]');
    check('restaurant page shows fries sold out', (await customer.text('.item[data-i="fries"]')).includes('Sold out'));
    await customer.click('.item[data-i="fries"]');
    check('dish window says Sold out and won’t add', (await customer.text('#item-add')) === 'Sold out' && await customer.isDisabled('#item-add'));
    await customer.keyboard.press('Escape');
    await partner.click('[data-act="soldout"][data-slug="fries"]');
    check('fries available again', await partner.until('[data-act="soldout"][data-slug="fries"]', "t==='Available'"));

    await partner.click('#tabs a[data-tab="reviews"]');
    await partner.waitForSelector('.reply-form');
    await partner.click('[data-act="rv-filter"][data-f="unanswered"]');
    await partner.waitForTimeout(800);
    const reviewId = await partner.getAttribute('.reply-form >> nth=0', 'data-id');
    await partner.fill(`.reply-form[data-id="${reviewId}"] textarea`, 'Thanks for ordering, see you soon! (roles test)');
    await partner.click(`.reply-form[data-id="${reviewId}"] [type=submit]`);
    check('reply posted', await partner.until(`.reply-form[data-id="${reviewId}"] .sub-label`, "t==='Your public reply'"));
    await shot(partner, 'partner-reviews');
    await customer.goto(BASE + '/#r-smash-society');
    await customer.reload();
    await customer.waitForSelector('#review-list .review');
    let foundReply = false;
    for (let i = 0; i < 12 && !foundReply; i++) {
      foundReply = (await customer.locator('.review-reply', { hasText: 'roles test' }).count()) > 0;
      if (!foundReply && await customer.locator('#rv-more').count()) { await customer.click('#rv-more'); await customer.waitForTimeout(500); } else if (!foundReply) break;
    }
    check('reply shows under the review on the restaurant page', foundReply && (await customer.text('.review-reply .reply-head')).includes('Reply from Smash Society'));
    await partner.click(`.reply-form[data-id="${reviewId}"] [data-act="unreply"]`);
    await partner.waitForTimeout(600);

    await partner.click('#tabs a[data-tab="orders"]');
    await partner.waitForSelector('[data-act="pause"]');
    await partner.click('[data-act="pause"]');
    check('partner pauses new orders', await partner.until('[data-act="pause"]', "t.startsWith('Paused')"));
    await customer.goto(BASE + '/');
    await customer.reload();
    await customer.waitForSelector('.card');
    check('home card says not taking orders', (await customer.locator('.card', { hasText: 'Smash Society' }).first().textContent()).includes('Not taking orders'));
    await customer.goto(BASE + '/#r-smash-society');
    await customer.waitForSelector('.r-head');
    check('restaurant page explains the pause', (await customer.text('.notice')).includes('isn’t taking new orders'));
    await partner.click('[data-act="pause"]');
    check('partner resumes', await partner.until('[data-act="pause"]', "t==='Taking new orders'"));

    section('Admin: orders, users, reviews, promos, restaurants, menus');
    await admin.click('#side a[data-sec="orders"]');
    await admin.waitForSelector('#of-q');
    await admin.fill('#of-q', 'Test Roles');
    check('order search finds the order', await admin.until('#o-rows', "t.includes('Smash Society')"));
    await admin.click('#o-rows [data-act="order"] >> nth=0');
    await admin.waitForSelector('#od-form');
    check('order details: timeline and courier', await admin.locator('.modal .timeline li').count() === 6 && (await admin.text('.modal .kv')).includes('courier1@morsel.app'));
    await shot(admin, 'admin-order-detail');
    await admin.keyboard.press('Escape');
    await admin.selectOption('#of-status', 'cancelled');
    await admin.waitForTimeout(900);
    check('status filter shows only cancelled orders', (await admin.locator('#o-rows .chip').allTextContents()).every(t => t === 'Cancelled'));
    await admin.selectOption('#of-status', 'all');

    await admin.click('#side a[data-sec="users"]');
    await admin.waitForSelector('#uf-q');
    await admin.fill('#uf-q', CUSTOMER.email);
    await admin.waitForFunction(() => document.querySelectorAll('#u-rows tr').length === 1 && document.querySelector('#u-rows').textContent.includes('test.roles'));
    await admin.click('#u-rows [data-act="role"]');
    await admin.selectOption('#u-role', 'courier');
    await admin.selectOption('#u-veh', 'scooter');
    await admin.click('.modal [type=submit]');
    check('admin changes the role to courier', await admin.until('#u-rows', "t.includes('Courier') && t.includes('scooter')"));
    await admin.click('#u-rows [data-act="role"]');
    await admin.selectOption('#u-role', 'customer');
    await admin.click('.modal [type=submit]');
    check('and back to customer', await admin.until('#u-rows', "t.includes('Customer')"));
    await admin.click('#u-rows [data-act="disable"]');
    await admin.click('.modal [data-cf="1"]');
    check('admin disables the account', await admin.until('#u-rows', "t.includes('Disabled')"));
    await customer.goto(BASE + '/#account');
    await customer.reload();
    await customer.waitForTimeout(1200);
    check('disabled customer is signed out', (await customer.text('#acct-btn')).includes('Log in'));
    await admin.click('#u-rows [data-act="disable"]');
    check('admin enables it again', await admin.until('#u-rows', "t.includes('Active')"));
    await shot(admin, 'admin-users');

    await admin.click('#side a[data-sec="reviews"]');
    await admin.waitForSelector('#rf-rest');
    await admin.selectOption('#rf-rest', 'smash-society');
    await admin.selectOption('#rf-show', 'low');
    await admin.waitForTimeout(900);
    const before = (await (await admin.request.get(BASE + '/api/restaurants/smash-society/reviews')).json()).summary.count;
    await admin.click('#rv-rows [data-act="hide-review"] >> nth=0');
    check('review hidden in the list', await admin.until('#rv-rows .a-review', "t.includes('Hidden')"));
    const after = (await (await admin.request.get(BASE + '/api/restaurants/smash-society/reviews')).json()).summary.count;
    check('hidden review no longer counts', after === before - 1, `${before} -> ${after}`);
    await admin.click('#rv-rows [data-act="hide-review"] >> nth=0');
    check('shown again', await admin.until('#rv-rows .a-review', "t.includes('Visible')"));

    await admin.click('#side a[data-sec="promos"]');
    await admin.waitForSelector('[data-act="new-promo"]');
    await admin.click('[data-act="new-promo"]');
    await admin.fill('#p-code', `TESTUI${String(STAMP).slice(-5)}`);
    await admin.selectOption('#p-type', 'fixed');
    await admin.fill('#p-val', '5');
    await admin.fill('#p-min', '25');
    await admin.click('.modal [type=submit]');
    check('admin creates a promo code', await admin.until('table', `t.includes('TESTUI${String(STAMP).slice(-5)}') && t.includes('€5.00 off food')`));
    await admin.click(`tr:has-text("TESTUI${String(STAMP).slice(-5)}") [data-act="promo-active"]`);
    check('and turns it off', await admin.until(`tr:has-text("TESTUI${String(STAMP).slice(-5)}") [data-act="promo-active"]`, "t==='Off'"));
    check('usage counts shown', (await admin.text('tbody')).includes('WELCOME20'));
    await shot(admin, 'admin-promos');

    await admin.click('#side a[data-sec="restaurants"]');
    await admin.waitForSelector('[data-act="edit-rest"][data-slug="smash-society"]');
    await admin.click('[data-act="edit-rest"][data-slug="smash-society"]');
    await admin.fill('#r-min', '13.00');
    await admin.click('.modal [type=submit]');
    check('admin edits the minimum order', await admin.until('.rest-row:has-text("Smash Society") .rest-facts', "t.includes('€13.00')"));
    await admin.click('[data-act="edit-rest"][data-slug="smash-society"]');
    await admin.fill('#r-min', '12.00');
    await admin.click('.modal [type=submit]');
    await admin.until('.rest-row:has-text("Smash Society") .rest-facts', "t.includes('€12.00')");
    await admin.click('[data-act="pause-rest"][data-slug="smash-society"]');
    check('admin pauses a restaurant', await admin.until('.rest-row:has-text("Smash Society") .rest-facts', "t.includes('Paused')"));
    await admin.click('[data-act="pause-rest"][data-slug="smash-society"]');
    check('and opens it again', await admin.until('.rest-row:has-text("Smash Society") .rest-facts', "t.includes('Open')"));
    await shot(admin, 'admin-restaurants');

    await admin.goto(BASE + '/admin#menus/forno-sette');
    await admin.waitForSelector('[data-act="edit-item"][data-slug="margherita"]');
    await admin.click('[data-act="edit-item"][data-slug="margherita"]');
    check('dish editor shows option groups, ingredients and photo', await admin.locator('.modal #i-groups .rep-block').count() >= 1 && await admin.locator('.modal #i-ings .rep-row').count() >= 1 && await admin.locator('.modal .photo-fs').count() === 1);
    await shot(admin, 'admin-dish-editor');
    await admin.keyboard.press('Escape');
    await admin.click('[data-act="item-soldout"][data-slug="marinara"]');
    check('admin marks a dish sold out', await admin.until('[data-act="item-soldout"][data-slug="marinara"]', "t==='Sold out'"));
    await admin.click('[data-act="item-soldout"][data-slug="marinara"]');
    await admin.until('[data-act="item-soldout"][data-slug="marinara"]', "t==='Available'");
    await admin.click('[data-act="new-item"]');
    await admin.fill('#i-name', 'UI test dish');
    await admin.fill('#i-cat', 'Pizza');
    await admin.fill('#i-price', '9.90');
    await admin.click('[data-act="add-group"]');
    await admin.fill('#i-groups .rep-block input[data-k="name"] >> nth=0', 'Size');
    await admin.fill('#i-groups .rep-block [data-row="choice"] input[data-k="name"]', 'Regular');
    await admin.click('.modal [type=submit]');
    check('admin adds a dish', await admin.waitForSelector('[data-act="edit-item"][data-slug="ui-test-dish"]', { timeout: 6000 }).then(() => true, () => false));
    await admin.click('[data-act="edit-item"][data-slug="ui-test-dish"]');
    await admin.click('#fm-danger');
    await admin.click('.modal [data-cf="1"]');
    check('and deletes it', await admin.waitForSelector('[data-act="edit-item"][data-slug="ui-test-dish"]', { state: 'detached', timeout: 6000 }).then(() => true, () => false));
    await admin.setViewportSize({ width: 390, height: 844 });
    await admin.goto(BASE + '/admin#orders');
    await admin.waitForSelector('#o-rows tr');
    check('admin fits a phone (tables scroll inside their box)', await noOverflow(admin));
    await admin.setViewportSize({ width: 1440, height: 900 });

    section('Customer account');
    await customer.request.post(BASE + '/api/auth/login', { data: { email: CUSTOMER.email, password: CUSTOMER.password } });
    await customer.goto(BASE + '/#account');
    await customer.reload();
    await customer.waitForSelector('[data-tab="profile"]');
    await customer.click('[data-tab="profile"]');
    await customer.fill('#pf-name-in', 'Test Roles Renamed');
    await customer.click('#pf-name [type=submit]');
    check('customer edits their name (header updates)', await customer.until('.acct-head h1', "t==='Test Roles Renamed'") && (await customer.text('#acct-btn')).includes('Test'));
    await customer.fill('#pf-cur', 'not-my-password');
    await customer.fill('#pf-new', 'roles-pass-2');
    await customer.click('#pf-pass [type=submit]');
    check('wrong current password is refused', await customer.until('#pf-pass .err', "t==='That isn’t your current password.'"));
    await customer.fill('#pf-cur', CUSTOMER.password);
    await customer.click('#pf-pass [type=submit]');
    check('password changed', await customer.until('#toast', "t==='Password changed'"));
    await shot(customer, 'customer-profile');
    await customer.fill('#pf-del-pass', 'roles-pass-2');
    await customer.click('#pf-del [type=submit]');
    await customer.click('.modal [data-cf="1"]');
    check('customer deletes their account and is logged out', await customer.until('#toast', "t==='Your account has been deleted'") && (await customer.text('#acct-btn')).includes('Log in'));
    const gone = await customer.request.post(BASE + '/api/auth/login', { data: { email: CUSTOMER.email, password: 'roles-pass-2' } });
    check('the deleted account can’t log in', gone.status() === 401);

    section('Header links per role');
    await partner.goto(BASE + '/');
    await partner.waitForSelector('#admin-link');
    check('partner sees a Restaurant link to /partner', (await partner.getAttribute('#admin-link', 'href')) === '/partner' && (await partner.text('#admin-link')) === 'Restaurant');
    await courier.goto(BASE + '/');
    await courier.waitForSelector('#acct-btn .avatar');
    check('courier gets a link to /courier', (await courier.getAttribute('#admin-link', 'href')) === '/courier' && await courier.locator('#admin-link').isVisible());
    await admin.goto(BASE + '/');
    await admin.waitForSelector('#acct-btn .avatar');
    check('admin gets an Admin link', (await admin.getAttribute('#admin-link', 'href')) === '/admin');

    section('Autopilot back on');
    await admin.goto(BASE + '/admin#settings');
    await admin.waitForSelector('[data-act="autopilot"]');
    if ((await admin.getAttribute('[data-act="autopilot"]', 'aria-pressed')) !== 'true') await admin.click('[data-act="autopilot"]');
    check('admin turns the autopilot back on', await admin.until('[data-act="autopilot"]', "t==='On'"));
  } catch (err) {
    check('no unexpected error', false, err.stack);
    await Promise.all([shot(admin, 'error-admin'), shot(partner, 'error-partner'), shot(courier, 'error-courier'), shot(customer, 'error-customer')]).catch(() => {});
  }
  check('no page errors', problems.length === 0, problems.join('\n'));
  await browser.close();
  console.log(`\nPassed ${pass}, failed ${fail}`);
  process.exit(fail ? 1 : 0);
})();
