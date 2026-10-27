import { esc } from '../util.js';
import { art } from '../art.js';
import { R, CATS, PROMOS } from '../state.js';
import { photoImg, photoStyle, withUtm, UNSPLASH_HOME } from '../photos.js';
import { app } from '../router.js';

/* Where a photo is reused on the home page, so the credit says so. */
function alsoUsed(c) {
  if (c.dishSlug) return PROMOS.some(p => p.slug === c.restaurantSlug && p.item === c.dishSlug) ? 'Also an offer banner on the home page' : '';
  const cats = CATS.filter(x => x.from === c.restaurantSlug).map(x => x.name);
  return cats.length ? `Also the ${cats.join(' and ')} photo in the home page’s cuisine row` : '';
}

/* /credits: every Unsplash photo in the app, credited to its photographer. */
export async function renderCredits() {
  app().innerHTML = `<div class="wrap page"><h1 class="page-title">Photo credits</h1><div id="credits-list"><div class="skeleton-list">${'<div class="sk sk-line"></div>'.repeat(6)}</div></div></div>`;
  let credits;
  try {
    credits = (await (await fetch('/api/credits', { credentials: 'same-origin' })).json()).credits || [];
  } catch (e) { credits = null; }
  const box = document.getElementById('credits-list');
  if (!box) return;
  if (!credits) { box.innerHTML = '<p class="muted">The credits couldn’t be loaded. Try again in a moment.</p>'; return; }
  const groups = [];
  for (const c of credits) {
    const g = groups[groups.length - 1];
    if (g && g.slug === c.restaurantSlug) g.items.push(c); else groups.push({ slug: c.restaurantSlug, name: c.restaurant, items: [c] });
  }
  box.innerHTML = `
    <p class="lead">Food photos on Morsel come from <a href="${esc(UNSPLASH_HOME)}" target="_blank" rel="noopener">Unsplash</a>. Thank you to every photographer below. ${credits.length ? `${credits.length} photos in use.` : ''}</p>
    ${groups.length ? groups.map(g => {
      const r = R(g.slug) || { color: '#EEE', ink: '#333', illustration: 'bowl' };
      return `<section class="credit-group" aria-labelledby="cg-${esc(g.slug)}">
        <h2 id="cg-${esc(g.slug)}">${esc(g.name)}</h2>
        <ul class="credit-list">${g.items.map(c => `
          <li>
            <span class="thumb has-photo" style="--cv:${r.color};${photoStyle(c)}">${art(r.illustration)}${photoImg(c, { size: 'thumb' })}</span>
            <span><strong>${esc(c.dish || 'Restaurant cover')}</strong>${alsoUsed(c) ? `<span class="also">${esc(alsoUsed(c))}</span>` : ''}<br>
              <span class="muted">Photo by <a href="${esc(withUtm(c.imageCredit.profileUrl))}" target="_blank" rel="noopener">${esc(c.imageCredit.name)}</a> on <a href="${esc(UNSPLASH_HOME)}" target="_blank" rel="noopener">Unsplash</a> · <a href="${esc(withUtm(c.imageCredit.photoUrl))}" target="_blank" rel="noopener">View photo</a></span></span>
          </li>`).join('')}</ul>
      </section>`;
    }).join('') : '<p class="muted">No Unsplash photos are in use yet.</p>'}`;
}

/* ================= Simple content pages ================= */
const PAGES = {
  about: {
    title: 'About Morsel',
    lead: 'Morsel brings food from the best local kitchens to your door, and shows you exactly where it is on the way.',
    body: `<h2>What we do</h2><p>We work with independent restaurants, from wood-fired pizza to slow-cooked curries, and deliver their food with our own couriers. You can follow every order live, from the kitchen to your door.</p>
      <h2>A demo app</h2><p>Morsel is a demonstration project. The restaurants, prices, couriers and orders are fictional, and no payment is ever taken.</p>`
  },
  help: {
    title: 'Help',
    lead: 'Answers to the questions people ask most.',
    body: `<h2>Where is my order?</h2><p>Open <a href="/#account">your account</a> and choose the order to see it live on the map, with an estimated arrival time.</p>
      <h2>Can I change my delivery address?</h2><p>Use the address button at the top of any page to pick a saved address or add a new one before you check out.</p>
      <h2>How do promo codes work?</h2><p>Enter a code at checkout. WELCOME20 takes 20% off your first order, up to €8. FREEDEL makes delivery free where there is a delivery fee.</p>
      <h2>Something else?</h2><p>This is a demo, so there is no support team yet. In a real app, this is where you would contact us.</p>`
  },
  terms: {
    title: 'Terms of use',
    lead: 'The rules for using Morsel.',
    body: `<h2>Using Morsel</h2><p>Morsel is a demonstration app. Orders are not real and are never delivered or charged.</p>
      <h2>Your account</h2><p>Keep your password to yourself. You are responsible for what happens in your account.</p>
      <h2>Photos</h2><p>Food photos come from Unsplash and belong to their photographers, who are credited on the <a href="/credits">credits page</a>.</p>`
  },
  privacy: {
    title: 'Privacy',
    lead: 'What Morsel stores about you, and why.',
    body: `<h2>What we store</h2><p>Your name, email address, a secure hash of your password, your saved addresses, your favourite restaurants and your orders. We use them only to run the app.</p>
      <h2>In your browser</h2><p>Your bag and dismissed messages are kept in your browser so they survive a reload. A login cookie keeps you signed in; it can't be read by scripts on the page.</p>
      <h2>Photos</h2><p>Photos are shown directly from Unsplash, so your browser loads them from Unsplash's servers.</p>`
  }
};

export function renderPage(key) {
  const p = PAGES[key];
  if (!p) { renderNotFound(); return; }
  document.title = p.title === 'About Morsel' ? 'About · Morsel' : `${p.title} · Morsel`;
  app().innerHTML = `<div class="wrap page prose">
    <h1 class="page-title">${esc(p.title)}</h1>
    <span class="placeholder-note">Placeholder page</span>
    <p class="lead">${esc(p.lead)}</p>
    ${p.body}
  </div>`;
}

/* ================= 404 ================= */
export function renderNotFound() {
  document.title = 'Page not found · Morsel';
  app().innerHTML = `<div class="wrap not-found">
    <div class="empty-art">${art('cupcake')}</div>
    <p class="code">404</p>
    <h1>We couldn’t find that page</h1>
    <p>The link may be old, or the page may have moved. Everything on the menu is still one tap away.</p>
    <div class="actions"><button class="btn btn-primary" type="button" data-act="home">Browse restaurants</button><a class="btn btn-outline" href="/help">Get help</a></div>
  </div>`;
}
