import { esc, eur, logoBadge } from '../util.js';
import { ic, art } from '../art.js';
import { etaText } from '../state.js';
import { search } from '../search.js';
import { hasPhoto, photoImg, photoStyle } from '../photos.js';

/* Instant suggestions under a search field: restaurants, then dishes, then "See all results".
   A combobox: arrow keys move through the list, Enter opens the highlighted one (or all
   results), Escape closes it. onPick receives { type: 'restaurant'|'dish'|'all', r, d, q }. */
export function attachSuggestions(input, { onPick, onInput } = {}) {
  const box = input.closest('.search');
  const list = document.createElement('div');
  const id = input.id + '-suggest';
  list.className = 'suggest';
  list.id = id;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Suggestions');
  list.hidden = true;
  box.appendChild(list);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', id);
  input.setAttribute('aria-expanded', 'false');

  let options = [], active = -1;
  const setActive = i => {
    active = i;
    options.forEach((o, n) => o.el.setAttribute('aria-selected', String(n === i)));
    if (i >= 0) { input.setAttribute('aria-activedescendant', options[i].el.id); options[i].el.scrollIntoView({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  };
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); setActive(-1); };
  const draw = () => {
    const q = input.value.trim();
    if (q.length < 2) { list.innerHTML = ''; options = []; close(); return; }
    const res = search(q);
    const rs = res.restaurants.slice(0, 4), ds = res.dishes.slice(0, 5);
    options = [];
    let html = '';
    if (rs.length) {
      html += `<p class="suggest-h" aria-hidden="true">Restaurants</p>`;
      html += rs.map(x => { options.push({ type: 'restaurant', r: x.r }); return `<div class="suggest-opt" role="option" id="${id}-${options.length - 1}" data-n="${options.length - 1}">
        ${logoBadge(x.r)}<span class="so-txt"><strong>${esc(x.r.name)}</strong><small>${esc(x.r.label)} · ${etaText(x.r)}${x.top ? ` · Serves ${esc(x.top.name)}` : ''}</small></span></div>`; }).join('');
    }
    if (ds.length) {
      html += `<p class="suggest-h" aria-hidden="true">Dishes</p>`;
      html += ds.map(x => { options.push({ type: 'dish', r: x.r, d: x.d }); return `<div class="suggest-opt" role="option" id="${id}-${options.length - 1}" data-n="${options.length - 1}">
        <span class="so-thumb ${hasPhoto(x.d) ? 'has-photo' : ''}" style="--cv:${x.r.color};${photoStyle(x.d)}">${art(x.r.illustration)}${photoImg(x.d, { size: 'thumb' })}</span>
        <span class="so-txt"><strong>${esc(x.d.name)}</strong><small>${esc(x.r.name)} · ${eur(x.d.price)}</small></span></div>`; }).join('');
    }
    options.push({ type: 'all', q });
    html += `<div class="suggest-opt suggest-all" role="option" id="${id}-${options.length - 1}" data-n="${options.length - 1}">${ic('search')}<span>${rs.length || ds.length ? 'See all results for' : 'Search for'} “${esc(q)}”</span></div>`;
    list.innerHTML = html;
    options.forEach((o, n) => { o.el = list.querySelector(`[data-n="${n}"]`); });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    setActive(-1);
  };
  const pick = o => { close(); onPick({ ...o, q: input.value.trim() }); };

  input.addEventListener('input', () => { draw(); if (onInput) onInput(input.value); });
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2) draw(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (list.hidden) { draw(); if (list.hidden) return; }
      e.preventDefault();
      const n = options.length;
      setActive(e.key === 'ArrowDown' ? (active + 1) % n : (active <= 0 ? n - 1 : active - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const q = input.value.trim();
      if (active >= 0) pick(options[active]);
      else if (q) pick({ type: 'all', q });
    } else if (e.key === 'Escape' && !list.hidden) {
      e.preventDefault(); e.stopPropagation(); close();
    }
  });
  /* mousedown, so the field doesn't lose focus (and close the list) before the click lands. */
  list.addEventListener('mousedown', e => {
    const opt = e.target.closest('.suggest-opt');
    if (!opt) return;
    e.preventDefault();
    pick(options[Number(opt.dataset.n)]);
  });
  list.addEventListener('mousemove', e => { const opt = e.target.closest('.suggest-opt'); if (opt && Number(opt.dataset.n) !== active) setActive(Number(opt.dataset.n)); });
  input.addEventListener('blur', () => setTimeout(close, 120));
  return { close, refresh: draw };
}
