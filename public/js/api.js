/* Talks to the Morsel server. Every call sends the session cookie and turns
   { error: { code, message } } responses into an ApiError with the same code and message. */

export class ApiError extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status; }
}

export const DEMO_ACCOUNT = { email: 'demo@morsel.app', password: 'morsel-demo-2026' };

async function request(method, url, body) {
  const opts = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let res;
  try { res = await fetch('/api' + url, opts); }
  catch (e) { throw new ApiError('network', 'We couldn’t reach Morsel. Check your connection and try again.', 0); }
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty or non-JSON body */ }
  if (!res.ok) {
    const err = (data && data.error) || {};
    const ex = new ApiError(err.code || 'server_error', err.message || 'Something went wrong. Try again in a moment.', res.status);
    if (res.status === 401 && ex.code === 'unauthorized') window.dispatchEvent(new CustomEvent('morsel:signed-out'));
    throw ex;
  }
  return data;
}

/* Orders carry serverNow, so live tracking can correct for a browser clock that is off. */
const withClock = o => { o.clockOffset = o.serverNow - Date.now(); return o; };

export const api = {
  async me() { return (await request('GET', '/auth/me')).user; },
  async signUp({ name, email, password }) { return (await request('POST', '/auth/signup', { name, email, password })).user; },
  async logIn({ email, password }) { return (await request('POST', '/auth/login', { email, password })).user; },
  async logOut() { await request('POST', '/auth/logout'); },
  async demoLogIn() {
    try { return await api.logIn(DEMO_ACCOUNT); }
    catch (err) {
      if (err.code === 'bad_credentials') throw new ApiError('demo_missing', 'The demo account isn’t set up yet. Run npm run seed, then try again.', 401);
      throw err;
    }
  },

  async addAddress(addr) { return request('POST', '/addresses', addr); },
  async setDefaultAddress(id) { return (await request('PATCH', `/addresses/${encodeURIComponent(id)}/default`)).user; },
  async deleteAddress(id) { return (await request('DELETE', `/addresses/${encodeURIComponent(id)}`)).user; },
  async toggleFavorite(restaurantId) { return (await request('POST', `/favorites/${encodeURIComponent(restaurantId)}/toggle`)).user; },

  async restaurants() { return (await request('GET', '/restaurants')).restaurants; },
  async restaurant(slug) { return (await request('GET', `/restaurants/${encodeURIComponent(slug)}`)).restaurant; },
  async validatePromo(code, restaurantSlug) { return request('POST', '/promo/validate', { code, restaurantSlug }); },

  async createOrder(payload) { return withClock((await request('POST', '/orders', payload)).order); },
  async listOrders() { return (await request('GET', '/orders/mine')).orders.map(withClock); },
  async getOrder(id) { return withClock((await request('GET', `/orders/${encodeURIComponent(id)}`)).order); },
  async reviewOrder(id, review) { return withClock((await request('POST', `/orders/${encodeURIComponent(id)}/review`, review)).order); },
  async reviews(slug, sort = 'newest', page = 1) { return request('GET', `/restaurants/${encodeURIComponent(slug)}/reviews?sort=${encodeURIComponent(sort)}&page=${page}`); },
  async skipOrder(id) { return withClock((await request('POST', `/orders/${encodeURIComponent(id)}/skip`)).order); },

  async adminCatalog() { return (await request('GET', '/admin/catalog')).restaurants; },
  async setImage(slug, itemSlug, { url, file }) {
    const path = itemSlug ? `/admin/restaurants/${encodeURIComponent(slug)}/items/${encodeURIComponent(itemSlug)}/image` : `/admin/restaurants/${encodeURIComponent(slug)}/image`;
    if (file) { const fd = new FormData(); fd.append('image', file); return (await request('PUT', path, fd)).image; }
    return (await request('PUT', path, { url })).image;
  }
};
