import { $, esc, firstName } from '../util.js';
import { ic, art } from '../art.js';
import { api } from '../api.js';
import { state, catalog, CATS, isOpen, nowMin, opensAt, etaText, feeText, isFav } from '../state.js';
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

export function cardHTML({ r, match, open }) {
  const fav = isFav(r);
  return `<article class="card ${open ? '' : 'is-closed'}" style="--cv:${r.color};--cvi:${r.ink}">
    <div class="cover ${hasPhoto(r) ? 'has-photo' : ''}" style="${photoStyle(r)}"><div class="art">${art(r.illustration)}</div>${photoImg(r, { size: 'card' })}
      <span class="eta">${ic('clock')}${etaText(r)}</span>
      ${open ? '' : `<div class="veil"><span>Closed now<br>Opens at ${opensAt(r)}</span></div>`}
    </div>
    <div class="card-body">
      <div class="card-title"><h3>${esc(r.name)}</h3><span class="rating">${ic('star', 'fill')}${r.rating.toFixed(1)}</span></div>
      <p class="card-meta">${esc(r.label)}, ${esc(r.priceLevel)}, <span class="${r.deliveryFee ? '' : 'free'}">${feeText(r)}</span></p>
      ${match ? `<p class="match">Serves ${esc(match)}</p>` : ''}
    </div>
    <button class="card-link" type="button" data-act="open-r" data-id="${esc(r.slug)}" aria-label="${esc(r.name)}. ${esc(r.label)}. ${r.eta.min} to ${r.eta.max} minutes. ${feeText(r)}.${open ? '' : ' Closed now.'}"></button>
    <button class="fav" type="button" data-act="fav" data-id="${esc(r._id)}" aria-pressed="${fav}" aria-label="${fav ? 'Remove' : 'Save'} ${esc(r.name)} ${fav ? 'from' : 'to'} favourites">${ic('heart')}</button>
  </article>`;
}

export function renderHome() {
  const name = state.user ? firstName(state.user.name) : '';
  app().innerHTML = `
    <section class="wrap home-hero">
      <p class="kicker">${greeting()}${name ? ', ' + esc(name) : ''}</p>
      <h1>What are you craving ${momentWord()}?</h1>
      <div class="search" role="search">${ic('search')}
        <input id="q" type="search" placeholder="Search restaurants or dishes" aria-label="Search restaurants, dishes or cuisines" autocomplete="off" value="${esc(state.q)}">
        <button class="search-clear" type="button" data-act="clear-search" aria-label="Clear search" ${state.q ? '' : 'hidden'}>${ic('close')}</button>
      </div>
      <div id="live-order"></div>
      ${state.promoDismissed ? '' : `<div class="banner" id="promo-banner">
        <p><strong>New to Morsel?</strong> Take 20% off your first order with <span class="code">WELCOME20</span></p>
        <button class="btn" type="button" data-act="use-promo">Apply at checkout</button>
        <button class="x" type="button" data-act="dismiss-promo" aria-label="Dismiss offer">${ic('close')}</button>
      </div>`}
    </section>
    <section class="wrap">
      <div class="cats" role="group" aria-label="Cuisines">
        ${CATS.map(c => `<button class="cat" type="button" data-act="cat" data-id="${c.id}" aria-pressed="${state.cat === c.id}">
          <span class="ic" style="--cv:${c.color || 'var(--surface-2)'}">${c.art ? art(c.art) : ic('grid')}</span>${c.name}</button>`).join('')}
      </div>
      <div class="toolbar">
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

export function updateResults() {
  const list = filteredRestaurants();
  const cat = CATS.find(c => c.id === state.cat);
  const title = state.q.trim() ? 'Results' : state.cat === 'all' ? 'All restaurants' : cat.name;
  $('#res-title').innerHTML = `${esc(title)}<span class="count">${list.length}</span>`;
  $('#results').innerHTML = list.length
    ? `<div class="grid">${list.map(cardHTML).join('')}</div>`
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
