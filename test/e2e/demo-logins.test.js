/* Login window demo accounts. Run with npm run test:e2e. */
const { chromium } = require('playwright');
const B = process.env.MORSEL_TEST_BASE;
const out = process.argv[2];
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok', m); } else { fail++; console.log('  FAIL', m); } };
(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const errors = [];
  const fresh = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    return { ctx, page };
  };
  const openLogin = async page => {
    await page.click('#acct-btn');
    await page.waitForSelector('.demo-grid .demo-acct');
  };

  console.log('== Section and buttons');
  let { ctx, page } = await fresh();
  await page.goto(B + '/');
  await openLogin(page);
  const labels = await page.$$eval('.demo-acct', bs => bs.map(b => b.dataset.demoRole + ': ' + b.innerText.replace(/\s+/g, ' ').trim()));
  console.log('   ', labels.join(' | '));
  ok(labels.length === 4, 'four demo buttons');
  ok(await page.isVisible('h3#demo-h:text("Demo accounts")'), 'heading "Demo accounts"');
  ok(labels[1].includes('Forno Sette'), 'partner defaults to Forno Sette');
  await page.screenshot({ path: out + '/demo-login-desktop.png' });
  await page.click('[data-mode="signup"]');
  ok(await page.isVisible('.demo-grid'), 'still shown on the sign-up tab');
  await page.click('[data-mode="login"]');

  console.log('== Customer');
  await page.click('[data-demo-role="customer"]');
  await page.waitForFunction(() => !document.querySelector('.demo-grid'));
  const me = await (await page.request.get(B + '/api/auth/me')).json();
  ok(me.user && me.user.email === 'demo@morsel.app', 'signed in as the demo customer');
  ok(new URL(page.url()).pathname === '/', 'customer stays on the site');
  await page.waitForSelector('.toast, [role="status"]:has-text("Signed in")', { timeout: 4000 }).then(() => ok(true, 'toast shown')).catch(() => ok(false, 'toast shown'));
  await ctx.close();

  console.log('== Partner follows the restaurant you are viewing');
  ({ ctx, page } = await fresh());
  await page.goto(B + '/#r-kaze-sushi');
  await page.waitForSelector('h1');
  await openLogin(page);
  const p = await page.$eval('[data-demo-role="partner"]', b => [b.dataset.restaurant, b.innerText]);
  ok(p[0] === 'kaze-sushi' && p[1].includes('Kaze Sushi'), 'partner button shows Kaze Sushi');
  await page.click('[data-demo-role="partner"]');
  await page.waitForURL('**/partner');
  await page.waitForSelector('.p-board, [data-tab], h1');
  const pm = await (await page.request.get(B + '/api/auth/me')).json();
  ok(pm.user.email === 'partner.kaze-sushi@morsel.app' && pm.user.role === 'partner', 'signed in as the Kaze Sushi partner, on /partner');
  ok(!(await page.isVisible('.staff-login')), 'partner page past the login form');
  await ctx.close();

  for (const [role, path, email] of [['courier', '/courier', 'courier1@morsel.app'], ['admin', '/admin', 'admin@morsel.app']]) {
    console.log('== ' + role);
    ({ ctx, page } = await fresh(role === 'courier' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {}));
    await page.goto(B + '/');
    await openLogin(page);
    await page.click(`[data-demo-role="${role}"]`);
    await page.waitForURL('**' + path + '*');
    await page.waitForTimeout(1200);
    const u = await (await page.request.get(B + '/api/auth/me')).json();
    ok(u.user.email === email, `signed in as ${email}, on ${path}`);
    ok(!(await page.isVisible('.staff-login')), `${path} past the login form`);
    await ctx.close();
  }

  console.log('== Phone layout, light and dark');
  for (const scheme of ['light', 'dark']) {
    ({ ctx, page } = await fresh({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, colorScheme: scheme }));
    await page.goto(B + '/');
    await openLogin(page);
    await page.waitForTimeout(400);
    const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, W: innerWidth, cut: [...document.querySelectorAll('.demo-acct')].some(b => b.scrollWidth > b.clientWidth + 1) }));
    ok(w.sw <= w.W && !w.cut, `no overflow at 375px (${scheme})`);
    await page.$eval('.demo-accts', el => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: `${out}/demo-login-375-${scheme}.png` });
    await ctx.close();
  }

  console.log('== Hidden when demo mode is off');
  ({ ctx, page } = await fresh());
  await page.route('**/api/auth/demo', r => r.fulfill({ json: { enabled: false, accounts: [] } }));
  await page.goto(B + '/');
  await page.click('#acct-btn');
  await page.waitForSelector('#auth-form');
  await page.waitForTimeout(500);
  ok(!(await page.$('.demo-accts')) && !(await page.$('.divider')), 'no demo section and no "or" divider');
  await ctx.close();

  ok(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' / ') : ''));
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
