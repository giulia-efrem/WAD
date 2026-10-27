'use strict';

/* Shared by the browser tests. They run in Microsoft Edge (installed with Windows) through
   Playwright, against the test server that npm run test:e2e starts on the morsel_test database. */

const { chromium } = require('playwright');

const BASE = process.env.MORSEL_TEST_BASE;
if (!BASE) throw new Error('Run the browser tests with npm run test:e2e.');

const ACCOUNTS = {
  customer: ['demo@morsel.app', 'morsel-demo-2026'],
  admin: ['admin@morsel.app', 'morsel-admin-2026'],
  partner: ['partner.smash-society@morsel.app', 'morsel-partner-2026'],
  courier: ['courier1@morsel.app', 'morsel-courier-2026']
};

let browser = null;
async function launch() {
  if (!browser) browser = await chromium.launch({ channel: process.env.MORSEL_TEST_BROWSER || 'msedge' });
  return browser;
}
async function closeBrowser() { if (browser) { await browser.close(); browser = null; } }

/* A fresh browser profile and page. Page errors and console errors are collected in page.problems. */
async function newPage({ width = 1440, height = 900, theme = 'light', mobile = width < 600 } = {}) {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width, height }, colorScheme: theme, reducedMotion: 'reduce', isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', e => page.problems.push('page error: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())) page.problems.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 500) page.problems.push(`HTTP ${r.status()} ${r.url()}`); });
  return page;
}

/* Logs in through the API in this page's browser profile (no UI), then opens `path`. */
async function loginAs(page, role, path = '/') {
  const [email, password] = ACCOUNTS[role];
  const r = await page.request.post(BASE + '/api/auth/login', { data: { email, password } });
  if (!r.ok()) throw new Error(`Login as ${role} failed: ${r.status()}`);
  /* A blank page first, so that going to an address that differs only after # still loads it fresh. */
  await page.goto('about:blank');
  await page.goto(BASE + path);
}

/* A new customer account in this page's profile. */
let n = 0;
async function signUp(page, name = 'Test Customer') {
  const email = `test.e2e.${Date.now()}.${++n}@example.com`;
  const r = await page.request.post(BASE + '/api/auth/signup', { data: { name, email, password: 'secret-pass-1' } });
  if (!r.ok()) throw new Error('Signup failed: ' + r.status());
  return { email, password: 'secret-pass-1' };
}

const text = async (page, sel) => ((await page.locator(sel).first().textContent()) || '').replace(/\s+/g, ' ').trim();

module.exports = { BASE, ACCOUNTS, launch, closeBrowser, newPage, loginAs, signUp, text };
