import { $, $$, esc, reduced } from './util.js';
import { art } from './art.js';
import { api } from './api.js';
import { state, LS, R, loadRestaurants, loadMenu, findItem, selectedOptions, lineKey, isFav, saveCart, onCartChanged, setPromo } from './state.js';
import { openDrawer, closeDrawer, confirmDialog, closeAllModals, toast } from './ui.js';
import { app, render, go, PATH_VIEWS } from './router.js';
import { onCartChange, addToCart } from './views/bag.js';
import { updateHeader } from './views/header.js';
import { openAuth, requireAuth } from './views/auth.js';
import { openAddressForm, openAddressPicker } from './views/addresses.js';
import { renderHome, updateResults } from './views/home.js';
import { openItem } from './views/restaurant.js';
import { renderCheckout, applyPromo, placeOrder } from './views/checkout.js';

onCartChanged(onCartChange);

/* Rebuilds a past order's lines from today's menu, matching the saved option names. */
async function reorder(id) {
  const o = await api.getOrder(id);
  const r = R(o.restaurantSlug);
  if (!r) { toast('That restaurant isn’t on Morsel any more.'); return; }
  const detail = await loadMenu(r.slug);
  let first = true;
  for (const line of o.items) {
    const item = findItem(detail, line.itemSlug);
    if (!item) continue;
    const sel = {};
    for (const g of item.optionGroups) {
      const picked = line.options.filter(x => x.group === g.name).map(x => g.choices.find(c => c.name === x.choice)).filter(Boolean);
      sel[g.key] = g.type === 'one' ? (picked[0] || g.choices[0]).id : picked.map(c => c.id).slice(0, g.max);
    }
    const { options, unitPrice } = selectedOptions(item, sel);
    const note = line.note || '';
    const ok = await addToCart(detail, { key: lineKey(item.slug, sel, note), itemSlug: item.slug, name: item.name, unitPrice, qty: line.qty, options, sel, note });
    if (!ok && first) return;
    first = false;
  }
  openDrawer();
}

/* ================= Events ================= */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const id = el.dataset.id;
  try {
    switch (act) {
      case 'reload': location.reload(); break;
      case 'home': go('home'); break;
      case 'open-r': go('restaurant', { id }); break;
      case 'cat': state.cat = id; $$('.cat').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.id === id))); updateResults(); break;
      case 'filter': state[el.dataset.f] = !state[el.dataset.f]; el.setAttribute('aria-pressed', String(state[el.dataset.f])); updateResults(); break;
      case 'clear-search': state.q = ''; $('#q').value = ''; el.hidden = true; $('#q').focus(); updateResults(); break;
      case 'reset-filters':
        Object.assign(state, { q: '', cat: 'all', openNow: false, freeDel: false, topRated: false, sort: 'recommended' });
        renderHome(); break;
      case 'use-promo': setPromo('WELCOME20'); toast('WELCOME20 will be applied at checkout'); break;
      case 'dismiss-promo': state.promoDismissed = true; LS.set('morsel.promoDismissed', true); $('#promo-banner').remove(); break;
      case 'fav':
        requireAuth('Log in to save your favourite restaurants.', async () => {
          try {
            state.user = await api.toggleFavorite(id);
            const on = isFav({ _id: id });
            $$(`.fav[data-id="${id}"]`).forEach(b => { b.setAttribute('aria-pressed', String(on)); });
            toast(on ? 'Saved to favourites' : 'Removed from favourites');
            if (state.view === 'account') render(true);
          } catch (err) { toast(err.message); }
        });
        break;
      case 'open-item': openItem(el.dataset.r, el.dataset.i); break;
      case 'menu-tab': {
        const sec = document.getElementById(el.dataset.sec);
        if (sec) sec.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
        break;
      }
      case 'cart': openDrawer(); break;
      case 'close-drawer': closeDrawer(); break;
      case 'qty': {
        const line = state.cart.lines.find(l => l.key === el.dataset.key);
        if (!line) break;
        line.qty = Math.min(20, line.qty + Number(el.dataset.d));
        if (line.qty <= 0) state.cart.lines = state.cart.lines.filter(l => l !== line);
        saveCart();
        break;
      }
      case 'go-checkout': go('checkout'); break;
      case 'account-btn': if (state.user) go('account'); else openAuth('login'); break;
      case 'account': go('account'); break;
      case 'login': openAuth('login'); break;
      case 'signup': openAuth('signup'); break;
      case 'addr':
        if (!state.user) openAuth('login', { reason: 'Log in to save delivery addresses.', then: () => { if (!state.user.addresses.length) openAddressForm(); } });
        else if (!state.user.addresses.length) openAddressForm();
        else openAddressPicker();
        break;
      case 'add-addr': openAddressForm({ then: () => render(true) }); break;
      case 'default-addr': state.user = await api.setDefaultAddress(id); updateHeader(); render(true); toast('Default address updated'); break;
      case 'del-addr': {
        const ok = await confirmDialog({ title: 'Delete this address?', body: 'You can always add it again later.', confirm: 'Delete', cancel: 'Keep it' });
        if (!ok) break;
        state.user = await api.deleteAddress(id);
        if (state.co.addressId === id) state.co.addressId = (state.user.addresses.find(a => a.isDefault) || {})._id || null;
        updateHeader(); render(true); toast('Address deleted');
        break;
      }
      case 'acct-tab': state.acctTab = el.dataset.tab; render(true); break;
      case 'logout': await api.logOut(); state.user = null; state.orderCount = 0; state.co.addressId = null; updateHeader(); go('home'); toast('You’re logged out'); break;
      case 'track': go('order', { id }); break;
      case 'reorder': await reorder(id); break;
      case 'skip': {
        el.disabled = true;
        try {
          const updated = await api.skipOrder(id);
          if (state.refreshOrder) state.refreshOrder(updated);
        } finally { el.disabled = false; }
        break;
      }
      case 'tip': state.tip = Number(el.dataset.v); renderCheckout(); break;
      case 'apply-promo': applyPromo(); break;
      case 'remove-promo': setPromo(null); renderCheckout(); break;
      case 'place-order': placeOrder(); break;
    }
  } catch (err) {
    toast(err.message);
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (state.view !== 'checkout') return;
  if (t.name === 'co-addr') { state.co.addressId = t.value; const err = $('#err-addr'); if (err) err.textContent = ''; }
  if (t.name === 'co-when') { state.co.when = t.value; renderCheckout(); }
  if (t.name === 'co-pay') state.co.pay = t.value;
});

/* Back and forward between pages that have their own address, such as /credits. */
window.addEventListener('popstate', () => {
  state.view = PATH_VIEWS[location.pathname] || 'home';
  state.params = {};
  closeAllModals();
  closeDrawer(true);
  render();
});

/* The server said the session is gone (expired or logged out elsewhere). */
window.addEventListener('morsel:signed-out', () => {
  if (!state.user) return;
  state.user = null; state.orderCount = 0; state.co.addressId = null;
  closeAllModals();
  updateHeader();
  render(true);
  toast('Your session has ended. Log in again.');
});

/* ================= Start ================= */
(async () => {
  updateHeader();
  try {
    const [user] = await Promise.all([api.me(), loadRestaurants()]);
    state.user = user;
  } catch (err) {
    app().innerHTML = `<div class="wrap load-error"><div class="empty"><div class="empty-art">${art('bowl')}</div><h3>Morsel couldn’t load</h3><p>${esc(err.message)}</p><button class="btn btn-primary" type="button" data-act="reload">Try again</button></div></div>`;
    return;
  }
  if (state.user) {
    state.orderCount = state.user.orderCount || 0;
    const def = state.user.addresses.find(a => a.isDefault);
    state.co.addressId = def ? def._id : null;
  }
  if (state.cart.restaurantSlug && !R(state.cart.restaurantSlug)) { state.cart.lines = []; saveCart(); }
  updateHeader();
  onCartChange();
  const hash = (location.hash || '').slice(1);
  if (PATH_VIEWS[location.pathname]) state.view = PATH_VIEWS[location.pathname];
  else if (hash.startsWith('r-') && R(hash.slice(2))) { state.view = 'restaurant'; state.params = { id: hash.slice(2) }; }
  else if (hash.startsWith('order-')) { state.view = 'order'; state.params = { id: hash.slice(6) }; }
  else if (['checkout', 'account'].includes(hash)) state.view = hash;
  render();
})();
