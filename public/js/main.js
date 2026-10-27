import { $, $$, esc, reduced } from './util.js';
import './topbar.js';
import { art } from './art.js';
import { api } from './api.js';
import { state, R, loadRestaurants, loadMenu, findItem, selectedOptions, dealPrice, mainPart, lineKey, isFav, addLine, changeQty, onBasketChanged, setPromo } from './state.js';
import { confirmDialog, closeAllModals, toast } from './ui.js';
import { app, render, go, PATH_VIEWS, routeOf, pathFor } from './router.js';
import { refreshOrderUI, openOrderSheet, toggleBasketsMenu } from './views/basket.js';
import { updateHeader, toggleAccountMenu, closeAccountMenu } from './views/header.js';
import { openAuth, requireAuth } from './views/auth.js';
import { openAddressForm, openAddressPicker } from './views/addresses.js';
import { renderHome, renderHomeSkeleton, updateResults } from './views/home.js';
import { drawResults } from './views/search.js';
import { openItem, editLine, refreshItemBadges, clearMenuSearch, openInfo, skeleton as restaurantSkeleton } from './views/restaurant.js';
import { renderHelp } from './views/help.js';
import { cookieNotice } from './cookies.js';
import { renderCheckout, applyPromo, placeOrder } from './views/checkout.js';

/* Whatever shows a basket redraws when one changes. */
onBasketChanged(() => {
  refreshOrderUI();
  if (state.view === 'restaurant') refreshItemBadges();
  if (state.view === 'checkout') renderCheckout();
});

/* Puts a past order back in that restaurant's basket, rebuilt from today's menu (same choices,
   same ingredients left out), then opens the restaurant. */
async function reorder(id) {
  const o = await api.getOrder(id);
  const r = R(o.restaurantSlug);
  if (!r) { toast('That restaurant isn’t on Morsel any more.'); return; }
  const detail = await loadMenu(r.slug);
  let added = 0;
  /* The saved option names, matched back to today's choices for a dish. */
  const selFor = (dish, line) => {
    const sel = {};
    for (const g of dish.optionGroups) {
      const picked = line.options.filter(x => x.group === g.name).map(x => g.choices.find(c => c.name === x.choice)).filter(Boolean);
      sel[g.key] = g.type === 'one' ? (picked[0] || g.choices[0]).id : picked.map(c => c.id).slice(0, g.max);
    }
    return sel;
  };
  for (const line of o.items) {
    const item = findItem(detail, line.itemSlug);
    if (!item) continue;
    if (item.kind === 'deal') {
      /* Meal deal: the same dish for each part (when it's still a choice), and the main dish's customisation. */
      const parts = {};
      for (const part of item.deal.parts) {
        const was = (line.parts || []).find(p => p.group === part.name);
        const choice = (was && part.choices.find(c => c.itemSlug === was.itemSlug)) || part.choices[0];
        parts[part.key] = choice.itemSlug;
      }
      const main = findItem(detail, parts[mainPart(item.deal).key]);
      const sel = main ? selFor(main, line) : {};
      const remove = main ? (line.removed || []).map(x => x.id).filter(rid => (main.ingredients || []).some(i => i.id === rid && i.removable)) : [];
      const p = dealPrice(detail, item, parts, sel, remove);
      const note = line.note || '';
      addLine(r.slug, { key: lineKey(item.slug, sel, remove, note, parts), itemSlug: item.slug, name: item.name, unitPrice: p.unitPrice, qty: line.qty, options: p.options, removed: p.removed, parts, partsInfo: p.parts, sel, remove, note });
      added += line.qty;
      continue;
    }
    const sel = {};
    for (const g of item.optionGroups) {
      const picked = line.options.filter(x => x.group === g.name).map(x => g.choices.find(c => c.name === x.choice)).filter(Boolean);
      sel[g.key] = g.type === 'one' ? (picked[0] || g.choices[0]).id : picked.map(c => c.id).slice(0, g.max);
    }
    const remove = (line.removed || []).map(x => x.id).filter(rid => (item.ingredients || []).some(i => i.id === rid && i.removable));
    const { options, removed, unitPrice } = selectedOptions(item, sel, remove);
    const note = line.note || '';
    addLine(r.slug, { key: lineKey(item.slug, sel, remove, note), itemSlug: item.slug, name: item.name, unitPrice, qty: line.qty, options, removed, sel, remove, note });
    added += line.qty;
  }
  go('restaurant', { id: r.slug });
  toast(added ? `Added ${added} ${added === 1 ? 'item' : 'items'} to your ${r.name} order` : 'Those dishes aren’t on the menu any more.');
}

/* In-app links (footer, help page) switch views without reloading the page. */
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a || a.target || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  /* Only the app's own pages; /admin, /partner, /courier and anything else load normally. */
  const route = routeOf(url);
  if (route.view === 'notfound') return;
  e.preventDefault();
  closeAllModals();
  go(route.view, route.params);
});

/* Logs out on the server (which clears the login cookie), then forgets everything about the
   account in this page and goes home. If the server can't be reached, nothing changes here,
   so the page never shows you as logged out while the cookie still works. */
async function logOut() {
  closeAccountMenu();
  closeAllModals();
  try { await api.logOut(); }
  catch (err) { toast('We couldn’t log you out. Check your connection and try again.'); return; }
  state.user = null;
  state.orderCount = 0;
  state.co.addressId = null;
  state.acctTab = 'orders';
  updateHeader();
  go('home');
  toast('You’re logged out');
}

/* Filters apply to whichever list is on screen: the home page's or the search results. */
const refreshList = () => { if (state.view === 'search') drawResults(); else updateResults(); };

/* ================= Events ================= */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const id = el.dataset.id;
  try {
    switch (act) {
      case 'reload': location.reload(); break;
      case 'to-top': window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); break;
      case 'home': go('home'); break;
      case 'see-all': {
        Object.assign(state, { q: '', cat: 'all', openNow: false, freeDel: false, topRated: false, diets: [], sort: 'recommended' }, JSON.parse(el.dataset.see));
        renderHome();
        const t = document.getElementById('all-restaurants');
        if (t) t.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
        break;
      }
      case 'row-scroll': {
        const sc = el.closest('.row-sec').querySelector('.row-scroll');
        sc.scrollBy({ left: Number(el.dataset.d) * sc.clientWidth * 0.85, behavior: reduced() ? 'auto' : 'smooth' });
        break;
      }
      case 'open-r': go('restaurant', { id }); break;
      case 'cat': state.cat = id; $$('.cat').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.id === id))); updateResults(); break;
      case 'filter': state[el.dataset.f] = !state[el.dataset.f]; el.setAttribute('aria-pressed', String(state[el.dataset.f])); refreshList(); break;
      case 'diet': {
        const d = el.dataset.diet;
        state.diets = state.diets.includes(d) ? state.diets.filter(x => x !== d) : [...state.diets, d];
        $$(`[data-act="diet"][data-diet="${d}"]`).forEach(b => b.setAttribute('aria-pressed', String(state.diets.includes(d))));
        refreshList();
        break;
      }
      case 'clear-search': $('#q').value = ''; el.hidden = true; $('#q').focus(); break;
      case 'clear-sq': $('#sq').value = ''; el.hidden = true; $('#sq').focus(); break;
      case 'search-for': go('search', { q: el.dataset.q }); break;
      case 'open-dish': go('restaurant', { id: el.dataset.r, dish: el.dataset.i }); break;
      case 'clear-menu-q': clearMenuSearch(); break;
      case 'more-dishes': state.searchAllDishes = true; drawResults(); break;
      case 'clear-filters':
        Object.assign(state, { openNow: false, freeDel: false, diets: [] });
        $$('[data-act="filter"], [data-act="diet"]').forEach(b => b.setAttribute('aria-pressed', 'false'));
        refreshList(); break;
      case 'reset-filters':
        Object.assign(state, { q: '', cat: 'all', openNow: false, freeDel: false, topRated: false, diets: [], sort: 'recommended' });
        renderHome(); break;
      case 'use-promo': setPromo('WELCOME20'); toast('WELCOME20 will be applied at checkout'); break;
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
      case 'line-qty': changeQty(el.dataset.r, el.dataset.key, Number(el.dataset.d)); break;
      case 'edit-line': await editLine(el.dataset.r, el.dataset.key); break;
      case 'open-order': openOrderSheet(el.dataset.r); break;
      case 'baskets': toggleBasketsMenu(); break;
      case 'go-checkout': case 'checkout-basket': closeAllModals(); go('checkout', { slug: el.dataset.r }); break;
      case 'account-btn': if (state.user) toggleAccountMenu(); else openAuth('login'); break;
      case 'account': go('account', { tab: 'orders' }); break;
      case 'login': openAuth('login'); break;
      case 'forgot': openAuth('forgot'); break;
      case 'print': window.print(); break;
      case 'help-again': renderHelp(); break;
      case 'r-info': openInfo(state.params.id); break;
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
      case 'acct-tab': go('account', { tab: el.dataset.tab }); break;
      case 'logout': await logOut(); break;
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
  const route = routeOf(new URL(location.href));
  state.view = route.view;
  state.params = route.params;
  closeAllModals();
  render();
});

/* The server said the session is gone (expired, logged out elsewhere, or the account was disabled). */
window.addEventListener('morsel:signed-out', e => {
  if (!state.user) return;
  state.user = null; state.orderCount = 0; state.co.addressId = null;
  closeAllModals();
  updateHeader();
  render(true);
  toast(e.detail === 'account_disabled' ? 'This account has been disabled. Contact Morsel support.' : 'Your session has ended. Log in again.');
});
window.addEventListener('morsel:user-changed', () => updateHeader());
/* A page restored from the back/forward cache (say, after a demo login opened a staff page) can show
   a login window with its buttons still busy, or a session that has since ended. Load it fresh. */
window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
window.addEventListener('morsel:account-deleted', () => {
  state.user = null; state.orderCount = 0; state.co.addressId = null;
  updateHeader();
  go('home');
  toast('Your account has been deleted');
});

/* Long pages get a back-to-top button. */
{
  const toTop = $('#to-top');
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const show = window.scrollY > window.innerHeight * 1.5;
    if (show !== toTop.classList.contains('show')) { toTop.classList.toggle('show', show); toTop.inert = !show; }
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
}

/* ================= Start ================= */
(async () => {
  updateHeader();
  const route = routeOf(new URL(location.href));
  /* An old link such as /#r-forno-sette gets the page's new address. */
  if (location.hash && route.view !== 'home' && location.pathname === '/') history.replaceState(null, '', pathFor(route.view, route.params));
  /* Something shaped like the page shows while the account and restaurants load. */
  if (route.view === 'home') renderHomeSkeleton();
  else if (route.view === 'restaurant') app().innerHTML = restaurantSkeleton();
  else if (!PATH_VIEWS[location.pathname]) app().innerHTML = `<div class="wrap" aria-busy="true" aria-label="Loading"><div class="sk sk-text w40" style="margin-top:28px;max-width:200px"></div><div class="sk sk-title" style="margin-top:16px"></div><div class="sk sk-item" style="margin-top:28px"></div><div class="sk sk-item" style="margin-top:14px"></div></div>`;
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
  updateHeader();
  state.view = route.view;
  state.params = route.params;
  render();
  cookieNotice();
})();
