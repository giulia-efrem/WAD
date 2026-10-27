// Playwright test of Wolt-style ordering: baskets per restaurant, dish customisation, feedback and reviews.
// Run with npm run test:e2e (a test server on the morsel_test database). (server running, seed loaded; Smash Society is open 24 h)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.MORSEL_TEST_BASE;
const OUT = path.join(require('os').tmpdir(), 'morsel-e2e', 'ordering');
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const problems = [];
const check = (label, ok, detail = '') => { if (ok) { pass++; console.log('  PASS ', label); } else { fail++; console.log('  FAIL ', label, detail); } };
const isOpenNow = (hours) => { const d = new Date(), m = d.getHours() * 60 + d.getMinutes(); return hours.some(h => (m >= h.open && m < h.close) || (h.close > 1440 && m < h.close - 1440)); };

(async () => {
  const list = await (await fetch(BASE + '/api/restaurants')).json();
  const open = list.restaurants.filter(r => isOpenNow(r.hours)).map(r => r.slug);
  const second = open.find(s => s !== 'smash-society');
  console.log('open now:', open.join(', '), '| second basket at:', second || '(none open)');

  const browser = await chromium.launch({ channel: 'msedge' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  // An old single bag from the previous version should become a basket.
  await ctx.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      localStorage.setItem('morsel.cart', JSON.stringify({ restaurantSlug: 'smash-society', promo: null, lines: [{ key: 'fries|fries:classic|', itemSlug: 'fries', name: 'Fries', unitPrice: 350, qty: 1, options: [{ group: 'Style', choice: 'Classic', price: 0 }], sel: { fries: 'classic' }, note: '' }] }));
    }
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push('console: ' + m.text()); });
  const text = async sel => ((await page.locator(sel).first().textContent()) || '').replace(/\s+/g, ' ').trim();

  try {
    console.log('== Header and old bag');
    await page.goto(BASE + '/');
    await page.waitForSelector('#results .card');
    check('no bag button or drawer in the header', await page.locator('#cart-btn, #drawer').count() === 0);
    check('old bag moved into a Smash Society basket', await page.evaluate(() => { const b = JSON.parse(localStorage.getItem('morsel.baskets')); return !localStorage.getItem('morsel.cart') && b.baskets['smash-society'].lines[0].itemSlug === 'fries'; }));
    check('"Your baskets" shows on home when a basket exists', await page.locator('#baskets-btn').isVisible());

    console.log('== Log in with the demo account');
    await page.click('#acct-btn');
    await page.click('[data-demo-role="customer"]');
    await page.waitForSelector('#acct-btn .avatar');

    console.log('== Order panel and dish window (desktop)');
    await page.goto(BASE + '/#r-smash-society');
    await page.waitForSelector('#order-panel .oline');
    check('panel shows the migrated fries', (await text('#order-panel .oline-name')) === 'Fries');
    check('"Your baskets" hidden when the only basket is on screen', await page.locator('#baskets-btn').isHidden());
    await page.click('.item[data-i="classic"]');
    await page.waitForSelector('#item-add');
    const order = await page.evaluate(() => [...document.querySelectorAll('.modal .opt-group .opt-title, .modal .note-field label')].map(e => e.firstChild.textContent.trim()));
    check('sections: Remove ingredients, extras, sauce, then note', JSON.stringify(order) === JSON.stringify(['Remove ingredients', 'Add to your burger', 'Sauce', 'Note for the kitchen']), JSON.stringify(order));
    check('ingredients listed', (await text('.modal .ingredients')).includes('Two beef patties'));
    check('no sauce picked yet, button asks for it', (await text('#item-add')).startsWith('Choose sauce'));
    await page.click('#item-add');
    check('adding without the required choice flags it', await page.locator('.opt-group[data-group="sauce"].missing').count() === 1);
    check('nothing was added', (await page.evaluate(() => JSON.parse(localStorage.getItem('morsel.baskets')).baskets['smash-society'].lines.length)) === 1);
    await page.check('input[data-g="sauce"][value="bbq"]');
    await page.check('input[data-remove][value="pickles"]');
    await page.check('input[data-g="burgerExtras"][value="bacon"]');
    await page.click('[data-q="1"]');
    check('running price on the button: (990 + 180) × 2 = €23.40', (await text('#item-add')).includes('€23.40'));
    await page.screenshot({ path: path.join(OUT, '1-dish-window.png') });
    await page.click('#item-add');
    await page.waitForFunction(() => document.querySelectorAll('#order-panel .oline').length === 2);
    const desc = await page.evaluate(() => [...document.querySelectorAll('#order-panel .oline')].find(l => l.textContent.includes('Classic smash')).querySelector('.oline-opts').textContent);
    check('basket line in plain words', desc === 'Smoky BBQ, no pickles, crispy bacon', desc);
    check('minimum order reached', (await text('#order-panel .minbar')).includes('reached'));
    await page.screenshot({ path: path.join(OUT, '2-order-panel.png') });

    console.log('== Edit a line');
    await page.click('#order-panel .oline-main:has-text("Classic smash")');
    await page.waitForSelector('#item-add');
    check('dish window reopens with the choices', await page.isChecked('input[data-g="sauce"][value="bbq"]') && await page.isChecked('input[data-remove][value="pickles"]') && (await text('#item-qty')) === '2');
    await page.check('input[data-g="sauce"][value="garlic"]');
    await page.uncheck('input[data-remove][value="pickles"]');
    check('button says Update order', (await text('#item-add')).startsWith('Update order'));
    await page.click('#item-add');
    await page.waitForFunction(() => [...document.querySelectorAll('#order-panel .oline-opts')].some(e => e.textContent === 'Garlic mayo, crispy bacon'));
    check('line updated in place, still 2 lines', await page.locator('#order-panel .oline').count() === 2);
    await page.click('#order-panel .oline:has-text("Fries") [data-d="1"]');
    await page.waitForFunction(() => [...document.querySelectorAll('#order-panel .oline')].some(l => l.textContent.includes('Fries') && l.querySelector('.qty span').textContent === '2'));
    check('quantity stepper in the panel', true);

    console.log('== Fuller menu: labels, text-only cards, allergens');
    check('Popular section first, then Meal deals', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#menu-tabs button')].slice(0, 2).map(b => b.textContent))) === '["Popular","Meal deals"]');
    check('dietary labels on dish cards', await page.locator('.item .dtag').count() > 5);
    check('drinks and sides without photos use text-only cards', await page.locator('.item.text-only').count() >= 3);
    await page.click('.item[data-i="wings"]');
    await page.waitForSelector('#item-add');
    check('dish window shows tags and allergens', (await text('.modal .dish-tags')).includes('Spicy') && (await text('.modal .allergens')) === 'Contains: milk, celery');
    await page.click('[data-modal-close]');

    console.log('== Meal deal');
    await page.click('#sec-meal-deals .item[data-i="smash-menu"]');
    await page.waitForSelector('#item-add');
    check('deal asks for the burger first and shows the saving', (await text('#item-add')).startsWith('Choose burger') && (await text('#deal-save')) === 'Save €2.50');
    await page.click('#item-add');
    check('adding without a burger flags it', await page.locator('.opt-group[data-group="part-burger"].missing').count() === 1);
    await page.check('input[data-part="burger"][value="double"]');
    await page.waitForSelector('.deal-main-custom');
    check('main dish customisation appears for the chosen burger', (await text('.deal-main-custom .sub-head')) === 'Your Double trouble');
    check('next it asks for the burger’s sauce', (await text('#item-add')).startsWith('Choose sauce'));
    await page.check('.deal-main-custom input[data-g="sauce"][value="bbq"]');
    await page.check('.deal-main-custom input[data-remove][value="pickles"]');
    await page.check('input[data-part="side"][value="rings"]');
    await page.check('input[data-part="drink"][value="cola"]');
    check('running price 13.90 + 3.00 + 0.50 = €17.40, saving €2.70', (await text('#item-add')).includes('€17.40') && (await text('#deal-save')) === 'Save €2.70');
    check('allergens from the chosen dishes', (await text('#deal-allergens')).startsWith('Contains: gluten, milk, egg'));
    await page.screenshot({ path: path.join(OUT, '8-deal-window.png') });
    await page.click('#item-add');
    await page.waitForFunction(() => [...document.querySelectorAll('#order-panel .oline-name')].some(e => e.textContent === 'Smash menu'));
    const dealDesc = await page.evaluate(() => [...document.querySelectorAll('#order-panel .oline')].find(l => l.textContent.includes('Smash menu')).querySelector('.oline-opts').textContent);
    check('deal line in plain words', dealDesc === 'Double trouble (Smoky BBQ, no pickles) + Onion rings + House cola', dealDesc);
    await page.click('#order-panel .oline-main:has-text("Smash menu")');
    await page.waitForSelector('#item-add');
    check('editing a deal reopens it with the parts chosen', await page.isChecked('input[data-part="burger"][value="double"]') && await page.isChecked('.deal-main-custom input[data-g="sauce"][value="bbq"]'));
    await page.check('input[data-part="drink"][value="lemonade"]');
    await page.click('#item-add');
    await page.waitForFunction(() => [...document.querySelectorAll('#order-panel .oline-opts')].some(e => e.textContent.endsWith('+ Cloudy lemonade')));
    check('deal updated in place', true);

    console.log('== A second restaurant');
    if (second) {
      await page.goto(BASE + '/#r-' + second);
      await page.waitForSelector('#order-panel .order-empty');
      check('empty state on a new restaurant', (await text('#order-panel .order-empty strong')) === 'Add items to start your order');
      check('"Your baskets" shows the other basket', await page.locator('#baskets-btn').isVisible() && (await text('#baskets-count')) === '1');
      const simple = await page.evaluate(() => [...document.querySelectorAll('.item')].map(e => e.dataset.i));
      await page.click(`.item[data-i="${simple[simple.length - 1]}"]`);
      await page.waitForSelector('#item-add');
      for (const g of await page.locator('.opt-group .req.is-required').all()) {
        const key = await g.getAttribute('data-req');
        await page.check(`input[data-g="${key}"] >> nth=0`);
      }
      await page.click('#item-add');
      await page.waitForSelector('#order-panel .oline');
      await page.click('#baskets-btn');
      await page.waitForSelector('#baskets-pop:not([hidden]) .pop-item');
      check('baskets menu lists both restaurants', await page.locator('#baskets-pop .pop-item').count() === 2);
      await page.screenshot({ path: path.join(OUT, '3-baskets-menu.png') });
      await page.click('#baskets-pop .pop-item[data-basket="smash-society"]');
      await page.waitForSelector('#order-panel .oline');
      check('menu link opens Smash Society with its own basket', (await page.title()).startsWith('Smash Society') && await page.locator('#order-panel .oline').count() === 3);
    } else console.log('  SKIP  no second restaurant open right now');

    console.log('== Checkout one basket');
    await page.click('#order-panel [data-act="go-checkout"]');
    await page.waitForSelector('#place-btn');
    const sum = await page.evaluate(() => [...document.querySelectorAll('.sum-items li')].map(l => l.textContent.replace(/\s+/g, ' ').trim()));
    check('checkout shows only Smash Society, with the deal', sum.length === 3 && sum.some(s => s.includes('Garlic mayo, crispy bacon')) && sum.some(s => s.includes('Double trouble (Smoky BBQ, no pickles) + Onion rings + Cloudy lemonade')), JSON.stringify(sum));
    await page.click('#place-btn');
    await page.waitForSelector('#tr-title:not(:empty)');
    const left = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('morsel.baskets')).baskets));
    check('only that basket was emptied', !left.includes('smash-society') && (!second || left.includes(second)), JSON.stringify(left));
    const items = await page.evaluate(() => [...document.querySelectorAll('.track .sum-items li')].map(l => l.textContent.replace(/\s+/g, ' ').trim()));
    check('order details keep the customisation and the deal', items.some(s => s.includes('Garlic mayo, crispy bacon')) && items.some(s => s.includes('Double trouble (Smoky BBQ, no pickles) + Onion rings')), JSON.stringify(items));
    const orderUrl = page.url();

    console.log('== Feedback after delivery');
    for (let i = 0; i < 8 && !(await page.locator('#rate-send').count()); i++) { await page.click('[data-act="skip"]').catch(() => {}); await page.waitForTimeout(700); }
    await page.waitForSelector('#rate-send');
    check('send is disabled until food and delivery are rated', await page.isDisabled('#rate-send'));
    await page.click('[data-star="4"]');
    check('still disabled with only stars', await page.isDisabled('#rate-send'));
    await page.click('[data-thumb="up"]');
    await page.fill('#rate-c', 'Garlic mayo was a great call.');
    await page.screenshot({ path: path.join(OUT, '4-feedback.png') });
    await page.click('#rate-send');
    await page.waitForSelector('.rated');
    check('thanks message after sending', (await text('.rated')).includes('4 stars') && (await text('.rated')).includes('thumbs up'));

    console.log('== Reviews on the restaurant page');
    await page.goto(BASE + '/#r-smash-society');
    await page.waitForSelector('.review');
    const top = await page.evaluate(() => { const r = document.querySelector('.review'); return { you: !!r.querySelector('.default-tag'), comment: r.querySelector('.review-comment') && r.querySelector('.review-comment').textContent }; });
    check('newest review is mine, with comment', top.you && top.comment === 'Garlic mayo was a great call.', JSON.stringify(top));
    const count = Number((await text('.rv-score .muted')).replace(/\D/g, ''));
    const headCount = Number((await text('.r-facts small')).replace(/\D/g, ''));
    check('count in header matches the reviews summary', count > 0 && count === headCount, `${count} vs ${headCount}`);
    await page.selectOption('#rv-sort', 'lowest');
    await page.waitForFunction(() => document.querySelector('#rv-sort') && document.querySelector('#rv-sort').value === 'lowest' && document.querySelectorAll('.review').length);
    const lows = await page.evaluate(() => [...document.querySelectorAll('.review .stars-row')].map(s => s.querySelectorAll('.on').length));
    check('sorted lowest first', lows.every((v, i, a) => !i || a[i - 1] <= v) && lows[0] <= 3, JSON.stringify(lows));
    await page.click('#rv-more');
    await page.waitForFunction(() => document.querySelectorAll('.review').length > 10);
    check('show more loads the next page', true);
    await page.locator('#sec-reviews').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, '5-reviews.png') });

    console.log('== Reorder a meal deal');
    await page.goto(BASE + '/#account');
    await page.waitForSelector('.order-row [data-act="reorder"]');
    await page.click('.order-row [data-act="reorder"] >> nth=0');
    await page.waitForFunction(() => [...document.querySelectorAll('#order-panel .oline-opts')].some(e => e.textContent.includes('Double trouble (Smoky BBQ, no pickles)')));
    check('reorder puts the deal back with its parts', true);

    console.log('== Phone: View order bar and bottom sheet');
    const phone = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
    phone.on('pageerror', e => problems.push('phone pageerror: ' + e.message));
    await phone.goto(BASE + '/#r-smash-society');
    await phone.waitForSelector('.item');
    check('no order panel on phones', await phone.locator('#order-panel').isHidden());
    check('no View order bar while the basket is empty', await phone.locator('#orderbar').isHidden());
    await phone.click('.item[data-i="rings"]');
    await phone.waitForSelector('#item-add');
    await phone.click('#item-add');
    await phone.waitForSelector('#orderbar:not([hidden])');
    check('View order bar with count and total', (await phone.locator('#orderbar').textContent()).replace(/\s+/g, ' ').includes('View order') && (await phone.locator('#orderbar').textContent()).includes('€4.20'));
    await phone.screenshot({ path: path.join(OUT, '6-phone-bar.png') });
    await phone.click('#orderbar');
    await phone.waitForSelector('.modal-wrap.sheet #sheet-order .oline');
    check('sheet shows the order', (await phone.locator('#sheet-order .oline-name').first().textContent()) === 'Onion rings');
    await phone.screenshot({ path: path.join(OUT, '7-phone-sheet.png') });
    await phone.click('#sheet-order [data-act="line-qty"][data-d="1"]');
    await phone.waitForFunction(() => document.querySelector('#sheet-order .qty span').textContent === '2');
    check('quantity changes inside the sheet', true);
    await phone.click('#sheet-order [data-act="go-checkout"]');
    await phone.waitForSelector('#place-btn');
    check('checkout from the sheet', true);
    await phone.close();
  } catch (err) {
    problems.push('STOPPED: ' + err.message.split('\n')[0]);
    await page.screenshot({ path: path.join(OUT, 'error.png') }).catch(() => {});
  }
  await browser.close();
  console.log(`\nPassed ${pass}, failed ${fail}`);
  if (problems.length) { console.log('Problems:'); problems.forEach(p => console.log('  - ' + p)); }
  process.exit(fail || problems.length ? 1 : 0);
})();
