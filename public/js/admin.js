import { $, $$, esc, eur } from './util.js';
import { ic, art } from './art.js';
import { api } from './api.js';
import { photoImg } from './photos.js';

/* /admin: lists every restaurant and dish and sets its photo from a pasted URL or an upload. */

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 8 * 1024 * 1024;
const root = $('#admin');
let restaurants = [];
let missingOnly = false;
const open = new Set();

let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3600);
}

const findEntry = (slug, itemSlug) => {
  const r = restaurants.find(x => x.slug === slug);
  if (!r || !itemSlug) return r;
  for (const s of r.menu) for (const it of s.items) if (it.slug === itemSlug) return it;
  return null;
};
const allEntries = () => restaurants.flatMap(r => [r, ...r.menu.flatMap(s => s.items)]);

function preview(r, img) {
  return `<div class="photo-preview ${img ? 'has-photo' : ''}" style="--cv:${r.color};--cvi:${r.ink}"><div class="art">${art(r.illustration)}</div>${photoImg(img, true)}</div>`;
}
function form(slug, itemSlug, img, label) {
  return `<form class="ph-form" data-r="${esc(slug)}" data-i="${esc(itemSlug || '')}" novalidate>
    <label class="visually-hidden" for="u-${esc(slug)}-${esc(itemSlug || '')}">Image URL for ${esc(label)}</label>
    <input class="input" id="u-${esc(slug)}-${esc(itemSlug || '')}" name="url" type="url" inputmode="url" placeholder="https://… image URL" value="${esc(img && !img.startsWith('/uploads/') ? img : '')}" autocomplete="off">
    <div class="ph-row">
      <button class="btn btn-sm btn-secondary" type="submit">Save URL</button>
      <label class="btn btn-sm btn-outline file-label">${ic('camera')}Upload<input class="visually-hidden" type="file" accept="${TYPES.join(',')}" data-file></label>
      ${img ? '<button class="btn btn-sm btn-outline" type="button" data-remove>Remove</button>' : ''}
    </div>
    <p class="err" role="alert"></p>
  </form>`;
}

function restaurantHTML(r) {
  const dishes = r.menu.flatMap(s => s.items).filter(it => !missingOnly || !it.image);
  const set = r.menu.reduce((n, s) => n + s.items.filter(it => it.image).length, 0) + (r.image ? 1 : 0);
  const total = 1 + r.menu.reduce((n, s) => n + s.items.length, 0);
  return `<details class="a-rest" data-slug="${esc(r.slug)}" ${open.has(r.slug) ? 'open' : ''}>
    <summary><span class="set-dot ${set === total ? 'on' : ''}" aria-hidden="true"></span><div><h2>${esc(r.name)}</h2><span class="muted">${set} of ${total} photos set</span></div>${ic('chevron', 'chev')}</summary>
    ${!missingOnly || !r.image ? `<div class="a-cover">
      ${preview(r, r.image)}
      <div><p class="a-sub" style="margin-top:0">Cover photo</p><p class="muted" style="margin:0 0 12px;font-size:.92rem">Wide shots look best. Shown on the restaurant card and page.</p>${form(r.slug, null, r.image, r.name + ' cover')}</div>
    </div>` : ''}
    ${dishes.length ? `<p class="a-sub">Dishes</p><div class="a-dishes">${dishes.map(it => `
      <div class="a-dish">
        ${preview(r, it.image)}
        <h3>${esc(it.name)}</h3><p class="muted">${eur(it.price)}</p>
        ${form(r.slug, it.slug, it.image, it.name)}
      </div>`).join('')}</div>` : ''}
  </details>`;
}

function draw() {
  const entries = allEntries();
  const set = entries.filter(e => e.image).length;
  const visible = restaurants.filter(r => !missingOnly || !r.image || r.menu.some(s => s.items.some(it => !it.image)));
  root.innerHTML = `
    <h1 class="page-title">Photos</h1>
    <p class="muted admin-intro">Set a photo for each restaurant and dish by pasting an image URL or uploading a JPG, PNG or WebP up to 8 MB. Anything without a photo, or with a link that stops working, shows the illustration instead.</p>
    <div class="admin-toolbar">
      <span class="count">${set} of ${entries.length} photos set</span>
      <button class="pill" type="button" id="missing" aria-pressed="${missingOnly}">Missing photos only</button>
      <button class="link-btn" type="button" id="expand">${open.size === restaurants.length ? 'Collapse all' : 'Expand all'}</button>
    </div>
    ${visible.length ? visible.map(restaurantHTML).join('') : '<div class="empty"><h3>Every photo is set</h3><p>Nice work. Turn off “Missing photos only” to see them all.</p></div>'}`;
}

async function save(formEl, payload) {
  const err = $('.err', formEl);
  err.textContent = '';
  formEl.classList.add('busy');
  try {
    const { r: slug, i: itemSlug } = formEl.dataset;
    const image = await api.setImage(slug, itemSlug || null, payload);
    findEntry(slug, itemSlug).image = image;
    open.add(slug);
    const y = window.scrollY;
    draw();
    window.scrollTo(0, y);
    toast(image ? 'Photo saved' : 'Photo removed');
  } catch (e) {
    formEl.classList.remove('busy');
    err.textContent = e.message;
  }
}

root.addEventListener('submit', e => {
  const f = e.target.closest('.ph-form');
  if (!f) return;
  e.preventDefault();
  const url = f.elements.url.value.trim();
  if (!url) { $('.err', f).textContent = 'Paste an image URL first, or use Remove to clear the photo.'; return; }
  if (!/^https?:\/\//i.test(url)) { $('.err', f).textContent = 'Paste a full image URL starting with https://.'; return; }
  save(f, { url });
});
root.addEventListener('change', e => {
  const input = e.target.closest('[data-file]');
  if (!input) return;
  const f = input.closest('.ph-form');
  const file = input.files && input.files[0];
  if (!file) return;
  if (!TYPES.includes(file.type)) { $('.err', f).textContent = 'Use a JPG, PNG or WebP photo.'; input.value = ''; return; }
  if (file.size > MAX_BYTES) { $('.err', f).textContent = 'That photo is too large. Use one under 8 MB.'; input.value = ''; return; }
  save(f, { file });
});
root.addEventListener('click', e => {
  if (e.target.closest('[data-remove]')) { save(e.target.closest('.ph-form'), { url: '' }); return; }
  if (e.target.closest('#missing')) { missingOnly = !missingOnly; draw(); return; }
  if (e.target.closest('#expand')) {
    if (open.size === restaurants.length) open.clear(); else restaurants.forEach(r => open.add(r.slug));
    draw();
  }
});
root.addEventListener('toggle', e => {
  const d = e.target.closest('.a-rest');
  if (!d) return;
  if (d.open) open.add(d.dataset.slug); else open.delete(d.dataset.slug);
}, true);

function loginForm(message) {
  root.innerHTML = `<section class="panel admin-login">
    <h1 class="page-title" style="margin-top:0">Admin login</h1>
    <p class="muted">${esc(message)}</p>
    <form id="login" novalidate>
      <p class="form-error" id="login-err" role="alert"></p>
      <div class="field"><label for="l-email">Email</label><input class="input" id="l-email" type="email" autocomplete="email" autofocus></div>
      <div class="field"><label for="l-pass">Password</label><input class="input" id="l-pass" type="password" autocomplete="current-password"></div>
      <button class="btn btn-primary btn-block" type="submit">Log in</button>
    </form>
  </section>`;
  $('#login').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#login button');
    btn.disabled = true;
    try {
      const user = await api.logIn({ email: $('#l-email').value, password: $('#l-pass').value });
      start(user);
    } catch (err) {
      btn.disabled = false;
      $('#login-err').textContent = err.message;
    }
  });
}

async function start(user) {
  $('#who').textContent = user ? `Signed in as ${user.email}` : '';
  if (!user) { loginForm('Log in with the admin account to manage restaurant and dish photos.'); return; }
  if (user.role !== 'admin') {
    root.innerHTML = `<div class="empty"><h3>This page is for the admin</h3><p>You’re signed in as ${esc(user.email)}. Only the account whose email matches ADMIN_EMAIL in .env can manage photos.</p><button class="btn btn-outline" type="button" id="logout">Log out</button> <a class="btn btn-primary" href="/">Back to Morsel</a></div>`;
    $('#logout').addEventListener('click', async () => { await api.logOut(); start(null); });
    return;
  }
  try { restaurants = await api.adminCatalog(); }
  catch (err) { root.innerHTML = `<div class="empty"><h3>Couldn’t load the catalog</h3><p>${esc(err.message)}</p></div>`; return; }
  draw();
}

api.me().then(start).catch(err => { root.innerHTML = `<div class="empty"><h3>Morsel couldn’t load</h3><p>${esc(err.message)}</p></div>`; });
