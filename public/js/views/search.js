import { $, $$, esc, eur } from '../util.js';
import { ic, art } from '../art.js';
import { state, isOpen, nowMin } from '../state.js';
import { search, dietDishes, DIETS, SUGGESTIONS } from '../search.js';
import { hasPhoto, photoImg, photoStyle } from '../photos.js';
import { cardHTML, updateRowNav } from './home.js';
import { attachSuggestions } from './searchbox.js';
import { app, go } from '../router.js';

const DISH_PAGE = 12;

/* The filters shared by the home page and search: dietary labels, open now, free delivery. */
export function dietPills() {
  return Object.entries(DIETS).map(([k, v]) => `<button class="pill" type="button" data-act="diet" data-diet="${k}" aria-pressed="${state.diets.includes(k)}">${v.label}</button>`).join('');
}

/* Where a search result leads: a restaurant, or a dish (its restaurant with the dish window open). */
export function openResult(o) {
  if (o.type === 'restaurant') go('restaurant', { id: o.r.slug });
  else if (o.type === 'dish') go('restaurant', { id: o.r.slug, dish: o.d.slug });
  else go('search', { q: o.q });
}

function dishRow({ r, d }, open) {
  const tags = (d.tags || []).filter(t => DIETS[t]).map(t => `<span class="dtag dtag-${t}">${DIETS[t].label}</span>`).join('');
  return `<button class="dish-row ${open ? '' : 'is-closed'}" type="button" data-act="open-dish" data-r="${esc(r.slug)}" data-i="${esc(d.slug)}">
    <span class="thumb ${hasPhoto(d) ? 'has-photo' : ''}" style="--cv:${r.color};${photoStyle(d)}">${art(r.illustration)}${photoImg(d, { size: 'thumb' })}</span>
    <span class="dr-main"><strong>${esc(d.name)}</strong><small>${esc(r.name)}${open ? '' : ' · closed now'}</small>${tags ? `<span class="dish-tags">${tags}</span>` : ''}</span>
    <span class="dr-price">${d.soldOut ? '<span class="sold-tag">Sold out</span>' : eur(d.price)}</span>
  </button>`;
}

export function renderSearch() {
  const q = state.params.q || '';
  state.searchAllDishes = false;
  document.title = q ? `“${q}” · Search · Morsel` : 'Search · Morsel';
  app().innerHTML = `
    <div class="wrap search-page">
      <div class="search-top">
        <h1 class="visually-hidden">Search</h1>
        <div class="search" role="search">${ic('search')}
          <input id="sq" type="search" placeholder="Restaurants, dishes or cuisines" aria-label="Search restaurants, dishes or cuisines" autocomplete="off" value="${esc(q)}" enterkeyhint="search">
          <button class="search-clear" type="button" data-act="clear-sq" aria-label="Clear search" ${q ? '' : 'hidden'}>${ic('close')}</button>
        </div>
      </div>
      <div class="filters search-filters" role="group" aria-label="Filters">${dietPills()}
        <button class="pill" type="button" data-act="filter" data-f="openNow" aria-pressed="${state.openNow}">Open now</button>
        <button class="pill" type="button" data-act="filter" data-f="freeDel" aria-pressed="${state.freeDel}">Free delivery</button>
      </div>
      <div id="search-results" aria-live="polite"></div>
    </div>`;
  const input = $('#sq');
  attachSuggestions(input, {
    onPick: o => (o.type === 'all' ? (o.q ? go('search', { q: o.q }) : null) : openResult(o)),
    onInput: v => { $('[data-act="clear-sq"]').hidden = !v; }
  });
  drawResults();
  if (!q) input.focus();
}

/* Results for the address's query, with the filters applied. */
export function drawResults() {
  const box = $('#search-results');
  if (!box) return;
  const q = (state.params.q || '').trim();
  if (!q) {
    box.innerHTML = `<div class="search-start"><h2>Find something to eat</h2><p class="muted">Search for a restaurant, a dish or a cuisine. Try one of these:</p>${chips()}</div>`;
    return;
  }
  const m = nowMin();
  const res = search(q);
  const keep = r => (!state.openNow || (isOpen(r, m) && !r.paused)) && (!state.freeDel || r.deliveryFee === 0);
  const diets = state.diets;
  let restaurants = res.restaurants.filter(x => keep(x.r) && (!diets.length || dietDishes(x.r, diets).length));
  let dishes = res.dishes.filter(x => keep(x.r) && diets.every(t => (x.d.tags || []).includes(t)));
  const openFirst = (a, b) => (isOpen(b.r, m) && !b.r.paused) - (isOpen(a.r, m) && !a.r.paused);
  restaurants = [...restaurants].sort(openFirst);
  dishes = [...dishes].sort(openFirst);
  if (!restaurants.length && !dishes.length) {
    const filtered = diets.length || state.openNow || state.freeDel;
    box.innerHTML = `<div class="empty"><div class="empty-art">${art('bowl')}</div>
      <h2>No results for “${esc(q)}”</h2>
      <p>${filtered ? 'Nothing matches with these filters. Try removing one.' : 'Check the spelling, or try one of these:'}</p>
      ${filtered ? `<button class="btn btn-secondary" type="button" data-act="clear-filters">Clear filters</button>` : chips()}
      <p style="margin-top:18px"><button class="link-btn" type="button" data-act="home">Browse all restaurants</button></p></div>`;
    return;
  }
  const shown = state.searchAllDishes ? dishes : dishes.slice(0, DISH_PAGE);
  box.innerHTML = `
    <h2 class="res-h">Results for “${esc(q)}”</h2>
    ${restaurants.length ? `<section class="res-sec row-sec" aria-labelledby="rs-r">
      <div class="row-head"><h3 class="res-title" id="rs-r">Restaurants <span class="count">${restaurants.length}</span></h3>
        <div class="row-tools"><div class="row-nav"><button type="button" data-act="row-scroll" data-d="-1" aria-label="Scroll restaurants back">${ic('back')}</button><button type="button" data-act="row-scroll" data-d="1" aria-label="Scroll restaurants forward"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></div></div></div>
      <div class="row-scroll"><div class="row-track">${restaurants.map(x => cardHTML({ r: x.r, open: isOpen(x.r, m), match: x.top ? x.top.name : '' }, { size: 'row' })).join('')}</div></div></section>` : ''}
    ${dishes.length ? `<section class="res-sec" aria-labelledby="rs-d"><h3 class="res-title" id="rs-d">Dishes <span class="count">${dishes.length}</span></h3>
      <div class="dish-results">${shown.map(x => dishRow(x, isOpen(x.r, m) && !x.r.paused)).join('')}</div>
      ${dishes.length > shown.length ? `<button class="btn btn-secondary more-dishes" type="button" data-act="more-dishes">Show all ${dishes.length} dishes</button>` : ''}</section>` : ''}`;
  $$('.row-scroll', box).forEach(el => { el.addEventListener('scroll', () => updateRowNav(el), { passive: true }); updateRowNav(el); });
}

const chips = () => `<div class="chip-row">${SUGGESTIONS.map(s => `<button class="pill" type="button" data-act="search-for" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
