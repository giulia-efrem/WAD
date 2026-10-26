import { $, esc, eur, plural } from '../util.js';
import { ic, art } from '../art.js';
import { hasPhoto, photoImg, photoStyle } from '../photos.js';
import { state, R, menuOf, loadMenu, findItem, MAX_QTY, cartCount, cartSubtotal, saveCart, resetCartKeepPromo, pricing, priceRows } from '../state.js';
import { confirmDialog, drawerOpen, toast } from '../ui.js';
import { refreshItemBadges } from './restaurant.js';
import { renderCheckout } from './checkout.js';

export async function addToCart(r, line) {
  if (state.cart.restaurantSlug && state.cart.restaurantSlug !== r.slug && state.cart.lines.length) {
    const other = R(state.cart.restaurantSlug);
    const ok = await confirmDialog({
      title: 'Start a new order?',
      body: `Your bag has items from ${esc(other ? other.name : 'another restaurant')}. Adding this will clear them, because each order comes from one restaurant.`,
      confirm: 'Start new order', cancel: 'Keep current bag'
    });
    if (!ok) return false;
    resetCartKeepPromo();
  }
  state.cart.restaurantSlug = r.slug;
  const existing = state.cart.lines.find(l => l.key === line.key);
  if (existing) {
    if (existing.qty + line.qty > MAX_QTY) toast(`You can order up to ${MAX_QTY} of the same item.`);
    existing.qty = Math.min(MAX_QTY, existing.qty + line.qty);
  } else state.cart.lines.push(line);
  saveCart();
  return true;
}

export function onCartChange() {
  const n = cartCount();
  const badge = $('#cart-count');
  badge.textContent = n;
  badge.hidden = n === 0;
  $('#cart-btn').setAttribute('aria-label', n ? `Open your bag, ${plural(n, 'item', 'items')}` : 'Open your bag');
  updateCartbar();
  if (drawerOpen()) renderDrawer();
  if (state.view === 'restaurant') refreshItemBadges();
  if (state.view === 'checkout') renderCheckout();
}
export function updateCartbar() {
  const bar = $('#cartbar');
  const n = cartCount();
  const show = n > 0 && (state.view === 'home' || state.view === 'restaurant') && !drawerOpen();
  bar.hidden = !show;
  if (show) bar.innerHTML = `<span class="n">${n}</span><span>View bag</span><span class="t">${eur(cartSubtotal())}</span>`;
}

export function renderDrawer() {
  const body = $('#drawer-body'), foot = $('#drawer-foot'), sub = $('#drawer-sub');
  const r = R(state.cart.restaurantSlug);
  if (!r || !state.cart.lines.length) {
    sub.textContent = '';
    body.innerHTML = `<div class="empty" style="padding:48px 0"><div class="empty-art">${art('cupcake')}</div><h3>Your bag is empty</h3><p>Add something tasty from any restaurant and it will show up here.</p><button class="btn btn-primary" type="button" data-act="home">Browse restaurants</button></div>`;
    foot.innerHTML = '';
    return;
  }
  sub.innerHTML = `From <button class="link-btn" type="button" data-act="open-r" data-id="${esc(r.slug)}">${esc(r.name)}</button>`;
  const p = pricing(false);
  const missing = Math.max(0, r.minOrder - p.subtotal);
  const menu = menuOf(r.slug);
  /* Dish photos live in the menu; load it once, then draw the bag again with them. */
  if (!menu) loadMenu(r.slug).then(() => { if (drawerOpen()) renderDrawer(); }).catch(() => {});
  body.innerHTML = state.cart.lines.map(l => {
    const it = (menu && findItem(menu, l.itemSlug)) || null;
    return `
    <div class="line">
      <span class="thumb ${hasPhoto(it) ? 'has-photo' : ''}" style="--cv:${r.color};${photoStyle(it)}">${art(r.illustration)}${photoImg(it, { size: 'thumb' })}</span>
      <div>
        <div class="line-name">${esc(l.name)}</div>
        ${l.options.length || l.note ? `<p class="line-opts">${esc(l.options.map(o => o.choice).join(', '))}${l.note ? `${l.options.length ? '. ' : ''}Note: ${esc(l.note)}` : ''}</p>` : ''}
      </div>
      <div class="line-price">${eur(l.unitPrice * l.qty)}</div>
      <div class="qty" role="group" aria-label="Quantity of ${esc(l.name)}">
        <button type="button" data-act="qty" data-key="${esc(l.key)}" data-d="-1" aria-label="${l.qty === 1 ? 'Remove' : 'Decrease'} ${esc(l.name)}">${ic('minus')}</button>
        <span>${l.qty}</span>
        <button type="button" data-act="qty" data-key="${esc(l.key)}" data-d="1" aria-label="Increase ${esc(l.name)}" ${l.qty >= MAX_QTY ? 'disabled' : ''}>${ic('plus')}</button>
      </div>
    </div>`;
  }).join('') +
    (missing ? `<div class="minbar">Add <strong>${eur(missing)}</strong> more to reach the ${eur(r.minOrder)} minimum and skip the small order fee.<div class="progress"><i style="width:${Math.round(p.subtotal / r.minOrder * 100)}%"></i></div></div>` : '') +
    priceRows(p, { totalLabel: 'Total before tip' });
  foot.innerHTML = `<button class="btn btn-primary btn-block btn-split" type="button" data-act="go-checkout"><span>Go to checkout</span><span>${eur(p.total)}</span></button>`;
}
