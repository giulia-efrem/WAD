import { esc } from './util.js';

/* Photos come from the `image` field in MongoDB (set with npm run seed or at /admin).
   Without one, or when it fails to load, the restaurant's illustration shows instead. */
export const photoUrl = (r, it) => (it ? it.image : r && r.image) || null;
export const photoImg = (url, eager) => url ? `<img class="photo" src="${esc(url)}" alt="" decoding="async"${eager ? '' : ' loading="lazy"'}>` : '';

document.addEventListener('error', e => {
  const t = e.target;
  if (t && t.classList && t.classList.contains('photo')) {
    const parent = t.parentElement;
    t.remove();
    if (parent) parent.classList.remove('has-photo');
  }
}, true);
