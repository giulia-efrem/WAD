import { $, esc, eur, plural, logoBadge } from '../util.js';
import { ic, art } from '../art.js';
import { state, R, menuOf, findItem, MAX_QTY, basketLines, basketCount, basketSubtotal, allBaskets, pricing, priceRows, describeLine } from '../state.js';
import { hasPhoto, photoImg, photoStyle } from '../photos.js';
import { openModal, closeModal } from '../ui.js';

/* The order for one restaurant: on wide screens a sticky panel next to the menu, on phones a
   "View order" bar that opens the same thing as a bottom sheet. */

export const WIDE = '(min-width: 1100px)';
const isWide = () => window.matchMedia(WIDE).matches;

export function orderHTML(slug) {
  const r = R(slug);
  if (!r) return '';
  const lines = basketLines(slug);
  const menu = menuOf(slug);
  if (!lines.length) {
    return `<div class="order-box">
      <div class="order-head"><h2>Your order</h2></div>
      <div class="order-empty"><span class="order-empty-ic">${ic('bag')}</span><p><strong>Add items to start your order</strong><span>Your basket for ${esc(r.name)} is saved on this device.</span></p></div>
    </div>`;
  }
  const p = pricing(slug, false);
  const missing = Math.max(0, r.minOrder - p.subtotal);
  return `<div class="order-box">
    <div class="order-head"><h2>Your order</h2><span class="muted">${plural(basketCount(slug), 'item', 'items')}</span></div>
    <ul class="order-lines">${lines.map(l => {
      const it = menu && findItem(menu, l.itemSlug);
      const desc = describeLine(l);
      return `<li class="oline">
        <span class="thumb oline-thumb ${hasPhoto(it) ? 'has-photo' : ''}" style="--cv:${r.color};${photoStyle(it)}">${art(r.illustration)}${photoImg(it, { size: 'thumb', eager: true })}</span>
        <button class="oline-main" type="button" data-act="edit-line" data-r="${esc(slug)}" data-key="${esc(l.key)}" aria-label="Edit ${esc(l.name)}${desc ? ', ' + esc(desc) : ''}">
          <span class="oline-name">${esc(l.name)}</span>
          ${desc ? `<span class="oline-opts">${esc(desc)}</span>` : ''}
          ${l.note ? `<span class="oline-opts">Note: “${esc(l.note)}”</span>` : ''}
          <span class="oline-edit">Edit</span>
        </button>
        <div class="oline-side">
          <span class="oline-price">${eur(l.unitPrice * l.qty)}</span>
          <div class="qty qty-sm" role="group" aria-label="Quantity of ${esc(l.name)}">
            <button type="button" data-act="line-qty" data-r="${esc(slug)}" data-key="${esc(l.key)}" data-d="-1" aria-label="${l.qty === 1 ? 'Remove' : 'Decrease'} ${esc(l.name)}">${ic(l.qty === 1 ? 'close' : 'minus')}</button>
            <span>${l.qty}</span>
            <button type="button" data-act="line-qty" data-r="${esc(slug)}" data-key="${esc(l.key)}" data-d="1" aria-label="Increase ${esc(l.name)}" ${l.qty >= MAX_QTY ? 'disabled' : ''}>${ic('plus')}</button>
          </div>
        </div>
      </li>`;
    }).join('')}</ul>
    <div class="minbar ${missing ? '' : 'met'}">
      ${missing ? `Add <strong>${eur(missing)}</strong> more to reach the ${eur(r.minOrder)} minimum and skip the small order fee.` : `${ic('check')} You’ve reached the ${eur(r.minOrder)} minimum order.`}
      <div class="progress" aria-hidden="true"><i style="width:${Math.min(100, Math.round(p.subtotal / r.minOrder * 100))}%"></i></div>
    </div>
    ${priceRows(p, { noService: true, noTotal: true })}
    <button class="btn btn-primary btn-block btn-split" type="button" data-act="go-checkout" data-r="${esc(slug)}"><span>Go to checkout</span><span>${eur(p.subtotal)}</span></button>
    <p class="fine">Service fee and tip are added at checkout.</p>
  </div>`;
}

/* Redraws everything that shows the order of the restaurant on screen. */
export function refreshOrderUI() {
  const slug = state.view === 'restaurant' ? state.params.id : null;
  const panel = $('#order-panel');
  if (panel && slug) panel.innerHTML = orderHTML(slug);
  const sheet = $('#sheet-order');
  if (sheet && sheet.dataset.r) sheet.innerHTML = orderHTML(sheet.dataset.r);
  updateOrderBar();
  updateBasketsButton();
}

/* Phones and tablets: "View order · 3 items · €28.40" at the bottom of the restaurant page. */
export function updateOrderBar() {
  const bar = $('#orderbar');
  if (!bar) return;
  const slug = state.view === 'restaurant' ? state.params.id : null;
  const n = slug ? basketCount(slug) : 0;
  const show = n > 0 && !isWide() && !$('#sheet-order');
  bar.hidden = !show;
  if (!show) return;
  bar.dataset.r = slug;
  bar.innerHTML = `<span class="n">${n}</span><span>View order</span><span class="t">${eur(basketSubtotal(slug))}</span>`;
  bar.setAttribute('aria-label', `View your order, ${plural(n, 'item', 'items')}, ${eur(basketSubtotal(slug))}`);
}

export function openOrderSheet(slug) {
  const m = openModal(`<div class="sheet-order" id="sheet-order" data-r="${esc(slug)}">${orderHTML(slug)}</div>`, { label: 'sheet-title', cls: 'sheet', onClose: () => updateOrderBar() });
  updateOrderBar();
  return m;
}
export const closeOrderSheet = () => { const s = $('#sheet-order'); if (s) closeModal(); };

/* ================= Your baskets (header) ================= */
/* Shown when there are baskets at restaurants other than the one on screen. */
export function updateBasketsButton() {
  const btn = $('#baskets-btn');
  if (!btn) return;
  const here = state.view === 'restaurant' ? state.params.id : null;
  const others = allBaskets().filter(b => b.slug !== here && R(b.slug));
  btn.hidden = !others.length;
  $('#baskets-count').textContent = others.length;
  btn.setAttribute('aria-label', `Your baskets at ${plural(others.length, 'other restaurant', 'other restaurants')}`);
  if (!others.length) closeBasketsMenu();
}

export function toggleBasketsMenu() {
  const pop = $('#baskets-pop');
  if (!pop.hidden) { closeBasketsMenu(); return; }
  const here = state.view === 'restaurant' ? state.params.id : null;
  const list = allBaskets().filter(b => R(b.slug));
  pop.innerHTML = `<p class="pop-title">Your baskets</p>
    <ul>${list.map(b => {
      const r = R(b.slug);
      return `<li><a href="/#r-${esc(b.slug)}" class="pop-item ${b.slug === here ? 'is-here' : ''}" data-basket="${esc(b.slug)}">
        ${logoBadge(r)}<span><strong>${esc(r.name)}</strong><small>${plural(b.count, 'item', 'items')} · ${eur(b.subtotal)}${b.slug === here ? ' · on screen' : ''}</small></span>${ic('back', 'chev-r')}</a></li>`;
    }).join('')}</ul>`;
  pop.hidden = false;
  $('#baskets-btn').setAttribute('aria-expanded', 'true');
  const first = $('a', pop);
  if (first) first.focus();
}
export function closeBasketsMenu() {
  const pop = $('#baskets-pop');
  if (!pop || pop.hidden) return;
  pop.hidden = true;
  $('#baskets-btn').setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', e => {
  const pop = $('#baskets-pop');
  if (pop && !pop.hidden && !e.target.closest('#baskets-pop, #baskets-btn')) closeBasketsMenu();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeBasketsMenu(); });
window.addEventListener('resize', () => { updateOrderBar(); if (isWide()) closeOrderSheetIfWide(); });
function closeOrderSheetIfWide() { if ($('#sheet-order') && state.view === 'restaurant') closeOrderSheet(); }

