import { $, $$, esc, eur, firstName, logoBadge } from '../util.js';
import { ic, art } from '../art.js';
import { api } from '../api.js';
import { state, catalog, CATS, isOpen, nowMin, opensAt, etaText, isFav } from '../state.js';
import { hasPhoto, photoImg, photoStyle } from '../photos.js';
import { progress } from '../progress.js';
import { stageCopy } from './order.js';
import { app } from '../router.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
function momentWord() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'this morning';
  if (h >= 11 && h < 17) return 'today';
  if (h >= 17 && h < 23) return 'tonight';
  return 'right now';
}

const searching = () => !!state.q.trim() || state.cat !== 'all' || state.openNow || state.freeDel || state.topRated;

function filteredRestaurants() {
  const q = state.q.trim().toLowerCase();
  const m = nowMin();
  let list = catalog.list.map((r, i) => {
    let match = '';
    if (q) {
      const inName = (r.name + ' ' + r.label + ' ' + r.tagline + ' ' + r.cuisines.join(' ')).toLowerCase().includes(q);
      if (!inName) {
        const hit = r.dishes.find(d => d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q));
        if (hit) match = hit.name;
        if (!match) return null;
      }
    }
    return { r, i, match, open: isOpen(r, m) };
  }).filter(Boolean);
  if (state.cat !== 'all') list = list.filter(x => x.r.cuisines.includes(state.cat));
  if (state.openNow) list = list.filter(x => x.open);
  if (state.freeDel) list = list.filter(x => x.r.deliveryFee === 0);
  if (state.topRated) list = list.filter(x => x.r.rating >= 4.8);
  const by = {
    recommended: (a, b) => a.i - b.i,
    fastest: (a, b) => a.r.eta.min - b.r.eta.min || a.r.eta.max - b.r.eta.max,
    rating: (a, b) => b.r.rating - a.r.rating || b.r.reviewCount - a.r.reviewCount,
    fee: (a, b) => a.r.deliveryFee - b.r.deliveryFee
  }[state.sort];
  return list.sort((a, b) => (b.open - a.open) || by(a, b));
}

/* The rows above the grid. Open places come first in each. */
function rowLists() {
  const m = nowMin();
  const all = catalog.list.map((r, i) => ({ r, i, match: '', open: isOpen(r, m) }));
  const openFirst = (a, b) => b.open - a.open;
  return [
    { id: 'popular', title: 'Popular right now', see: { sort: 'rating' },
      items: [...all].sort((a, b) => openFirst(a, b) || b.r.reviewCount - a.r.reviewCount).slice(0, 8) },
    { id: 'fast', title: 'Under 25 minutes', see: { sort: 'fastest' },
      items: all.filter(x => x.r.eta.min < 25).sort((a, b) => openFirst(a, b) || a.r.eta.min - b.r.eta.min) },
    { id: 'free', title: 'Free delivery', see: { freeDel: true },
      items: all.filter(x => x.r.deliveryFee === 0).sort(openFirst) }
  ].filter(row => row.items.length);
}

export function cardHTML({ r, match, open }, { size = 'card' } = {}) {
  const fav = isFav(r);
  const fee = r.deliveryFee ? `${eur(r.deliveryFee)} delivery` : 'Free delivery';
  return `<article class="card ${open ? '' : 'is-closed'}" style="--cv:${r.color};--cvi:${r.ink}">
    <div class="cover ${hasPhoto(r) ? 'has-photo' : ''}" style="${photoStyle(r)}"><div class="art">${art(r.illustration)}</div>${photoImg(r, { size })}
      ${open ? '' : `<div class="veil"><span>Closed now<br>Opens at ${opensAt(r)}</span></div>`}
    </div>
    <div class="card-body">
      ${logoBadge(r)}
      <div class="card-name"><h3>${esc(r.name)}</h3><p class="card-meta">${esc(r.label)} · ${esc(r.priceLevel)}</p></div>
      <span class="rating rating-chip" aria-label="Rated ${r.rating.toFixed(1)} out of 5">${ic('star', 'fill')}${r.rating.toFixed(1)}</span>
      <p class="card-facts"><span>${ic('clock')}${etaText(r)}</span><span class="${r.deliveryFee ? '' : 'free'}">${ic('bike')}${fee}</span></p>
      ${match ? `<p class="match">Serves ${esc(match)}</p>` : ''}
    </div>
    <button class="card-link" type="button" data-act="open-r" data-id="${esc(r.slug)}" aria-label="${esc(r.name)}. ${esc(r.label)}. ${r.eta.min} to ${r.eta.max} minutes. ${fee}. Rated ${r.rating.toFixed(1)}.${open ? '' : ' Closed now.'}"></button>
    <button class="fav" type="button" data-act="fav" data-id="${esc(r._id)}" aria-pressed="${fav}" aria-label="${fav ? 'Remove' : 'Save'} ${esc(r.name)} ${fav ? 'from' : 'to'} favourites">${ic('heart')}</button>
  </article>`;
}

const skeletonCard = () => `<div class="sk-card" aria-hidden="true"><div class="sk sk-cover"></div><div class="sk-row"><div class="sk sk-badge"></div><div><div class="sk sk-text w60"></div><div class="sk sk-text w40"></div></div></div></div>`;

function heroHTML() {
  const u = state.user;
  const name = u ? firstName(u.name) : '';
  const def = u && u.addresses.find(a => a.isDefault);
  const sub = def
    ? `Delivering to <button class="link-btn" type="button" data-act="addr">${esc(def.label)}, ${esc(def.street)}</button>`
    : 'Order from local favourites and follow your courier live on the map.';
  return `<section class="hero">
    <div class="wrap hero-inner">
      <div class="hero-copy">
        <p class="kicker">${greeting()}${name ? ', ' + esc(name) : ''}</p>
        <h1>What are you craving ${momentWord()}?</h1>
        <p class="hero-sub">${sub}</p>
        <div class="search" role="search">${ic('search')}
          <input id="q" type="search" placeholder="Search restaurants or dishes" aria-label="Search restaurants, dishes or cuisines" autocomplete="off" value="${esc(state.q)}">
          <button class="search-clear" type="button" data-act="clear-search" aria-label="Clear search" ${state.q ? '' : 'hidden'}>${ic('close')}</button>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <span class="disc d1" style="--dc:#FFE2D1">${art('pizza')}</span>
        <span class="disc d2" style="--dc:#DCE8FB">${art('ramen')}</span>
        <span class="disc d3" style="--dc:#FFF0C4">${art('taco')}</span>
      </div>
    </div>
  </section>`;
}

/* Shown while the restaurant list loads. */
export function renderHomeSkeleton() {
  app().innerHTML = `${heroHTML()}
    <section class="wrap" aria-busy="true" aria-label="Loading restaurants">
      <div class="row-sec"><div class="sk sk-text w40" style="height:24px;max-width:240px"></div>
        <div class="grid" style="margin-top:14px;padding-bottom:40px">${skeletonCard().repeat(4)}</div></div>
    </section>`;
}

export function renderHome() {
  app().innerHTML = `${heroHTML()}
    <section class="wrap">
      <div class="home-notes" id="home-notes"><div id="live-order"></div>${state.promoDismissed ? '' : `<div class="banner" id="promo-banner">
        <p><strong>New to Morsel?</strong> Take 20% off your first order with <span class="code">WELCOME20</span></p>
        <button class="btn" type="button" data-act="use-promo">Apply at checkout</button>
        <button class="x" type="button" data-act="dismiss-promo" aria-label="Dismiss offer">${ic('close')}</button>
      </div>`}</div>
      <div class="cats" role="group" aria-label="Cuisines">
        ${CATS.map(c => `<button class="cat" type="button" data-act="cat" data-id="${c.id}" aria-pressed="${state.cat === c.id}">
          <span class="ic" style="--cv:${c.color || 'var(--surface-2)'}">${c.art ? art(c.art) : ic('grid')}</span>${c.name}</button>`).join('')}
      </div>
      <div id="rows"></div>
      <div class="toolbar" id="all-restaurants">
        <h2 id="res-title"></h2>
        <div class="filters">
          <label class="select-wrap"><span class="visually-hidden">Sort restaurants</span>
            <select id="sort">
              <option value="recommended">Recommended</option>
              <option value="fastest">Fastest delivery</option>
              <option value="rating">Top rated</option>
              <option value="fee">Lowest delivery fee</option>
            </select>${ic('chevron')}</label>
          <button class="pill" type="button" data-act="filter" data-f="openNow" aria-pressed="${state.openNow}">Open now</button>
          <button class="pill" type="button" data-act="filter" data-f="freeDel" aria-pressed="${state.freeDel}">Free delivery</button>
          <button class="pill" type="button" data-act="filter" data-f="topRated" aria-pressed="${state.topRated}">Rated 4.8+</button>
        </div>
      </div>
      <div id="results" aria-live="polite"></div>
    </section>`;
  $('#sort').value = state.sort;
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; updateResults(); });
  $('#q').addEventListener('input', e => { state.q = e.target.value; $('.search-clear').hidden = !state.q; updateResults(); });
  updateResults();
  loadLiveOrder();
}

function renderRows() {
  const box = $('#rows');
  if (!box) return;
  if (searching()) { box.innerHTML = ''; return; }
  box.innerHTML = rowLists().map(row => `
    <section class="row-sec" aria-labelledby="row-${row.id}">
      <div class="row-head">
        <h2 id="row-${row.id}">${row.title}</h2>
        <div class="row-tools">
          <button class="see-all" type="button" data-act="see-all" data-see='${JSON.stringify(row.see)}'>See all</button>
          <div class="row-nav"><button type="button" data-act="row-scroll" data-d="-1" aria-label="Scroll ${row.title} back">${ic('back')}</button><button type="button" data-act="row-scroll" data-d="1" aria-label="Scroll ${row.title} forward"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></div>
        </div>
      </div>
      <div class="row-scroll"><div class="row-track">${row.items.map(x => cardHTML(x, { size: 'row' })).join('')}</div></div>
    </section>`).join('');
  $$('.row-scroll', box).forEach(el => { el.addEventListener('scroll', () => updateRowNav(el), { passive: true }); updateRowNav(el); });
}

/* Greys out the arrows at either end of a row. */
export function updateRowNav(scroller) {
  const nav = scroller.closest('.row-sec').querySelectorAll('.row-nav button');
  if (nav.length < 2) return;
  nav[0].disabled = scroller.scrollLeft < 4;
  nav[1].disabled = scroller.scrollLeft + scroller.clientWidth > scroller.scrollWidth - 4;
}

export function updateResults() {
  renderRows();
  const list = filteredRestaurants();
  const cat = CATS.find(c => c.id === state.cat);
  const title = state.q.trim() ? 'Results' : state.cat === 'all' ? 'All restaurants' : cat.name;
  $('#res-title').innerHTML = `${esc(title)}<span class="count">${list.length}</span>`;
  $('#results').innerHTML = list.length
    ? `<div class="grid">${list.map(x => cardHTML(x)).join('')}</div>`
    : `<div class="empty"><div class="empty-art">${art('bowl')}</div><h3>Nothing matches yet</h3><p>${state.q.trim() ? `No restaurants or dishes match “${esc(state.q.trim())}”. Try something like ramen, tacos or cheesecake.` : 'No restaurants match these filters right now.'}</p><button class="btn btn-secondary" type="button" data-act="reset-filters">Clear search and filters</button></div>`;
}

async function loadLiveOrder() {
  if (!state.user) return;
  let orders;
  try { orders = await api.listOrders(); } catch (e) { return; }
  const live = orders.find(o => progress(o).stage !== 'delivered');
  const box = $('#live-order');
  if (!live || !box) return;
  const p = progress(live);
  box.innerHTML = `<div class="live-banner"><span class="pulse" aria-hidden="true"></span><p><strong>${esc(live.restaurantName)}</strong>: ${esc(stageCopy(live, p).title.toLowerCase())}</p><button class="btn btn-sm btn-primary" type="button" data-act="track" data-id="${esc(live._id)}">Track order</button></div>`;
}
