import { esc } from '../util.js';
import { art } from '../art.js';
import { R } from '../state.js';
import { photoImg, photoStyle, withUtm, UNSPLASH_HOME } from '../photos.js';
import { app } from '../router.js';

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
            <span><strong>${esc(c.dish || 'Restaurant cover')}</strong><br>
              <span class="muted">Photo by <a href="${esc(withUtm(c.imageCredit.profileUrl))}" target="_blank" rel="noopener">${esc(c.imageCredit.name)}</a> on <a href="${esc(UNSPLASH_HOME)}" target="_blank" rel="noopener">Unsplash</a> · <a href="${esc(withUtm(c.imageCredit.photoUrl))}" target="_blank" rel="noopener">View photo</a></span></span>
          </li>`).join('')}</ul>
      </section>`;
    }).join('') : '<p class="muted">No Unsplash photos are in use yet.</p>'}`;
}
