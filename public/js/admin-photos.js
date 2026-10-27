import { $, esc } from './util.js';
import './topbar.js';
import { art } from './art.js';
import { api, ApiError } from './api.js';
import { sizedUrl, withUtm, creditHTML, photoImg, photoStyle } from './photos.js';

/* /admin/photos: review the Unsplash photo of every restaurant and dish. Clicking a saved
   candidate makes it the photo (the server triggers its Unsplash download event). "Search again"
   runs one new search; "Remove" leaves the illustration. The browser never calls Unsplash. */

const root = $('#admin');
let entries = [];
let quota = null;
let filter = 'all';
const busy = new Set();

for (const a of document.querySelectorAll('.admin-nav a')) if (a.getAttribute('href') === location.pathname) a.setAttribute('aria-current', 'page');

let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
}

async function request(method, url, body) {
  const res = await fetch('/api' + url, {
    method, credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) { const e = (data && data.error) || {}; throw new ApiError(e.code || 'server_error', e.message || 'Something went wrong.', res.status); }
  return data;
}

function quotaText() {
  if (!quota) return '';
  if (!quota.keySet) return 'UNSPLASH_ACCESS_KEY is not set in .env, so searching and choosing are off.';
  const left = quota.remaining == null ? 'Unsplash requests left: shown after the first request' : `${quota.remaining} of ${quota.limit || 50} Unsplash requests left this hour`;
  return `${left}. The photo script used ${quota.scriptLastHour} in the last hour. Choosing a photo or searching uses 1.`;
}

const visible = () => entries.filter(e =>
  filter === 'missing' ? !e.photo.image : filter === 'covers' ? e.kind === 'cover' : filter === 'popular' ? e.popular : true);

function candidateHTML(e, c) {
  const current = e.photo.unsplashId === c.id;
  const usedElsewhere = !!c.usedBy;
  const w = 240, h = e.kind === 'cover' ? 150 : 240;
  return `<li class="cand ${current ? 'is-current' : ''}">
    <button type="button" class="cand-btn" data-choose="${esc(c.id)}" data-key="${esc(e.key)}" style="--photo-bg:${esc(c.color || '#ccc')}"
      ${current || usedElsewhere ? 'disabled' : ''} aria-label="${current ? 'Current photo' : usedElsewhere ? `Used for ${esc(c.usedBy)}` : 'Use this photo'}: ${esc(c.alt || 'no description')}, by ${esc(c.user.name)}">
      <img class="photo" src="${esc(sizedUrl(c.raw, w, h, 60))}" srcset="${esc(sizedUrl(c.raw, w * 2, h * 2, 50))} 2x" alt="" loading="lazy" decoding="async">
      ${current ? '<span class="cand-tag">Current</span>' : usedElsewhere ? `<span class="cand-tag muted-tag">In use</span>` : ''}
    </button>
    <a class="cand-by" href="${esc(withUtm(c.page))}" target="_blank" rel="noopener">${esc(c.user.name)}</a>
  </li>`;
}

function entryHTML(e) {
  const r = e.restaurant;
  const cover = e.kind === 'cover';
  const isBusy = busy.has(e.key);
  return `<article class="rv ${isBusy ? 'busy' : ''}" data-key="${esc(e.key)}">
    <div class="rv-current">
      <div class="photo-preview ${cover ? '' : 'square'} ${e.photo.image ? 'has-photo' : ''}" style="--cv:${r.color};--cvi:${r.ink};${photoStyle(e.photo)}">
        <div class="art">${art(r.illustration)}</div>${photoImg(e.photo, { size: cover ? 'card' : 'square' })}
      </div>
      ${e.photo.image ? creditHTML(e.photo) : `<p class="credit">${e.removed ? 'Removed. The illustration shows instead.' : 'No photo yet. The illustration shows instead.'}</p>`}
    </div>
    <div class="rv-main">
      <div class="rv-head">
        <div><h3>${esc(e.name)}${e.popular ? ' <span class="tag-pop">Popular</span>' : ''}</h3>
          <p class="muted">${cover ? 'Restaurant cover' : esc(r.name)} · ${e.searched ? `searched “${esc(e.searched)}”${e.custom ? ' (your search)' : ''}` : 'not searched yet'}</p></div>
        ${e.photo.image ? `<button class="btn btn-sm btn-outline" type="button" data-remove="${esc(e.key)}">Remove photo</button>` : ''}
      </div>
      ${e.candidates.length ? `<ul class="cands ${cover ? 'wide' : ''}">${e.candidates.map(c => candidateHTML(e, c)).join('')}</ul>`
        : `<p class="muted rv-empty">${e.fetchedAt ? 'That search found nothing. Try different words.' : 'Not searched yet. The photo script will get to it, or search now.'}</p>`}
      <form class="rv-search" data-key="${esc(e.key)}" novalidate>
        <label class="visually-hidden" for="q-${esc(e.key)}">Search Unsplash for ${esc(e.name)}</label>
        <input class="input" id="q-${esc(e.key)}" name="q" value="${esc(e.query || '')}" maxlength="80" autocomplete="off">
        <button class="btn btn-sm btn-secondary" type="submit">Search again</button>
      </form>
    </div>
  </article>`;
}

function draw() {
  const withPhoto = entries.filter(e => e.photo.image).length;
  const list = visible();
  const groups = [];
  for (const e of list) {
    const g = groups[groups.length - 1];
    if (g && g.slug === e.restaurant.slug) g.items.push(e); else groups.push({ slug: e.restaurant.slug, name: e.restaurant.name, items: [e] });
  }
  root.innerHTML = `
    <h1 class="page-title">Review photos</h1>
    <p class="muted admin-intro">Every restaurant cover and dish with its Unsplash photo and the other saved results. Click a result to use it. Photos are hotlinked from Unsplash and credited to the photographer; each one is used only once.</p>
    <p class="quota" id="quota">${esc(quotaText())}</p>
    <div class="admin-toolbar">
      <span class="count">${withPhoto} of ${entries.length} have a photo</span>
      ${[['all', 'All'], ['missing', 'Missing'], ['covers', 'Covers'], ['popular', 'Popular dishes']].map(([k, l]) => `<button class="pill" type="button" data-filter="${k}" aria-pressed="${filter === k}">${l}</button>`).join('')}
      <a class="link-btn" href="/credits">Credits page</a>
    </div>
    ${groups.length ? groups.map(g => `<section class="rv-group" aria-labelledby="g-${esc(g.slug)}"><h2 id="g-${esc(g.slug)}">${esc(g.name)}</h2>${g.items.map(entryHTML).join('')}</section>`).join('')
      : '<div class="empty"><h3>Nothing here</h3><p>Every item in this view has a photo.</p></div>'}`;
}

function replaceEntry(entry) {
  const i = entries.findIndex(e => e.key === entry.key);
  if (i >= 0) entries[i] = entry;
}
function redrawEntry(key) {
  const el = root.querySelector(`.rv[data-key="${CSS.escape(key)}"]`);
  const e = entries.find(x => x.key === key);
  if (el && e) el.outerHTML = entryHTML(e);
  const q = $('#quota');
  if (q) q.textContent = quotaText();
  const count = root.querySelector('.admin-toolbar .count');
  if (count) count.textContent = `${entries.filter(x => x.photo.image).length} of ${entries.length} have a photo`;
}

async function act(key, fn, okMsg) {
  if (busy.has(key)) return;
  busy.add(key); redrawEntry(key);
  try {
    const data = await fn();
    quota = data.quota;
    replaceEntry(data.entry);
    if (okMsg) toast(okMsg);
    busy.delete(key);
    /* Reload everything: other entries may now show this photo as “In use”. */
    const y = window.scrollY; await reload(); window.scrollTo(0, y);
  } catch (err) {
    busy.delete(key); redrawEntry(key);
    toast(err.message);
  }
}

root.addEventListener('click', e => {
  const f = e.target.closest('[data-filter]');
  if (f) { filter = f.dataset.filter; draw(); return; }
  const c = e.target.closest('[data-choose]');
  if (c) { act(c.dataset.key, () => request('POST', '/admin/photos/choose', { key: c.dataset.key, photoId: c.dataset.choose }), 'Photo updated'); return; }
  const rm = e.target.closest('[data-remove]');
  if (rm) act(rm.dataset.remove, () => request('POST', '/admin/photos/remove', { key: rm.dataset.remove }), 'Photo removed');
});
root.addEventListener('submit', e => {
  const form = e.target.closest('.rv-search');
  if (!form) return;
  e.preventDefault();
  const query = form.elements.q.value.trim();
  if (query.length < 2) { toast('Type at least 2 characters to search.'); return; }
  act(form.dataset.key, () => request('POST', '/admin/photos/search', { key: form.dataset.key, query }), `Searched for “${query}”`);
});

async function reload() {
  const data = await request('GET', '/admin/photos');
  entries = data.entries;
  quota = data.quota;
  draw();
}

function loginForm() {
  root.innerHTML = `<section class="panel admin-login">
    <h1 class="page-title" style="margin-top:0">Admin login</h1>
    <p class="muted">Log in with the admin account to review photos.</p>
    <form id="login" novalidate>
      <p class="form-error" id="login-err" role="alert"></p>
      <div class="field"><label for="l-email">Email</label><input class="input" id="l-email" type="email" autocomplete="email" autofocus></div>
      <div class="field"><label for="l-pass">Password</label><input class="input" id="l-pass" type="password" autocomplete="current-password"></div>
      <button class="btn btn-primary btn-block" type="submit">Log in</button>
    </form>
  </section>`;
  $('#login').addEventListener('submit', async e => {
    e.preventDefault();
    try { start(await api.logIn({ email: $('#l-email').value, password: $('#l-pass').value })); }
    catch (err) { $('#login-err').textContent = err.message; }
  });
}

async function start(user) {
  $('#who').textContent = user ? `Signed in as ${user.email}` : '';
  if (!user) { loginForm(); return; }
  if (user.role !== 'admin') {
    root.innerHTML = `<div class="empty"><h3>This page is for the admin</h3><p>You’re signed in as ${esc(user.email)}. Only admin accounts can review photos. An admin can change your role, or run npm run make-admin.</p><a class="btn btn-primary" href="/">Back to Morsel</a></div>`;
    return;
  }
  root.innerHTML = '<div class="empty"><span class="spinner" style="margin:0 auto"></span></div>';
  try { await reload(); }
  catch (err) { root.innerHTML = `<div class="empty"><h3>Couldn’t load photos</h3><p>${esc(err.message)}</p></div>`; }
}

api.me().then(start).catch(err => { root.innerHTML = `<div class="empty"><h3>Morsel couldn’t load</h3><p>${esc(err.message)}</p></div>`; });
