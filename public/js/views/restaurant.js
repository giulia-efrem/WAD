import { $, $$, esc, eur, clamp } from '../util.js';
import { ic, art } from '../art.js';
import { state, R, menuOf, loadMenu, findItem, isOpen, opensAt, closesAt, is247, hoursText, etaText, isFav, qtyOfItem, selectedOptions, lineKey, MAX_QTY } from '../state.js';
import { hasPhoto, photoImg, photoStyle, creditHTML } from '../photos.js';
import { openModal, closeModal, toast } from '../ui.js';
import { addToCart } from './bag.js';
import { app, go, onLeave } from '../router.js';

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export function renderRestaurant(id) {
  if (!R(id)) { go('home'); return; }
  const detail = menuOf(id);
  if (detail) { drawRestaurant(detail); return; }
  app().innerHTML = `<div class="wrap"><div class="empty"><span class="spinner" style="margin:0 auto"></span></div></div>`;
  loadMenu(id).then(d => {
    if (state.view === 'restaurant' && state.params.id === id) drawRestaurant(d);
  }).catch(err => {
    if (state.view !== 'restaurant' || state.params.id !== id) return;
    app().innerHTML = `<div class="wrap"><div class="empty"><div class="empty-art">${art('bowl')}</div><h3>We couldn’t load this menu</h3><p>${esc(err.message)}</p><button class="btn btn-primary" type="button" data-act="open-r" data-id="${esc(id)}">Try again</button></div></div>`;
  });
}

function drawRestaurant(r) {
  const open = isOpen(r);
  const fav = isFav(r);
  app().innerHTML = `
    <div class="wrap">
      <div class="r-cover ${hasPhoto(r) ? 'has-photo' : ''}" style="--cv:${r.color};--cvi:${r.ink};${photoStyle(r)}">
        <div class="art">${art(r.illustration)}</div>${photoImg(r, { size: 'cover', eager: true })}${creditHTML(r, 'on-photo')}
        <button class="round-btn back" type="button" data-act="home" aria-label="Back to all restaurants">${ic('back')}</button>
        <button class="fav" type="button" data-act="fav" data-id="${esc(r._id)}" aria-pressed="${fav}" aria-label="${fav ? 'Remove' : 'Save'} ${esc(r.name)} ${fav ? 'from' : 'to'} favourites">${ic('heart')}</button>
      </div>
      <div class="r-head">
        <h1>${esc(r.name)}</h1>
        <p class="r-tag">${esc(r.tagline)}</p>
        <p class="r-sub">
          <span class="rating">${ic('star', 'fill')}${r.rating.toFixed(1)} <small>(${r.reviewCount.toLocaleString('en-GB')} ratings)</small></span>
          <span class="open-state ${open ? '' : 'closed'}"><span class="dot" aria-hidden="true"></span>${open ? (is247(r) ? 'Open 24 hours' : `Open until ${closesAt(r)}`) : `Closed, opens at ${opensAt(r)}`}</span>
        </p>
      </div>
      <div class="r-stats">
        <div class="stat"><small>Delivery time</small><strong>${etaText(r)}</strong></div>
        <div class="stat"><small>Delivery fee</small><strong class="${r.deliveryFee ? '' : 'free'}">${r.deliveryFee ? eur(r.deliveryFee) : 'Free'}</strong></div>
        <div class="stat"><small>Minimum order</small><strong>${eur(r.minOrder)}</strong></div>
        <div class="stat"><small>Hours</small><strong>${hoursText(r)}</strong></div>
      </div>
      ${open ? '' : `<p class="notice">${esc(r.name)} is closed right now. Have a look at the menu, and order from ${opensAt(r)}.</p>`}
    </div>
    <div class="menu-tabs-bar"><nav class="wrap menu-tabs" id="menu-tabs" aria-label="Menu sections">
      ${r.menu.map((s, i) => `<button type="button" data-act="menu-tab" data-sec="sec-${slug(s.category)}" aria-current="${i === 0}">${esc(s.category)}</button>`).join('')}
    </nav></div>
    <div class="wrap menu">
      ${r.menu.map(s => `<section class="menu-sec" id="sec-${slug(s.category)}" aria-labelledby="h-${slug(s.category)}">
        <h2 id="h-${slug(s.category)}">${esc(s.category)}</h2>
        <div class="items">${s.items.map(it => itemHTML(r, it)).join('')}</div>
      </section>`).join('')}
    </div>`;
  refreshItemBadges();
  if ('IntersectionObserver' in window) {
    const tabs = $$('#menu-tabs button');
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        tabs.forEach(t => {
          const on = t.dataset.sec === en.target.id;
          t.setAttribute('aria-current', String(on));
          if (on) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });
      });
    }, { rootMargin: '-150px 0px -65% 0px' });
    $$('.menu-sec').forEach(s => io.observe(s));
    onLeave(() => io.disconnect());
  }
}

function itemHTML(r, it) {
  const img = hasPhoto(it);
  return `
          <button class="item ${img ? 'has-photo' : ''}" type="button" data-act="open-item" data-r="${esc(r.slug)}" data-i="${esc(it.slug)}">
            <span class="item-main">
              <span class="item-name">${esc(it.name)}${it.popular ? '<span class="tag-pop">Popular</span>' : ''}</span>
              <span class="item-desc">${esc(it.description)}</span>
              <span class="item-price">${eur(it.price)}${it.optionGroups.length ? '<span class="muted" style="font-weight:500"> and up</span>' : ''}</span>
            </span>
            ${img ? `<span class="item-thumb" style="${photoStyle(it)}">${photoImg(it, { size: 'square' })}<span class="add" aria-hidden="true">${ic('plus')}</span></span>` : `<span class="add" aria-hidden="true">${ic('plus')}</span>`}
          </button>`;
}

export function refreshItemBadges() {
  $$('.item').forEach(el => {
    const n = qtyOfItem(el.dataset.r, el.dataset.i);
    el.classList.toggle('in-cart', n > 0);
    const add = $('.add', el);
    add.innerHTML = n ? String(n) : ic('plus');
    const name = $('.item-name', el).firstChild.textContent;
    el.setAttribute('aria-label', `${name}${n ? `, ${n} in your bag` : ''}. Open to customise and add.`);
  });
}

/* ================= Item modal ================= */
export function openItem(rid, iid) {
  const r = menuOf(rid);
  const it = r && findItem(r, iid);
  if (!r || !it) return;
  const open = isOpen(r);
  const groups = it.optionGroups;
  const sel = {};
  groups.forEach(g => { sel[g.key] = g.type === 'one' ? g.choices[0].id : []; });
  let qty = 1;
  const unit = () => selectedOptions(it, sel).unitPrice;
  const img = hasPhoto(it);
  const m = openModal(`
    <div class="item-band ${img ? 'has-photo' : ''}" style="--cv:${r.color};--cvi:${r.ink};${photoStyle(it)}"><div class="art">${art(r.illustration)}</div>${photoImg(it, { size: 'band', eager: true, alt: it.imageAlt || it.name })}${creditHTML(it, 'on-photo')}</div>
    <div class="modal-head"><h2 id="item-title">${esc(it.name)}</h2><p>${esc(it.description)}</p><p class="item-price-lg">${eur(it.price)}</p></div>
    <div class="modal-body">
      ${groups.map(g => `
        <fieldset class="opt-group" style="border:0;margin:0;padding-left:0;padding-right:0">
          <div class="opt-head"><h3>${esc(g.name)}</h3><span class="req">${g.type === 'one' ? 'Required' : `Optional, up to ${g.max}`}</span></div>
          ${g.choices.map((c, i) => `
            <label class="choice"><input type="${g.type === 'one' ? 'radio' : 'checkbox'}" name="opt-${esc(g.key)}" value="${esc(c.id)}" data-g="${esc(g.key)}" ${g.type === 'one' && i === 0 ? 'checked' : ''}>
            <span>${esc(c.name)}</span><span class="cp">${c.price ? '+' + eur(c.price) : ''}</span></label>`).join('')}
        </fieldset>`).join('')}
      <div class="field" style="margin:${groups.length ? '10px' : '0'} 0 0"><label for="item-note">Note for the kitchen <small>Optional</small></label>
      <textarea class="input" id="item-note" maxlength="140" placeholder="Allergies, no onions, extra crispy"></textarea></div>
    </div>
    <div class="modal-foot">
      <div class="qty" role="group" aria-label="Quantity"><button type="button" data-q="-1" aria-label="Decrease quantity">${ic('minus')}</button><span id="item-qty">1</span><button type="button" data-q="1" aria-label="Increase quantity">${ic('plus')}</button></div>
      <button class="btn btn-primary btn-split" type="button" id="item-add" style="flex:1" ${open ? '' : 'disabled'}></button>
    </div>`, { label: 'item-title' });
  const w = m.wrap;
  const refresh = () => {
    $('#item-qty', w).textContent = qty;
    $('#item-add', w).innerHTML = open ? `<span>Add ${qty} to order</span><span>${eur(unit() * qty)}</span>` : `<span>Opens at ${opensAt(r)}</span>`;
    groups.filter(g => g.type === 'many').forEach(g => {
      $$(`input[data-g="${g.key}"]`, w).forEach(inp => { inp.disabled = !inp.checked && sel[g.key].length >= g.max; });
    });
  };
  w.addEventListener('change', e => {
    const inp = e.target.closest('input[data-g]');
    if (!inp) return;
    const g = groups.find(x => x.key === inp.dataset.g);
    if (g.type === 'one') sel[g.key] = inp.value;
    else sel[g.key] = $$(`input[data-g="${g.key}"]:checked`, w).map(x => x.value);
    refresh();
  });
  w.addEventListener('click', async e => {
    const q = e.target.closest('[data-q]');
    if (q) { qty = clamp(qty + Number(q.dataset.q), 1, MAX_QTY); refresh(); return; }
    if (e.target.closest('#item-add')) {
      const note = $('#item-note', w).value.trim();
      const chosen = JSON.parse(JSON.stringify(sel));
      const { options, unitPrice } = selectedOptions(it, chosen);
      closeModal(m);
      const added = await addToCart(r, { key: lineKey(it.slug, chosen, note), itemSlug: it.slug, name: it.name, unitPrice, qty, options, sel: chosen, note });
      if (added) toast(`Added ${qty} × ${it.name}`);
    }
  });
  refresh();
}
