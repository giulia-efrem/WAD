import { $, $$, esc, eur, clamp, logoBadge } from '../util.js';
import { ic, art } from '../art.js';
import { state, R, menuOf, loadMenu, findItem, isOpen, blockReason, opensAt, closesAt, is247, hoursText, etaText, isFav, qtyOfItem, selectedOptions, missingChoices, isPrimaryGroup, ingredientWords, dealPrice, dealSaving, mainPart, lineKey, MAX_QTY, basketLines, addLine, replaceLine, removeLine } from '../state.js';
import { hasPhoto, photoImg, photoStyle, creditHTML } from '../photos.js';
import { openModal, closeModal, toast } from '../ui.js';
import { orderHTML, refreshOrderUI } from './basket.js';
import { renderReviews } from './reviews.js';
import { app, onLeave } from '../router.js';
import { renderNotFound } from './pages.js';

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/* Shown while a menu loads. */
function skeleton() {
  return `<div aria-busy="true" aria-label="Loading menu"><div class="sk sk-hero"></div>
    <div class="wrap"><div class="sk sk-title"></div><div class="sk sk-text w40" style="margin-top:14px"></div><div class="sk sk-text w60"></div>
      <div class="items" style="margin-top:40px">${'<div class="sk sk-item"></div>'.repeat(4)}</div></div></div>`;
}

export function renderRestaurant(id) {
  if (!R(id)) { renderNotFound(); return; }
  const detail = menuOf(id);
  if (detail) { drawRestaurant(detail); return; }
  app().innerHTML = skeleton();
  loadMenu(id).then(d => {
    if (state.view === 'restaurant' && state.params.id === id) drawRestaurant(d);
  }).catch(err => {
    if (state.view !== 'restaurant' || state.params.id !== id) return;
    app().innerHTML = `<div class="wrap"><div class="empty"><div class="empty-art">${art('bowl')}</div><h3>We couldn’t load this menu</h3><p>${esc(err.message)}</p><button class="btn btn-primary" type="button" data-act="open-r" data-id="${esc(id)}">Try again</button></div></div>`;
  });
}

function drawRestaurant(r) {
  document.title = r.name + ' · Morsel';
  const open = isOpen(r);
  const fav = isFav(r);
  const card = R(r.slug) || r;
  const openText = open ? (is247(r) ? 'Open 24 hours' : `Open until ${closesAt(r)}`) : `Closed, opens at ${opensAt(r)}`;
  /* "Popular" is built from dishes marked popular, shown first (they also stay in their own category). */
  const popular = r.menu.flatMap(s => s.items).filter(it => it.popular).slice(0, 8);
  const sections = popular.length ? [{ category: 'Popular', items: popular }, ...r.menu] : r.menu;
  app().innerHTML = `
    <div class="r-hero ${hasPhoto(r) ? 'has-photo' : ''}" style="--cv:${r.color};--cvi:${r.ink};${photoStyle(r)}">
      <div class="art">${art(r.illustration)}</div>${photoImg(r, { size: 'cover', eager: true })}${creditHTML(r, 'on-photo')}
      <div class="wrap r-hero-bar">
        <button class="round-btn back" type="button" data-act="home" aria-label="Back to all restaurants">${ic('back')}</button>
        <button class="fav" type="button" data-act="fav" data-id="${esc(r._id)}" aria-pressed="${fav}" aria-label="${fav ? 'Remove' : 'Save'} ${esc(r.name)} ${fav ? 'from' : 'to'} favourites">${ic('heart')}</button>
      </div>
    </div>
    <div class="wrap">
      <div class="r-head">
        ${logoBadge(r, 'xl')}
        <h1>${esc(r.name)}</h1>
        <p class="r-tag">${esc(r.label)} · ${esc(r.priceLevel)} · ${esc(r.tagline)}</p>
        <ul class="r-facts" aria-label="About ${esc(r.name)}">
          <li><a class="rating" href="#sec-reviews" data-act="menu-tab" data-sec="sec-reviews">${ic('star', 'fill')}${card.rating.toFixed(1)}</a><small>(${card.reviewCount.toLocaleString('en-GB')} ${card.reviewCount === 1 ? 'rating' : 'ratings'})</small></li>
          <li>${ic('clock')}<strong>${etaText(r)}</strong></li>
          <li>${ic('bike')}<strong class="${r.deliveryFee ? '' : 'free'}">${r.deliveryFee ? `${eur(r.deliveryFee)} delivery` : 'Free delivery'}</strong></li>
          <li>${ic('bag')}<span>Min. <strong>${eur(r.minOrder)}</strong></span></li>
          <li class="r-open"><span class="open-state ${open ? '' : 'closed'}"><span class="dot" aria-hidden="true"></span>${openText}</span>${is247(r) ? '' : `<small>${hoursText(r)}</small>`}</li>
        </ul>
      </div>
      ${r.paused ? `<p class="notice">${esc(r.name)} isn’t taking new orders right now. Have a look at the menu and check back a little later.</p>` : open ? '' : `<p class="notice">${esc(r.name)} is closed right now. Have a look at the menu, and order from ${opensAt(r)}.</p>`}
    </div>
    <div class="menu-tabs-bar"><nav class="wrap menu-tabs" id="menu-tabs" aria-label="Menu sections">
      ${sections.map((s, i) => `<button type="button" data-act="menu-tab" data-sec="sec-${slug(s.category)}" aria-current="${i === 0}">${esc(s.category)}</button>`).join('')}
      <button type="button" data-act="menu-tab" data-sec="sec-reviews" aria-current="false">Reviews</button>
    </nav></div>
    <div class="wrap r-body">
      <div class="r-main menu">
        ${sections.map(s => `<section class="menu-sec" id="sec-${slug(s.category)}" aria-labelledby="h-${slug(s.category)}">
          <h2 id="h-${slug(s.category)}">${esc(s.category)}</h2>
          <div class="items">${s.items.map(it => itemHTML(r, it)).join('')}</div>
        </section>`).join('')}
        <section class="menu-sec reviews" id="sec-reviews" aria-labelledby="h-reviews"><h2 id="h-reviews">Reviews</h2><div id="reviews-box"></div></section>
      </div>
      <aside class="r-aside" aria-label="Your order"><div class="order-panel" id="order-panel">${orderHTML(r.slug)}</div></aside>
    </div>`;
  refreshItemBadges();
  refreshOrderUI();
  renderReviews(r.slug, $('#reviews-box'));
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

const TAG_LABELS = { vegetarian: 'Vegetarian', vegan: 'Vegan', spicy: 'Spicy', 'gluten-free': 'Gluten-free', 'contains-nuts': 'Contains nuts' };
const tagsHTML = tags => (tags && tags.length ? `<span class="dish-tags">${tags.map(t => `<span class="dtag dtag-${t}">${TAG_LABELS[t] || esc(t)}</span>`).join('')}</span>` : '');
const ALLERGEN_NAMES = { gluten: 'gluten', milk: 'milk', egg: 'egg', fish: 'fish', crustaceans: 'crustaceans', molluscs: 'molluscs', nuts: 'tree nuts', peanuts: 'peanuts', soy: 'soy', sesame: 'sesame', mustard: 'mustard', celery: 'celery', sulphites: 'sulphites', lupin: 'lupin' };
const allergenText = list => (list.length ? `Contains: ${list.map(a => ALLERGEN_NAMES[a] || a).join(', ')}` : 'No major allergens');

/* "Burger ×2 · Side ×2 · Drink ×2": repeated parts (burger, burger2...) are counted once. */
function dealPartsText(deal) {
  const counts = new Map();
  for (const part of deal.parts) {
    const root = part.key.replace(/\d+$/, '');
    const entry = counts.get(root) || { name: part.name, n: 0 };
    entry.n += 1;
    counts.set(root, entry);
  }
  return [...counts.values()].map(e => (e.n > 1 ? `${e.name} ×${e.n}` : e.name)).join(' · ');
}

/* Dish cards: a square picture (the photo, or the restaurant's illustration). Drinks and sides
   without a photo get a clean text-only card. Meal deals show their saving. */
function itemHTML(r, it) {
  const deal = it.kind === 'deal';
  const textOnly = !deal && ['drink', 'side'].includes(it.kind) && !hasPhoto(it);
  const fromPrice = deal ? it.deal.parts.some(p => p.choices.some(c => c.delta)) : it.optionGroups.some(g => g.choices.some(c => c.price));
  const saving = deal ? dealSaving(r, it) : 0;
  return `
          <button class="item ${textOnly ? 'text-only' : ''} ${deal ? 'is-deal' : ''} ${it.soldOut ? 'sold-out' : ''}" type="button" data-act="open-item" data-r="${esc(r.slug)}" data-i="${esc(it.slug)}">
            <span class="item-main">
              <span class="item-name">${esc(it.name)}${it.popular ? '<span class="tag-pop">Popular</span>' : ''}</span>
              <span class="item-desc">${esc(it.description)}</span>
              ${deal ? `<span class="deal-parts">${esc(dealPartsText(it.deal))}</span>` : tagsHTML(it.tags)}
              <span class="item-price"><span>${eur(it.price)}${fromPrice ? '<span class="muted" style="font-weight:500"> and up</span>' : ''}</span>${saving > 0 && !it.soldOut ? `<span class="save-tag">Save ${eur(saving)}</span>` : ''}${it.soldOut ? '<span class="sold-tag">Sold out</span>' : ''}</span>
            </span>
            ${textOnly
              ? `<span class="add add-inline" aria-hidden="true">${ic('plus')}</span>`
              : `<span class="item-media ${hasPhoto(it) ? 'has-photo' : ''}" style="--cv:${r.color};--cvi:${r.ink};${photoStyle(it)}"><span class="art">${art(r.illustration)}</span>${photoImg(it, { size: 'square' })}${deal ? '<span class="deal-badge">Meal deal</span>' : ''}<span class="add" aria-hidden="true">${ic('plus')}</span></span>`}
          </button>`;
}

export function refreshItemBadges() {
  $$('.item').forEach(el => {
    const n = qtyOfItem(el.dataset.r, el.dataset.i);
    el.classList.toggle('in-cart', n > 0);
    const add = $('.add', el);
    add.innerHTML = n ? String(n) : ic('plus');
    const name = $('.item-name', el).firstChild.textContent;
    el.setAttribute('aria-label', el.classList.contains('sold-out') ? `${name}, sold out` : `${name}${n ? `, ${n} in your order` : ''}. Open to customise and add.`);
  });
}

/* ================= Dish window ================= */
/* Sections in this order: the main choice (size, base...), ingredients to leave out, extras,
   the other choices (spice level, sauce...), then a note for the kitchen. */
function groupHTML(g, sel) {
  const one = g.type === 'one';
  const picked = one ? [sel[g.key]] : (sel[g.key] || []);
  return `<fieldset class="opt-group" data-group="${esc(g.key)}">
    <legend class="opt-head"><span class="opt-title">${esc(g.name)}</span><span class="req ${one ? 'is-required' : ''}" data-req="${esc(g.key)}">${one ? 'Required' : `Optional, up to ${g.max}`}</span></legend>
    ${one ? `<p class="opt-hint">Choose 1</p>` : ''}
    ${g.choices.map(c => `
      <label class="choice"><input type="${one ? 'radio' : 'checkbox'}" name="opt-${esc(g.key)}" value="${esc(c.id)}" data-g="${esc(g.key)}" ${picked.includes(c.id) ? 'checked' : ''}>
      <span>${esc(c.name)}</span><span class="cp">${c.price ? '+' + eur(c.price) : ''}</span></label>`).join('')}
  </fieldset>`;
}

/* opts.edit: a basket line to change instead of adding a new one. */
export function openItem(rid, iid, { edit = null } = {}) {
  const r = menuOf(rid);
  const it = r && findItem(r, iid);
  if (!r || !it) return;
  if (it.kind === 'deal') { openDeal(r, it, { edit }); return; }
  const why = blockReason(r, it);
  const open = !why;
  const groups = it.optionGroups;
  const removable = (it.ingredients || []).filter(i => i.removable);
  const sel = {};
  groups.forEach(g => { sel[g.key] = g.type === 'one' ? '' : []; });
  let remove = [];
  let qty = 1;
  if (edit) {
    Object.assign(sel, JSON.parse(JSON.stringify(edit.sel)));
    remove = [...(edit.remove || [])];
    qty = edit.qty;
  }
  const primary = groups.filter(g => g.type === 'one' && isPrimaryGroup(g));
  const extras = groups.filter(g => g.type === 'many');
  const others = groups.filter(g => g.type === 'one' && !isPrimaryGroup(g));
  const ingredientsText = (it.ingredients || []).map(i => i.name).join(', ');
  const m = openModal(`
    <div class="item-band ${hasPhoto(it) ? 'has-photo' : ''}" style="--cv:${r.color};--cvi:${r.ink};${photoStyle(it)}"><div class="art">${art(r.illustration)}</div>${photoImg(it, { size: 'band', eager: true, alt: it.imageAlt || it.name })}${creditHTML(it, 'on-photo')}</div>
    <div class="modal-head"><h2 id="item-title">${esc(it.name)}</h2>${tagsHTML(it.tags)}<p>${esc(it.description)}</p>
      ${ingredientsText ? `<p class="ingredients"><span>Ingredients:</span> ${esc(ingredientsText)}</p>` : ''}
      <p class="allergens">${ic('info')}<span>${allergenText(it.allergens || [])}</span></p>
      <p class="item-price-lg">${eur(it.price)}</p></div>
    <div class="modal-body">
      ${primary.map(g => groupHTML(g, sel)).join('')}
      ${removable.length ? `<fieldset class="opt-group" data-group="remove">
        <legend class="opt-head"><span class="opt-title">Remove ingredients</span><span class="req">Optional</span></legend>
        ${removable.map(i => `<label class="choice"><input type="checkbox" name="remove" value="${esc(i.id)}" data-remove ${remove.includes(i.id) ? 'checked' : ''}><span>No ${esc(ingredientWords(i.name))}</span></label>`).join('')}
      </fieldset>` : ''}
      ${extras.map(g => groupHTML(g, sel)).join('')}
      ${others.map(g => groupHTML(g, sel)).join('')}
      <div class="field note-field"><label for="item-note">Note for the kitchen <small>Optional</small></label>
      <textarea class="input" id="item-note" maxlength="140" placeholder="Allergies, extra crispy, cut in half">${esc(edit ? edit.note : '')}</textarea></div>
      ${edit ? `<button class="link-btn remove-line" type="button" id="item-remove">Remove from order</button>` : ''}
    </div>
    <div class="modal-foot">
      <div class="qty" role="group" aria-label="Quantity"><button type="button" data-q="-1" aria-label="Decrease quantity">${ic('minus')}</button><span id="item-qty">${qty}</span><button type="button" data-q="1" aria-label="Increase quantity">${ic('plus')}</button></div>
      <button class="btn btn-primary btn-split" type="button" id="item-add" style="flex:1"></button>
    </div>`, { label: 'item-title' });
  const w = m.wrap;
  const unit = () => selectedOptions(it, sel, remove).unitPrice;
  const refresh = () => {
    $('#item-qty', w).textContent = qty;
    const missing = missingChoices(it, sel);
    const btn = $('#item-add', w);
    btn.disabled = !open;
    if (!open) btn.innerHTML = `<span>${why}</span>`;
    else if (missing.length) btn.innerHTML = `<span>Choose ${missing[0].name.toLowerCase()}</span><span>${eur(unit() * qty)}</span>`;
    else btn.innerHTML = `<span>${edit ? 'Update order' : `Add ${qty} to order`}</span><span>${eur(unit() * qty)}</span>`;
    /* Still clickable while a choice is missing: it points the customer at what to pick. */
    btn.classList.toggle('needs-choice', open && missing.length > 0);
    groups.filter(g => g.type === 'many').forEach(g => {
      $$(`input[data-g="${g.key}"]`, w).forEach(inp => { inp.disabled = !inp.checked && sel[g.key].length >= g.max; });
    });
    groups.filter(g => g.type === 'one').forEach(g => {
      const tag = $(`[data-req="${g.key}"]`, w);
      if (tag) { tag.textContent = sel[g.key] ? 'Done' : 'Required'; tag.classList.toggle('done', !!sel[g.key]); }
    });
  };
  w.addEventListener('change', e => {
    const inp = e.target;
    if (inp.matches('[data-remove]')) { remove = $$('[data-remove]:checked', w).map(x => x.value); refresh(); return; }
    if (!inp.matches('input[data-g]')) return;
    const g = groups.find(x => x.key === inp.dataset.g);
    if (g.type === 'one') { sel[g.key] = inp.value; $(`[data-group="${g.key}"]`, w).classList.remove('missing'); }
    else sel[g.key] = $$(`input[data-g="${g.key}"]:checked`, w).map(x => x.value);
    refresh();
  });
  w.addEventListener('click', e => {
    const q = e.target.closest('[data-q]');
    if (q) { qty = clamp(qty + Number(q.dataset.q), 1, MAX_QTY); refresh(); return; }
    if (e.target.closest('#item-remove')) {
      removeLine(r.slug, edit.key);
      closeModal(m);
      toast(`Removed ${it.name}`);
      return;
    }
    if (!e.target.closest('#item-add') || !open) return;
    const missing = missingChoices(it, sel);
    if (missing.length) {
      /* Point at the first required choice that's still empty. */
      missing.forEach(g => $(`[data-group="${g.key}"]`, w).classList.add('missing'));
      const first = $(`[data-group="${missing[0].key}"]`, w);
      first.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const inp = $('input', first);
      if (inp) inp.focus({ preventScroll: true });
      return;
    }
    const note = $('#item-note', w).value.trim();
    const chosen = JSON.parse(JSON.stringify(sel));
    const { options, removed, unitPrice } = selectedOptions(it, chosen, remove);
    const line = { key: lineKey(it.slug, chosen, remove, note), itemSlug: it.slug, name: it.name, unitPrice, qty, options, removed, sel: chosen, remove: [...remove], note };
    closeModal(m);
    if (edit) { replaceLine(r.slug, edit.key, line); toast(`Updated ${it.name}`); return; }
    const ok = addLine(r.slug, line);
    toast(ok ? `Added ${qty} × ${it.name}` : `You can order up to ${MAX_QTY} of the same item.`);
  });
  refresh();
}

/* ================= Meal deal window ================= */
/* Pick a dish for each part (main dish first, with its own customisation), with the running
   price and the saving against buying the same dishes separately. */
function openDeal(r, it, { edit = null } = {}) {
  const why = blockReason(r, it);
  const open = !why;
  const parts = {};
  let sel = {}, remove = [], qty = 1;
  if (edit) { Object.assign(parts, edit.parts); for (const p of it.deal.parts) { const c = p.choices.find(x => x.itemSlug === parts[p.key]); if (c && c.soldOut) delete parts[p.key]; } sel = JSON.parse(JSON.stringify(edit.sel || {})); remove = [...(edit.remove || [])]; qty = edit.qty; }
  const mainP = mainPart(it.deal);
  const mainDish = () => (parts[mainP.key] ? findItem(r, parts[mainP.key]) : null);
  const partHTML = part => `<fieldset class="opt-group" data-group="part-${esc(part.key)}">
      <legend class="opt-head"><span class="opt-title">${esc(part.name)}</span><span class="req is-required" data-req="part-${esc(part.key)}">Required</span></legend>
      <p class="opt-hint">Choose 1</p>
      ${part.choices.map(c => `<label class="choice ${c.soldOut ? 'is-sold-out' : ''}"><input type="radio" name="part-${esc(part.key)}" value="${esc(c.itemSlug)}" data-part="${esc(part.key)}" ${parts[part.key] === c.itemSlug && !c.soldOut ? 'checked' : ''} ${c.soldOut ? 'disabled' : ''}>
        <span>${esc(c.name)}</span><span class="cp">${c.soldOut ? 'Sold out' : c.delta ? '+' + eur(c.delta) : ''}</span></label>`).join('')}
    </fieldset>`;
  /* The main dish's own choices, shown once it's picked. */
  const mainCustomHTML = () => {
    const d = mainDish();
    if (!d) return '';
    const groups = d.optionGroups;
    const removable = (d.ingredients || []).filter(i => i.removable);
    return `<div class="deal-main-custom"><p class="sub-head">Your ${esc(d.name)}</p>
      ${groups.filter(g => g.type === 'one' && isPrimaryGroup(g)).map(g => groupHTML(g, sel)).join('')}
      ${removable.length ? `<fieldset class="opt-group" data-group="remove">
        <legend class="opt-head"><span class="opt-title">Remove ingredients</span><span class="req">Optional</span></legend>
        ${removable.map(i => `<label class="choice"><input type="checkbox" name="remove" value="${esc(i.id)}" data-remove ${remove.includes(i.id) ? 'checked' : ''}><span>No ${esc(ingredientWords(i.name))}</span></label>`).join('')}
      </fieldset>` : ''}
      ${groups.filter(g => g.type === 'many').map(g => groupHTML(g, sel)).join('')}
      ${groups.filter(g => g.type === 'one' && !isPrimaryGroup(g)).map(g => groupHTML(g, sel)).join('')}
    </div>`;
  };
  const bandHTML = () => {
    const d = mainDish() || it;
    return `<div class="item-band ${hasPhoto(d) ? 'has-photo' : ''}" style="--cv:${r.color};--cvi:${r.ink};${photoStyle(d)}"><div class="art">${art(r.illustration)}</div>${photoImg(d, { size: 'band', eager: true, alt: d.imageAlt || d.name })}${creditHTML(d, 'on-photo')}<span class="deal-badge lg">Meal deal</span></div>`;
  };
  const allergens = () => [...new Set(it.deal.parts.flatMap(p => { const d = parts[p.key] && findItem(r, parts[p.key]); return d ? d.allergens || [] : []; }))];
  const m = openModal(`
    <div id="deal-band">${bandHTML()}</div>
    <div class="modal-head"><h2 id="item-title">${esc(it.name)}</h2><p>${esc(it.description)}</p>
      <p class="allergens" id="deal-allergens"></p>
      <p class="item-price-lg">${eur(it.price)} <span class="save-tag lg" id="deal-save"></span></p></div>
    <div class="modal-body">
      ${partHTML(mainP)}
      <div id="deal-main">${mainCustomHTML()}</div>
      ${it.deal.parts.filter(p => p !== mainP).map(partHTML).join('')}
      <div class="field note-field"><label for="item-note">Note for the kitchen <small>Optional</small></label>
      <textarea class="input" id="item-note" maxlength="140" placeholder="Allergies, extra crispy, cut in half">${esc(edit ? edit.note : '')}</textarea></div>
      ${edit ? '<button class="link-btn remove-line" type="button" id="item-remove">Remove from order</button>' : ''}
    </div>
    <div class="modal-foot">
      <div class="qty" role="group" aria-label="Quantity"><button type="button" data-q="-1" aria-label="Decrease quantity">${ic('minus')}</button><span id="item-qty">${qty}</span><button type="button" data-q="1" aria-label="Increase quantity">${ic('plus')}</button></div>
      <button class="btn btn-primary btn-split" type="button" id="item-add" style="flex:1"></button>
    </div>`, { label: 'item-title' });
  const w = m.wrap;
  /* What's still to choose, in the order it appears: the main part, its own required choices, then the other parts. */
  const missing = () => {
    if (!parts[mainP.key]) return { group: 'part-' + mainP.key, name: mainP.name };
    const g = missingChoices(mainDish(), sel)[0];
    if (g) return { group: g.key, name: g.name };
    const part = it.deal.parts.find(p => !parts[p.key]);
    return part ? { group: 'part-' + part.key, name: part.name } : null;
  };
  const refresh = () => {
    const price = dealPrice(r, it, parts, sel, remove);
    $('#item-qty', w).textContent = qty;
    const need = missing();
    const btn = $('#item-add', w);
    btn.disabled = !open;
    if (!open) btn.innerHTML = `<span>${why}</span>`;
    else if (need) btn.innerHTML = `<span>Choose ${need.name.toLowerCase()}</span><span>${eur(price.unitPrice * qty)}</span>`;
    else btn.innerHTML = `<span>${edit ? 'Update order' : `Add ${qty} to order`}</span><span>${eur(price.unitPrice * qty)}</span>`;
    btn.classList.toggle('needs-choice', open && !!need);
    const all = it.deal.parts.every(p => parts[p.key]);
    const save = all ? price.saving : dealSaving(r, it);
    $('#deal-save', w).textContent = save > 0 ? `Save ${eur(save)}` : '';
    const al = allergens();
    $('#deal-allergens', w).innerHTML = `${ic('info')}<span>${al.length ? allergenText(al) : 'Allergens depend on your choices'}</span>`;
    it.deal.parts.forEach(p => {
      const tag = $(`[data-req="part-${p.key}"]`, w);
      if (tag) { tag.textContent = parts[p.key] ? 'Done' : 'Required'; tag.classList.toggle('done', !!parts[p.key]); }
    });
    const d = mainDish();
    if (d) {
      d.optionGroups.filter(g => g.type === 'many').forEach(g => {
        $$(`input[data-g="${g.key}"]`, w).forEach(inp => { inp.disabled = !inp.checked && (sel[g.key] || []).length >= g.max; });
      });
      d.optionGroups.filter(g => g.type === 'one').forEach(g => {
        const tag = $(`[data-req="${g.key}"]`, w);
        if (tag) { tag.textContent = sel[g.key] ? 'Done' : 'Required'; tag.classList.toggle('done', !!sel[g.key]); }
      });
    }
  };
  w.addEventListener('change', e => {
    const inp = e.target;
    if (inp.matches('[data-part]')) {
      const key = inp.dataset.part;
      parts[key] = inp.value;
      $(`[data-group="part-${key}"]`, w).classList.remove('missing');
      if (key === mainP.key) {
        /* A different main dish has different choices: start its customisation afresh. */
        const d = mainDish();
        sel = {}; remove = [];
        d.optionGroups.forEach(g => { sel[g.key] = g.type === 'one' ? '' : []; });
        $('#deal-main', w).innerHTML = mainCustomHTML();
        $('#deal-band', w).innerHTML = bandHTML();
      }
      refresh();
      return;
    }
    if (inp.matches('[data-remove]')) { remove = $$('[data-remove]:checked', w).map(x => x.value); refresh(); return; }
    if (!inp.matches('input[data-g]')) return;
    const g = mainDish().optionGroups.find(x => x.key === inp.dataset.g);
    if (g.type === 'one') { sel[g.key] = inp.value; $(`[data-group="${g.key}"]`, w).classList.remove('missing'); }
    else sel[g.key] = $$(`input[data-g="${g.key}"]:checked`, w).map(x => x.value);
    refresh();
  });
  w.addEventListener('click', e => {
    const q = e.target.closest('[data-q]');
    if (q) { qty = clamp(qty + Number(q.dataset.q), 1, MAX_QTY); refresh(); return; }
    if (e.target.closest('#item-remove')) { removeLine(r.slug, edit.key); closeModal(m); toast(`Removed ${it.name}`); return; }
    if (!e.target.closest('#item-add') || !open) return;
    const need = missing();
    if (need) {
      const box = $(`[data-group="${need.group}"]`, w);
      box.classList.add('missing');
      box.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const inp = $('input', box);
      if (inp) inp.focus({ preventScroll: true });
      return;
    }
    const note = $('#item-note', w).value.trim();
    const price = dealPrice(r, it, parts, sel, remove);
    const chosen = JSON.parse(JSON.stringify(sel));
    const line = { key: lineKey(it.slug, chosen, remove, note, parts), itemSlug: it.slug, name: it.name, unitPrice: price.unitPrice, qty, options: price.options, removed: price.removed, parts: { ...parts }, partsInfo: price.parts, sel: chosen, remove: [...remove], note };
    closeModal(m);
    if (edit) { replaceLine(r.slug, edit.key, line); toast(`Updated ${it.name}`); return; }
    const ok = addLine(r.slug, line);
    toast(ok ? `Added ${qty} × ${it.name}` : `You can order up to ${MAX_QTY} of the same item.`);
  });
  refresh();
}

/* Opens the dish window for a line already in the basket. */
export async function editLine(slugValue, key) {
  const line = basketLines(slugValue).find(l => l.key === key);
  if (!line) return;
  await loadMenu(slugValue);
  openItem(slugValue, line.itemSlug, { edit: line });
}
