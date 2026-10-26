import { api } from './api.js';
import { esc, eur, clamp, hhmm } from './util.js';

/* ================= Browser storage =================
   Only the bag (with its promo code) and dismissed banners live in localStorage.
   Accounts, addresses, favourites and orders come from the server. */
const memory = {};
export const LS = {
  get(k, fallback) { try { const v = window.localStorage.getItem(k); if (v != null) return JSON.parse(v); } catch (e) { /* storage unavailable */ } return k in memory ? JSON.parse(JSON.stringify(memory[k])) : fallback; },
  set(k, v) { memory[k] = v; try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  del(k) { delete memory[k]; try { window.localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }
};
/* The browser-only version of Morsel kept accounts and orders here. They now live on the server. */
['morsel.db.users', 'morsel.db.orders', 'morsel.session', 'morsel.promo'].forEach(k => LS.del(k));

const emptyCart = () => ({ restaurantSlug: null, lines: [], promo: null });
function loadCart() {
  const c = LS.get('morsel.cart', null);
  if (!c || !Array.isArray(c.lines) || !('restaurantSlug' in c) || c.lines.some(l => !l.itemSlug || !l.sel)) return emptyCart();
  return { restaurantSlug: c.restaurantSlug, lines: c.lines, promo: c.promo || null };
}

/* ================= App state ================= */
export const state = {
  user: null,
  orderCount: 0,
  view: 'home',
  params: {},
  q: '', cat: 'all', sort: 'recommended', openNow: false, freeDel: false, topRated: false,
  cart: loadCart(),
  promoDismissed: LS.get('morsel.promoDismissed', false),
  tip: 100,
  co: { addressId: null, when: 'asap', slot: '', pay: 'card', note: '' },
  acctTab: 'orders',
  refreshOrder: null
};

/* ================= Catalog ================= */
export const CATS = [
  { id: 'all', name: 'All' },
  { id: 'pizza', name: 'Pizza', art: 'pizza', color: '#FFE2D1' },
  { id: 'burgers', name: 'Burgers', art: 'burger', color: '#FFE9B8' },
  { id: 'asian', name: 'Ramen', art: 'ramen', color: '#DCE8FB' },
  { id: 'sushi', name: 'Sushi', art: 'sushi', color: '#DDF1EE' },
  { id: 'healthy', name: 'Healthy', art: 'bowl', color: '#DDF3E1' },
  { id: 'mexican', name: 'Mexican', art: 'taco', color: '#FFF0C4' },
  { id: 'indian', name: 'Indian', art: 'curry', color: '#FFE4CC' },
  { id: 'breakfast', name: 'Breakfast', art: 'breakfast', color: '#FFF4D6' },
  { id: 'desserts', name: 'Desserts', art: 'cupcake', color: '#FCE0EC' }
];

export const catalog = { list: [], menus: new Map() };
export const R = slug => catalog.list.find(r => r.slug === slug) || null;
export const RById = id => catalog.list.find(r => r._id === id) || null;
export const menuOf = slug => catalog.menus.get(slug) || null;
export const findItem = (detail, itemSlug) => { for (const s of detail.menu) for (const it of s.items) if (it.slug === itemSlug) return it; return null; };

export async function loadRestaurants() {
  catalog.list = await api.restaurants();
  return catalog.list;
}
/* Loads a full menu once, and brings any bag lines from that restaurant up to today's prices. */
export async function loadMenu(slug, { fresh = false } = {}) {
  if (!fresh && catalog.menus.has(slug)) return catalog.menus.get(slug);
  const detail = await api.restaurant(slug);
  catalog.menus.set(slug, detail);
  const i = catalog.list.findIndex(r => r.slug === slug);
  if (i >= 0) { const { menu, ...card } = detail; catalog.list[i] = Object.assign({}, catalog.list[i], card); }
  if (state.cart.restaurantSlug === slug) repriceCart(detail);
  return detail;
}

export const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const isOpen = (r, m = nowMin()) => r.hours.some(({ open: o, close: c }) => (m >= o && m < c) || (c > 1440 && m < c - 1440));
export const opensAt = r => hhmm(r.hours[0].open);
export const closesAt = r => hhmm(r.hours[0].close);
export const is247 = r => r.hours[0].open === 0 && r.hours[0].close === 1440;
export const hoursText = r => is247(r) ? 'Open 24 hours' : `${opensAt(r)} to ${closesAt(r)}`;
export const etaText = r => `${r.eta.min}-${r.eta.max} min`;
export const feeText = r => r.deliveryFee ? `${eur(r.deliveryFee)} delivery` : 'Free delivery';

/* ================= Options ================= */
/* `sel` maps option group keys to a choice id (single choice) or a list of ids (several). */
export function selectedOptions(item, sel) {
  const options = [];
  let unit = item.price;
  for (const g of item.optionGroups) {
    const picked = g.type === 'one' ? [sel[g.key]] : (sel[g.key] || []);
    for (const c of g.choices) {
      if (!picked.includes(c.id)) continue;
      options.push({ group: g.name, choice: c.name, price: c.price });
      unit += c.price;
    }
  }
  return { options, unitPrice: unit };
}
export const lineKey = (itemSlug, sel, note) =>
  [itemSlug, Object.entries(sel).flatMap(([g, v]) => (Array.isArray(v) ? v : [v]).map(c => g + ':' + c)).sort().join('+'), note].join('|');

function selIsValid(item, sel) {
  return item.optionGroups.every(g => g.type === 'one'
    ? g.choices.some(c => c.id === sel[g.key])
    : (sel[g.key] || []).every(id => g.choices.some(c => c.id === id)) && (sel[g.key] || []).length <= g.max)
    && Object.keys(sel).every(k => item.optionGroups.some(g => g.key === k));
}

/* ================= Cart ================= */
export const MAX_QTY = 20;
export const cartCount = () => state.cart.lines.reduce((n, l) => n + l.qty, 0);
export const cartSubtotal = () => state.cart.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
export const qtyOfItem = (slug, itemSlug) => state.cart.restaurantSlug === slug ? state.cart.lines.filter(l => l.itemSlug === itemSlug).reduce((n, l) => n + l.qty, 0) : 0;

const cartListeners = [];
export const onCartChanged = fn => cartListeners.push(fn);
export function saveCart() {
  if (!state.cart.lines.length) state.cart.restaurantSlug = null;
  LS.set('morsel.cart', state.cart);
  cartListeners.forEach(fn => fn());
}
export function clearCart() { state.cart = emptyCart(); saveCart(); }
export function resetCartKeepPromo() { state.cart = Object.assign(emptyCart(), { promo: state.cart.promo }); }
export function setPromo(code) { state.cart.promo = code; LS.set('morsel.cart', state.cart); }

function repriceCart(detail) {
  let changed = false;
  state.cart.lines = state.cart.lines.filter(l => {
    const it = findItem(detail, l.itemSlug);
    if (!it || !selIsValid(it, l.sel)) { changed = true; return false; }
    const { options, unitPrice } = selectedOptions(it, l.sel);
    if (unitPrice !== l.unitPrice || it.name !== l.name) changed = true;
    Object.assign(l, { name: it.name, unitPrice, options });
    return true;
  });
  if (changed) saveCart();
}

/* ================= Pricing (display only, the server recalculates everything) ================= */
export function promoError(code, r) {
  if (code === 'WELCOME20') {
    if (!state.user) return 'Log in to use WELCOME20.';
    if (state.orderCount > 0) return 'WELCOME20 is for your first order only.';
    return '';
  }
  if (code === 'FREEDEL') {
    if (r && !r.deliveryFee) return 'Delivery from this restaurant is already free.';
    return '';
  }
  return 'That code isn’t valid. Check the spelling and try again.';
}
export function pricing(withExtras) {
  const r = R(state.cart.restaurantSlug);
  const subtotal = cartSubtotal();
  if (!r || !subtotal) return { subtotal: 0, deliveryFee: 0, serviceFee: 0, smallOrderFee: 0, discount: 0, deliveryDiscount: 0, tip: 0, total: 0 };
  const deliveryFee = r.deliveryFee;
  const smallOrderFee = Math.max(0, r.minOrder - subtotal);
  const serviceFee = clamp(Math.round(subtotal * 0.05), 49, 199);
  let discount = 0, deliveryDiscount = 0;
  const promo = state.cart.promo;
  if (withExtras && promo && !promoError(promo, r)) {
    if (promo === 'WELCOME20') discount = Math.min(800, Math.round(subtotal * 0.2));
    if (promo === 'FREEDEL') deliveryDiscount = deliveryFee;
  }
  const tip = withExtras ? state.tip : 0;
  return { subtotal, deliveryFee, serviceFee, smallOrderFee, discount, deliveryDiscount, tip, total: subtotal + deliveryFee + serviceFee + smallOrderFee - discount - deliveryDiscount + tip };
}
export function priceRows(p, opts = {}) {
  const rows = [];
  rows.push(['Subtotal', eur(p.subtotal)]);
  rows.push(['Delivery', p.deliveryFee === 0 ? '<span class="free">Free</span>' : p.deliveryDiscount ? `<span class="strike">${eur(p.deliveryFee)}</span><span class="free">Free</span>` : eur(p.deliveryFee)]);
  rows.push(['Service fee', eur(p.serviceFee)]);
  if (p.smallOrderFee) rows.push(['Small order fee', eur(p.smallOrderFee)]);
  if (p.discount) rows.push([`Promo ${esc(state.cart.promo || opts.promo || '')}`, `<span class="neg">−${eur(p.discount)}</span>`]);
  if (opts.tip) rows.push(['Courier tip', eur(p.tip)]);
  return `<dl class="rows">${rows.map(([a, b]) => `<div class="row"><dt>${a}</dt><dd>${b}</dd></div>`).join('')}<div class="row total"><dt>${opts.totalLabel || 'Total'}</dt><dd>${eur(p.total)}</dd></div></dl>`;
}

export const isFav = r => !!(state.user && r && state.user.favorites.includes(r._id));
