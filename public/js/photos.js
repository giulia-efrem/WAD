import { esc } from './util.js';

/* Photos come from the image fields in MongoDB. Unsplash photos are hotlinked from the raw URL
   the API returned (its ixid parameter is kept) with size parameters added for each place.
   While a photo loads its own colour shows behind it, then it fades in. If it fails to load,
   the restaurant's illustration shows instead and the credit is removed. */

const UTM = 'utm_source=morsel&utm_medium=referral';
export const withUtm = url => url + (url.includes('?') ? '&' : '?') + UTM;
export const UNSPLASH_HOME = withUtm('https://unsplash.com/');

export const isUnsplash = url => /^https:\/\/images\.unsplash\.com\//.test(url || '');

/* Adds w, h, fit=crop, q and auto=format to an Unsplash raw URL, keeping everything else. */
export function sizedUrl(raw, w, h, q = 75) {
  const u = new URL(raw);
  u.searchParams.set('w', String(Math.round(w)));
  if (h) u.searchParams.set('h', String(Math.round(h)));
  u.searchParams.set('fit', 'crop');
  u.searchParams.set('q', String(q));
  u.searchParams.set('auto', 'format');
  return u.toString();
}

/* Sizes for each place a photo appears: aspect ratio, widths for srcset and the sizes attribute. */
export const SIZES = {
  card: { ratio: 10 / 16, widths: [360, 480, 640, 800, 1200], sizes: '(max-width: 640px) calc(100vw - 32px), (max-width: 1100px) 46vw, 380px' },
  row: { ratio: 10 / 16, widths: [320, 480, 640, 800], sizes: '(max-width: 640px) 78vw, 320px' },
  cover: { ratio: 9 / 25, widths: [640, 960, 1280, 1600, 2000, 2560], sizes: '100vw' },
  band: { ratio: 9 / 16, widths: [480, 640, 960, 1280], sizes: '(max-width: 600px) 100vw, 640px' },
  square: { ratio: 1, widths: [160, 240, 320, 480], sizes: '(max-width: 600px) 30vw, 140px' },
  thumb: { ratio: 1, widths: [64, 104, 156], sizes: '52px' }
};

export const photoUrl = e => (e && e.image) || null;
export const hasPhoto = e => !!photoUrl(e);

/* <img> for a restaurant or dish. `alt` defaults to '' because the name is always shown next to it. */
export function photoImg(e, { size = 'card', eager = false, alt = '' } = {}) {
  const url = photoUrl(e);
  if (!url) return '';
  const load = `${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"`;
  if (!isUnsplash(url)) return `<img class="photo" src="${esc(url)}" alt="${esc(alt)}" ${load}>`;
  const s = SIZES[size] || SIZES.card;
  const srcset = s.widths.map(w => `${esc(sizedUrl(url, w, w * s.ratio))} ${w}w`).join(', ');
  const base = s.widths[Math.min(2, s.widths.length - 1)];
  return `<img class="photo" src="${esc(sizedUrl(url, base, base * s.ratio))}" srcset="${srcset}" sizes="${s.sizes}" alt="${esc(alt)}" ${load}>`;
}

/* Inline style for a photo's container: its colour shows until the image arrives. */
export const photoStyle = e => (e && e.image && e.imageColor ? `--photo-bg:${esc(e.imageColor)};` : '');

/* “Photo by NAME on Unsplash”, both links with Morsel's UTM parameters. */
export function creditHTML(e, cls = '') {
  const c = e && e.image && e.imageCredit;
  if (!c) return '';
  return `<p class="credit ${cls}">Photo by <a href="${esc(withUtm(c.profileUrl))}" target="_blank" rel="noopener">${esc(c.name)}</a> on <a href="${esc(UNSPLASH_HOME)}" target="_blank" rel="noopener">Unsplash</a></p>`;
}

document.addEventListener('load', e => {
  const t = e.target;
  if (t && t.classList && t.classList.contains('photo')) t.classList.add('is-loaded');
}, true);
document.addEventListener('error', e => {
  const t = e.target;
  if (t && t.classList && t.classList.contains('photo')) {
    const parent = t.parentElement;
    t.remove();
    if (parent) {
      parent.classList.remove('has-photo');
      const credit = parent.querySelector('.credit');
      if (credit) credit.remove();
    }
  }
}, true);
