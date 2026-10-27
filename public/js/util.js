/* Small helpers shared by every view (from the reference). */
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
export const eur = cents => money.format(cents / 100);
export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const pad2 = n => String(n).padStart(2, '0');
export const hhmm = mins => { const m = ((mins % 1440) + 1440) % 1440; return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`; };
export const clock = d => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const dayTime = d => `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} at ${clock(d)}`;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const initials = name => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
export const firstName = name => (name || '').trim().split(/\s+/)[0];
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* A restaurant's monogram for its logo badge: "Forno Sette" -> FS, "Bao & Broth" -> B&B, "The Sweet Spot" -> SS. */
export function monogram(name) {
  const words = (name || '').replace(/^the\s+/i, '').split(/\s+/).filter(w => /\w/.test(w) && !/^(and|of)$/i.test(w));
  const letters = words.slice(0, 2).map(w => w[0].toUpperCase());
  return /&/.test(name) && letters.length === 2 ? letters.join('&') : letters.join('');
}
export const logoBadge = (r, cls = '') => `<span class="logo-badge ${cls}" style="--lb-bg:${esc(r.color)};--lb-ink:${esc(r.ink)}" aria-hidden="true">${esc(monogram(r.name))}</span>`;

/* "Basil" -> "basil", but names that start with a proper noun keep it: "San Marzano tomato", "American cheese". */
const PROPER = ['American', 'Swiss', 'San', 'Norwegian', 'Kashmiri', 'Alphonso', 'Ligurian'];
export const ingredientWords = name => (PROPER.includes(name.split(' ')[0]) ? name : name.charAt(0).toLowerCase() + name.slice(1));
