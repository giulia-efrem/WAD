'use strict';

/* A tiny HTTP client for the API tests. Each client keeps its own cookies, like a browser. */

const BASE = process.env.MORSEL_TEST_BASE;
if (!BASE) throw new Error('Run the tests with npm test, which starts a test server on the morsel_test database.');

const ACCOUNTS = {
  customer: ['demo@morsel.app', 'morsel-demo-2026'],
  admin: ['admin@morsel.app', 'morsel-admin-2026'],
  partner: ['partner.smash-society@morsel.app', 'morsel-partner-2026'],
  courier: ['courier1@morsel.app', 'morsel-courier-2026']
};

function client() {
  const jar = new Map();
  async function call(method, path, body, headers = {}) {
    const h = { ...headers };
    if (jar.size) h.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    if (body !== undefined) h['content-type'] = 'application/json';
    const res = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i), value = pair.slice(i + 1);
      if (!value || /expires=Thu, 01 Jan 1970/i.test(c) || /max-age=0/i.test(c)) jar.delete(name); else jar.set(name, value);
    }
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { /* not JSON */ }
    return { status: res.status, body: json, text, headers: res.headers };
  }
  const c = {
    jar,
    get: (p, h) => call('GET', p, undefined, h),
    post: (p, b = {}, h) => call('POST', p, b, h),
    put: (p, b = {}, h) => call('PUT', p, b, h),
    patch: (p, b = {}, h) => call('PATCH', p, b, h),
    del: (p, b, h) => call('DELETE', p, b, h),
    async login(email, password) {
      const r = await c.post('/api/auth/login', { email, password });
      if (r.status !== 200) throw new Error(`Login as ${email} failed: ${r.status} ${r.text}`);
      return r.body.user;
    },
    as: role => c.login(...ACCOUNTS[role])
  };
  return c;
}

/* A client already logged in as one of the seeded accounts. */
async function as(role) { const c = client(); await c.as(role); return c; }

/* A new customer account with a unique email. */
let n = 0;
async function newCustomer(name = 'Test Customer') {
  const c = client();
  const email = `test.${Date.now()}.${++n}@example.com`;
  const r = await c.post('/api/auth/signup', { name, email, password: 'secret-pass-1' });
  if (r.status !== 201) throw new Error(`Signup failed: ${r.status} ${r.text}`);
  c.user = r.body.user; c.email = email; c.password = 'secret-pass-1';
  return c;
}

module.exports = { BASE, ACCOUNTS, client, as, newCustomer };
