import { api } from './api.js';
import { esc, eur, clamp, hhmm } from './util.js';

/* ================= Browser storage =================
   Only the baskets (with a promo code waiting to be applied) and dismissed banners live in
   localStorage. Accounts, addresses, favourites, orders and reviews come from the server. */
const memory = {};
export const LS = {
  get(k, fallback) { try { const v = window.localStorage.getItem(k); if (v != null) return JSON.parse(v); } catch (e) { /* storage unavailable */ } return k in memory ? JSON.parse(JSON.stringify(memory[k])) : fallback; },
  set(k, v) { memory[k] = v; try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  del(k) { delete memory[k]; try { window.localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }
};
/* The browser-only version of Morsel kept accounts and orders here. They now live on the server. */
['morsel.db.users', 'morsel.db.orders', 'morsel.session', 'morsel.promo'].forEach(k => LS.del(k));

const BASKETS_KEY = 'morsel.baskets';
const validLine = l => l && l.itemSlug && l.sel && Number.isInteger(l.qty) && l.qty > 0;

/* One basket per restaurant: { promo, baskets: { [slug]: { lines, updatedAt } } }.
   The single bag of earlier versions ('morsel.cart') becomes that restaurant's basket. */
function loadBaskets() {
  const saved = LS.get(BASKETS_KEY, null);
  const data = { promo: null, baskets: {} };
  if (saved && saved.baskets && typeof saved.baskets === 'object') {
    data.promo = saved.promo || null;
    for (const [slug, b] of Object.entries(saved.baskets)) {
      const lines = Array.isArray(b && b.lines) ? b.lines.filter(validLine) : [];
      if (lines.length) data.baskets[slug] = { lines: lines.map(l => ({ remove: [], removed: [], ...l })), updatedAt: b.updatedAt || Date.now() };
    }
  }
  const old = LS.get('morsel.cart', null);
  if (old && old.restaurantSlug && Array.isArray(old.lines)) {
    const lines = old.lines.filter(validLine).map(l => ({ ...l, remove: [], removed: [], key: lineKey(l.itemSlug, l.sel, [], l.note || '') }));
    if (lines.length && !data.baskets[old.restaurantSlug]) data.baskets[old.restaurantSlug] = { lines, updatedAt: Date.now() };
    if (old.promo && !data.promo) data.promo = old.promo;
    LS.del('morsel.cart');
    LS.set(BASKETS_KEY, data);
  }
  return data;
}

/* ================= App state ================= */
const stored = loadBaskets();
export const state = {
  user: null,
  orderCount: 0,
  view: 'home',
  params: {},
  q: '', cat: 'all', sort: 'recommended', openNow: false, freeDel: false, topRated: false,
  baskets: stored.baskets,
  promo: stored.promo,
  promoDismissed: LS.get('morsel.promoDismissed', false),
  tip: 100,
  co: { addressId: null, when: 'asap', slot: '', pay: 'card', note: '' },
  acctTab: 'orders',
  refreshOrder: null
};

/* ================= Catalog ================= */
/* Cuisine shortcuts on the home page. Each one shows the cover photo of `from` (the illustration if it has none). */
export const CATS = [
  { id: 'all', name: 'All' },
  { id: 'pizza', name: 'Pizza', art: 'pizza', color: '#FFE2D1', from: 'forno-sette' },
  { id: 'burgers', name: 'Burgers', art: 'burger', color: '#FFE9B8', from: 'smash-society' },
  { id: 'asian', name: 'Ramen', art: 'ramen', color: '#DCE8FB', from: 'bao-and-broth' },
  { id: 'sushi', name: 'Sushi', art: 'sushi', color: '#DDF1EE', from: 'kaze-sushi' },
  { id: 'healthy', name: 'Healthy', art: 'bowl', color: '#DDF3E1', from: 'green-theory' },
  { id: 'mexican', name: 'Mexican', art: 'taco', color: '#FFF0C4', from: 'taqueria-luna' },
  { id: 'indian', name: 'Indian', art: 'curry', color: '#FFE4CC', from: 'spice-route' },
  { id: 'breakfast', name: 'Breakfast', art: 'breakfast', color: '#FFF4D6', from: 'morning-club' },
  { id: 'desserts', name: 'Desserts', art: 'cupcake', color: '#FCE0EC', from: 'sweet-spot' }
];

/* The dish photographed at the top of the home page. If it has no photo, the restaurant's cover is used. */
export const HERO = { slug: 'forno-sette', item: 'margherita' };

export const catalog = { list: [], menus: new Map() };
export const R = slug => catalog.list.find(r => r.slug === slug) || null;
export const RById = id => catalog.list.find(r => r._id === id) || null;
export const menuOf = slug => catalog.menus.get(slug) || null;
export const findItem = (detail, itemSlug) => { for (const s of detail.menu) for (const it of s.items) if (it.slug === itemSlug) return it; return null; };

export async function loadRestaurants() {
  catalog.list = await api.restaurants();
  return catalog.list;
}
/* Loads a full menu once, and brings that restaurant's basket up to today's menu and prices. */
export async function loadMenu(slug, { fresh = false } = {}) {
  if (!fresh && catalog.menus.has(slug)) return catalog.menus.get(slug);
  const detail = await api.restaurant(slug);
  catalog.menus.set(slug, detail);
  const i = catalog.list.findIndex(r => r.slug === slug);
  if (i >= 0) { const { menu, ...card } = detail; catalog.list[i] = Object.assign({}, catalog.list[i], card); }
  repriceBasket(detail);
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

/* ================= Choices ================= */
/* The main choice of a dish (shown first in the dish window and in its description). */
const PRIMARY_GROUPS = ['size', 'base', 'tortilla', 'gelato', 'milk', 'fries', 'eggs', 'pancake', 'sodaSize', 'coffeeSize', 'protein', 'toastBread', 'eggsWay', 'sorbetFlavour'];
export const isPrimaryGroup = g => PRIMARY_GROUPS.includes(g.key);
/* Names of the single-choice groups (size, sauce, spice level...). Extras are the multi-choice ones. */
const SINGLE_NAMES = ['Size', 'Base', 'Tortilla', 'Flavour', 'Milk', 'Style', 'Topping', 'Sauce', 'Spice level', 'Heat', 'Served with', 'Salsa', 'Dip', 'Protein', 'Bread', 'Eggs', 'Sweetness'];

/* `sel` maps option group keys to a choice id (single choice) or a list of ids (several);
   `remove` lists ingredient ids left out. */
export function selectedOptions(item, sel, remove = []) {
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
  const removed = (item.ingredients || []).filter(i => remove.includes(i.id)).map(i => ({ id: i.id, name: i.name }));
  return { options, removed, unitPrice: unit };
}
/* Required choices still missing, e.g. ['size']. */
export const missingChoices = (item, sel) => item.optionGroups.filter(g => g.type === 'one' && !sel[g.key]);

/* A function declaration, so loading saved baskets (before this line runs) can use it.
   parts (meal deals only) is { partKey: dishSlug }. */
export function lineKey(itemSlug, sel, remove, note, parts) {
  const partsKey = parts ? Object.entries(parts).map(([k, v]) => k + '=' + v).sort().join('+') : '';
  return [itemSlug, Object.entries(sel).flatMap(([g, v]) => (Array.isArray(v) ? v : [v]).filter(Boolean).map(c => g + ':' + c)).sort().join('+'), [...(remove || [])].sort().join('+'), note, partsKey].filter((x, i) => i < 4 || x).join('|');
}

/* ================= Meal deals ================= */
/* The main part, and the dish chosen for it. */
export const mainPart = deal => deal.parts.find(p => p.main) || deal.parts[0];
/* Price of a deal for the chosen parts (plus the main dish's paid options), what those dishes
   would cost bought separately, and the saving. Mirrors the server's calculation. */
export function dealPrice(detail, item, parts, sel = {}, remove = []) {
  let unit = item.price, separately = 0;
  const info = [];
  let main = { options: [], removed: [], unitPrice: 0, extra: 0 };
  for (const part of item.deal.parts) {
    const choice = part.choices.find(c => c.itemSlug === parts[part.key]);
    if (!choice) { info.push(null); continue; }
    const dish = findItem(detail, choice.itemSlug);
    unit += choice.delta;
    separately += dish ? dish.price : choice.price;
    if (part.main && dish) { main = selectedOptions(dish, sel, remove); main.extra = main.unitPrice - dish.price; }
    info.push({ group: part.name, itemSlug: choice.itemSlug, name: dish ? dish.name : choice.name, price: choice.delta });
  }
  /* The main dish's paid options cost the same either way, so they don't change the saving. */
  return { unitPrice: unit + main.extra, options: main.options, removed: main.removed, parts: info.filter(Boolean), saving: separately - unit };
}
/* Saving with the default choices, for the menu card. */
export function dealSaving(detail, item) {
  const parts = Object.fromEntries(item.deal.parts.map(p => [p.key, p.choices[0].itemSlug]));
  return dealPrice(detail, item, parts).saving;
}

const lowerFirst = s => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
/* "Basil" -> "basil", but names that start with a proper noun keep it: "San Marzano tomato", "American cheese". */
const PROPER = ['American', 'Swiss', 'San', 'Norwegian', 'Kashmiri', 'Alphonso', 'Ligurian'];
export const ingredientWords = name => (PROPER.includes(name.split(' ')[0]) ? name : name.charAt(0).toLowerCase() + name.slice(1));
/* A basket or order line in plain words. Meal deals: "Classic smash (Smoky BBQ, no pickles) + Fries + House cola". */
export function describeLine(line) {
  const choices = describeChoices(line.options || [], line.removed || []);
  /* Order lines have parts as a list; basket lines keep { partKey: dishSlug } plus partsInfo for display. */
  const parts = Array.isArray(line.parts) ? line.parts : (line.partsInfo || []);
  if (!parts.length) return choices;
  const [first, ...rest] = parts;
  return [`${first.name}${choices ? ` (${choices})` : ''}`, ...rest.map(p => p.name)].join(' + ');
}

/* "40 cm, no basil, extra mozzarella": the single choices, then what's left out, then the extras. */
export function describeChoices(options = [], removed = []) {
  const single = options.filter(o => SINGLE_NAMES.includes(o.group));
  const extras = options.filter(o => !SINGLE_NAMES.includes(o.group));
  const parts = [...single.map(o => o.choice), ...removed.map(r => `No ${ingredientWords(r.name)}`), ...extras.map(o => o.choice)];
  return parts.map((p, i) => (i ? lowerFirst(p) : p)).join(', ');
}

function dealIsValid(detail, item, parts, sel, remove) {
  if (!item.deal || !parts) return false;
  for (const part of item.deal.parts) {
    const choice = part.choices.find(c => c.itemSlug === parts[part.key]);
    const dish = choice && findItem(detail, choice.itemSlug);
    if (!dish) return false;
    if (part.main && !selIsValid(dish, sel, remove)) return false;
  }
  return Object.keys(parts).every(k => item.deal.parts.some(p => p.key === k));
}

function selIsValid(item, sel, remove = []) {
  return item.optionGroups.every(g => g.type === 'one'
    ? g.choices.some(c => c.id === sel[g.key])
    : (sel[g.key] || []).every(id => g.choices.some(c => c.id === id)) && (sel[g.key] || []).length <= g.max)
    && Object.keys(sel).every(k => item.optionGroups.some(g => g.key === k))
    && remove.every(id => (item.ingredients || []).some(i => i.id === id && i.removable));
}

/* ================= Baskets ================= */
export const MAX_QTY = 20;
export const basketLines = slug => (state.baskets[slug] && state.baskets[slug].lines) || [];
export const basketCount = slug => basketLines(slug).reduce((n, l) => n + l.qty, 0);
export const basketSubtotal = slug => basketLines(slug).reduce((s, l) => s + l.unitPrice * l.qty, 0);
export const qtyOfItem = (slug, itemSlug) => basketLines(slug).filter(l => l.itemSlug === itemSlug).reduce((n, l) => n + l.qty, 0);
/* Non-empty baskets, most recently changed first. */
export const allBaskets = () => Object.entries(state.baskets)
  .filter(([, b]) => b.lines.length)
  .map(([slug, b]) => ({ slug, count: b.lines.reduce((n, l) => n + l.qty, 0), subtotal: b.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0), updatedAt: b.updatedAt }))
  .sort((a, b) => b.updatedAt - a.updatedAt);

const basketListeners = [];
export const onBasketChanged = fn => basketListeners.push(fn);
function saveBaskets(slug) {
  for (const [s, b] of Object.entries(state.baskets)) if (!b.lines.length) delete state.baskets[s];
  LS.set(BASKETS_KEY, { promo: state.promo, baskets: state.baskets });
  basketListeners.forEach(fn => fn(slug));
}
const touch = slug => {
  if (!state.baskets[slug]) state.baskets[slug] = { lines: [], updatedAt: Date.now() };
  state.baskets[slug].updatedAt = Date.now();
  return state.baskets[slug];
};

/* Adds a line, merging it with an identical one. Returns false if the 20-item cap was hit. */
export function addLine(slug, line) {
  const b = touch(slug);
  const same = b.lines.find(l => l.key === line.key);
  let capped = false;
  if (same) { capped = same.qty + line.qty > MAX_QTY; same.qty = Math.min(MAX_QTY, same.qty + line.qty); }
  else b.lines.push(line);
  saveBaskets(slug);
  return !capped;
}
/* Replaces a line after editing it in the dish window (merging if it now matches another one). */
export function replaceLine(slug, oldKey, line) {
  const b = touch(slug);
  const i = b.lines.findIndex(l => l.key === oldKey);
  if (i < 0) return addLine(slug, line);
  const twin = b.lines.find((l, j) => j !== i && l.key === line.key);
  if (twin) { twin.qty = Math.min(MAX_QTY, twin.qty + line.qty); b.lines.splice(i, 1); }
  else b.lines[i] = line;
  saveBaskets(slug);
  return true;
}
export function changeQty(slug, key, delta) {
  const b = touch(slug);
  const l = b.lines.find(x => x.key === key);
  if (!l) return;
  l.qty = Math.min(MAX_QTY, l.qty + delta);
  if (l.qty <= 0) b.lines = b.lines.filter(x => x !== l);
  saveBaskets(slug);
}
export function removeLine(slug, key) { const b = touch(slug); b.lines = b.lines.filter(x => x.key !== key); saveBaskets(slug); }
export function clearBasket(slug) { delete state.baskets[slug]; saveBaskets(slug); }
export function setPromo(code) { state.promo = code; saveBaskets(null); }

/* Drops lines whose dish or choices no longer exist, and updates names and prices. */
function repriceBasket(detail) {
  const b = state.baskets[detail.slug];
  if (!b) return;
  let changed = false;
  b.lines = b.lines.filter(l => {
    const it = findItem(detail, l.itemSlug);
    if (!it) { changed = true; return false; }
    if (it.kind === 'deal') {
      if (!dealIsValid(detail, it, l.parts, l.sel, l.remove || [])) { changed = true; return false; }
      const p = dealPrice(detail, it, l.parts, l.sel, l.remove || []);
      if (p.unitPrice !== l.unitPrice || it.name !== l.name) changed = true;
      Object.assign(l, { name: it.name, unitPrice: p.unitPrice, options: p.options, removed: p.removed, partsInfo: p.parts });
      return true;
    }
    if (!selIsValid(it, l.sel, l.remove || [])) { changed = true; return false; }
    const { options, removed, unitPrice } = selectedOptions(it, l.sel, l.remove || []);
    if (unitPrice !== l.unitPrice || it.name !== l.name) changed = true;
    Object.assign(l, { name: it.name, unitPrice, options, removed });
    return true;
  });
  if (changed) saveBaskets(detail.slug);
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
export function pricing(slug, withExtras) {
  const r = R(slug);
  const subtotal = basketSubtotal(slug);
  if (!r || !subtotal) return { subtotal: 0, deliveryFee: r ? r.deliveryFee : 0, serviceFee: 0, smallOrderFee: 0, discount: 0, deliveryDiscount: 0, tip: 0, total: 0 };
  const deliveryFee = r.deliveryFee;
  const smallOrderFee = Math.max(0, r.minOrder - subtotal);
  const serviceFee = clamp(Math.round(subtotal * 0.05), 49, 199);
  let discount = 0, deliveryDiscount = 0;
  const promo = state.promo;
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
  if (!opts.noService) rows.push(['Service fee', eur(p.serviceFee)]);
  if (p.smallOrderFee && !opts.noService) rows.push(['Small order fee', eur(p.smallOrderFee)]);
  if (p.discount) rows.push([`Promo ${esc(state.promo || opts.promo || '')}`, `<span class="neg">−${eur(p.discount)}</span>`]);
  if (opts.tip) rows.push(['Courier tip', eur(p.tip)]);
  return `<dl class="rows">${rows.map(([a, b]) => `<div class="row"><dt>${a}</dt><dd>${b}</dd></div>`).join('')}${opts.noTotal ? '' : `<div class="row total"><dt>${opts.totalLabel || 'Total'}</dt><dd>${eur(p.total)}</dd></div>`}</dl>`;
}

export const isFav = r => !!(state.user && r && state.user.favorites.includes(r._id));
