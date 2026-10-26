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
