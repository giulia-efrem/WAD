import { $, $$, esc, eur, clock, dayTime, hhmm, plural, logoBadge } from './util.js';
import { ic } from './art.js';
import { api } from './api.js';
import { openModal, closeModal, confirmDialog } from './ui.js';
import { call, toast, gate, statusChip, shortId, linesHTML, whenText, ROLE_LABEL, STATUS_LABEL } from './staff.js';

/* /admin: the dashboard. Overview, orders, restaurants, menus, users, reviews, promo codes and
   settings. Every change goes through /api/admin, which checks the admin role on each request. */

const root = $('#staff');
const SECTIONS = ['overview', 'orders', 'restaurants', 'menus', 'users', 'reviews', 'promos', 'settings'];
const STATUSES = ['placed', 'accepted', 'preparing', 'ready', 'pickedup', 'delivered', 'cancelled'];
const KINDS = ['main', 'starter', 'side', 'drink', 'dessert', 'deal'];
const TAGS = ['vegetarian', 'vegan', 'spicy', 'gluten-free', 'contains-nuts'];
const ALLERGENS = ['gluten', 'crustaceans', 'egg', 'fish', 'peanuts', 'soy', 'milk', 'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'];
const ILLUSTRATIONS = ['pizza', 'burger', 'ramen', 'sushi', 'bowl', 'taco', 'cupcake', 'breakfast', 'curry'];
const VEHICLES = ['bike', 'scooter', 'car'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

let me = null;
let restaurants = [];
const view = { section: 'overview', param: '' };
const filters = {
  orders: { status: 'all', restaurant: '', from: '', to: '', q: '' },
  users: { q: '', role: 'all' },
  reviews: { restaurant: '', show: 'all', q: '' }
};

/* ---------- Small helpers ---------- */
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const toCents = v => { const n = Number(String(v).replace(',', '.').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
const euroField = c => (c / 100).toFixed(2);
const toMinutes = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(v || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const idOf = (name, taken = []) => { const base = (name || 'x').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'x'; let id = base, n = 2; while (taken.includes(id)) id = `${base}-${n++}`; return id; };
const compact = n => n >= 10000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n);
const eurShort = c => c >= 100000 ? `€${compact(Math.round(c / 100))}` : eur(c).replace(/\.00$/, '');
const dayLabel = d => new Date(d + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
const loading = () => { root.innerHTML = '<div class="sk sk-item" aria-busy="true"></div><div class="sk sk-item" aria-hidden="true"></div>'; };
const failed = err => { root.innerHTML = `<div class="empty"><h3>Couldn’t load this section</h3><p>${esc(err.message)}</p></div>`; };
const restaurantOptions = (sel, any = 'All restaurants') => `${any ? `<option value="">${esc(any)}</option>` : ''}${restaurants.map(r => `<option value="${esc(r.slug)}" ${sel === r.slug ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}`;
const selectHTML = (id, label, options, cls = '') => `<label class="select-wrap ${cls}"><span class="visually-hidden">${esc(label)}</span><select id="${id}">${options}</select>${ic('chevron')}</label>`;
const isOpenNow = r => { const d = new Date(); const m = d.getHours() * 60 + d.getMinutes(); return r.hours.some(h => (m >= h.open && m < h.close) || (h.close > 1440 && m < h.close - 1440)); };
const hoursText = r => r.hours.map(h => h.open === 0 && h.close === 1440 ? 'Open 24 hours' : `${hhmm(h.open)} to ${hhmm(h.close)}`).join(', ');

async function loadRestaurants() { restaurants = (await call('GET', '/admin/restaurants')).restaurants; }

/* A modal with a form. submit(form) returns true to close; errors show in the form. */
function formModal({ title, sub = '', body, submitLabel, wide = true, onOpen, submit, danger }) {
  const m = openModal(`
    <div class="modal-head"><h2 id="fm-title">${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ''}</div>
    <form class="modal-body staff-form" id="fm" novalidate>${body}<p class="form-error" id="fm-err" role="alert"></p></form>
    <div class="modal-foot">${danger ? `<button class="btn btn-outline danger-text" type="button" id="fm-danger">${esc(danger.label)}</button>` : ''}<button class="btn btn-secondary" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="fm" style="flex:1">${esc(submitLabel)}</button></div>`,
  { label: 'fm-title', wide, cls: 'admin-modal' });
  const form = $('#fm', m.wrap);
  $('[data-close]', m.wrap).addEventListener('click', () => closeModal(m));
  if (danger) $('#fm-danger', m.wrap).addEventListener('click', async () => { if (await danger.run()) closeModal(m); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('[type=submit]', m.wrap);
    $('#fm-err', m.wrap).textContent = '';
    btn.disabled = true;
    try { if (await submit(form, m)) closeModal(m); }
    catch (err) { $('#fm-err', m.wrap).textContent = err.message; $('#fm-err', m.wrap).scrollIntoView({ block: 'nearest' }); }
    btn.disabled = false;
  });
  if (onOpen) onOpen(form, m);
  return m;
}
const fail = msg => { throw new Error(msg); };

/* ================= Router ================= */

function route() {
  const [section, param = ''] = location.hash.slice(1).split('/');
  view.section = SECTIONS.includes(section) ? section : 'overview';
  view.param = decodeURIComponent(param);
  $$('#side a[data-sec]').forEach(a => { if (a.dataset.sec === view.section) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  document.title = `${cap(view.section === 'promos' ? 'Promo codes' : view.section)} · Morsel admin`;
  ({ overview: drawOverview, orders: drawOrders, restaurants: drawRestaurants, menus: drawMenus, users: drawUsers, reviews: drawReviews, promos: drawPromos, settings: drawSettings })[view.section]();
}

/* ================= Overview ================= */

/* A column chart: one series, one axis, clean ticks, the highest column labelled.
   Every column is focusable and shows its value in a tooltip. */
function columnChart({ id, title, rows, value, format, tickFormat }) {
  const max = Math.max(...rows.map(value), 1);
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const last = rows.length - 1;
  const peak = rows.findIndex(r => value(r) === Math.max(...rows.map(value)));
  return `<figure class="chart-card panel" aria-labelledby="${id}-t">
    <figcaption><h2 id="${id}-t">${esc(title)}</h2><span class="muted">Last 14 days</span></figcaption>
    <div class="cols-chart" role="list" style="--rows:${rows.length}">
      <div class="cols-grid" aria-hidden="true">${ticks.map(t => `<span style="bottom:${t / top * 100}%"><em>${esc(tickFormat(t))}</em></span>`).join('')}</div>
      ${rows.map((r, i) => {
        const v = value(r);
        return `<div class="col-slot" role="listitem" tabindex="0" aria-label="${esc(dayLabel(r.date))}: ${esc(format(v))}" data-tip="${esc(dayLabel(r.date))}|${esc(format(v))}">
          <span class="col-bar" style="height:${v / top * 100}%">${i === peak ? `<b class="col-val">${esc(format(v))}</b>` : ''}</span>
          <span class="col-x">${i % 2 === last % 2 ? esc(dayLabel(r.date).split(' ')[1]) : ''}</span></div>`;
      }).join('')}
    </div>
    <details class="chart-table"><summary>Show as a table</summary><table class="data-table"><thead><tr><th scope="col">Day</th><th scope="col">${esc(title.split(' per ')[0])}</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(dayLabel(r.date))}</td><td>${esc(format(value(r)))}</td></tr>`).join('')}</tbody></table></details>
  </figure>`;
}
function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}
/* A ranked bar list: the bar carries the magnitude, the value sits at its tip. */
function barList({ id, title, sub, rows, value, format, label, meta }) {
  const max = Math.max(...rows.map(value), 1);
  return `<section class="chart-card panel" aria-labelledby="${id}-t">
    <div class="figcap"><h2 id="${id}-t">${esc(title)}</h2><span class="muted">${esc(sub)}</span></div>
    ${rows.length ? `<ol class="bar-list">${rows.map(r => `<li data-tip="${esc(label(r))}|${esc(format(value(r)))}${meta ? ' · ' + esc(meta(r)) : ''}" tabindex="0">
      <span class="bl-name"><strong>${esc(label(r))}</strong>${meta ? `<small>${esc(meta(r))}</small>` : ''}</span>
      <span class="bl-track"><span class="bl-bar" style="width:${Math.max(1.5, value(r) / max * 100)}%"></span><b>${esc(format(value(r)))}</b></span></li>`).join('')}</ol>` : '<p class="muted">No orders in the last 30 days.</p>'}
  </section>`;
}

function delta(now, before, money) {
  if (!before) return '<span class="tile-sub">Nothing yesterday by this time</span>';
  const diff = now - before;
  const pct = Math.round(diff / before * 100);
  const word = diff === 0 ? 'Same as' : diff > 0 ? `Up ${Math.abs(pct)}% on` : `Down ${Math.abs(pct)}% on`;
  return `<span class="tile-sub">${word} yesterday by this time (${money ? eur(before) : before})</span>`;
}

async function drawOverview() {
  loading();
  let d;
  try { d = await call('GET', '/admin/overview'); } catch (err) { return failed(err); }
  if (view.section !== 'overview') return;
  const live = d.live;
  const liveTotal = Object.values(live).reduce((s, n) => s + n, 0);
  root.innerHTML = `
    <div class="staff-head"><div><h1>Overview</h1><p class="muted">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
      <a class="chip ${d.autopilot ? 'st-delivered' : 'st-placed'} chip-link" href="#settings">Demo autopilot ${d.autopilot ? 'on' : 'off'}</a></div>
    <div class="tiles tiles-4">
      <div class="tile tile-hero"><span class="tile-label">Orders today</span><strong class="tile-value">${d.today.orders}</strong>${delta(d.today.orders, d.yesterday.orders)}</div>
      <div class="tile"><span class="tile-label">Revenue today</span><strong class="tile-value">${eur(d.today.revenue)}</strong>${delta(d.today.revenue, d.yesterday.revenue, true)}</div>
      <div class="tile"><span class="tile-label">Average order value</span><strong class="tile-value">${d.today.orders ? eur(d.today.average) : '–'}</strong><span class="tile-sub">${d.today.cancelled ? `${plural(d.today.cancelled, 'cancelled order', 'cancelled orders')} not counted` : 'Cancelled orders aren’t counted'}</span></div>
      <div class="tile"><span class="tile-label">Average rating</span><strong class="tile-value">${d.rating.count ? d.rating.average.toFixed(1) : '–'}<small> / 5</small></strong><span class="tile-sub">From ${plural(d.rating.count, 'visible review', 'visible reviews')}</span></div>
    </div>
    <a class="live-strip panel" href="#orders/active"><strong>${liveTotal ? `${plural(liveTotal, 'order', 'orders')} in progress` : 'No orders in progress'}</strong>
      ${liveTotal ? `<span>${['placed', 'accepted', 'preparing', 'ready', 'pickedup'].filter(s => live[s]).map(s => `${statusChip(s)} ${live[s]}`).join(' ')}</span>` : ''}<span class="muted">See orders ${ic('back', 'flip-x')}</span></a>
    <div class="charts-2">
      ${columnChart({ id: 'ch-orders', title: 'Orders per day', rows: d.days, value: r => r.orders, format: v => plural(v, 'order', 'orders'), tickFormat: compact })}
      ${columnChart({ id: 'ch-rev', title: 'Revenue per day', rows: d.days, value: r => r.revenue, format: eur, tickFormat: eurShort })}
      ${barList({ id: 'ch-dishes', title: 'Top dishes', sub: 'By portions sold, last 30 days', rows: d.topDishes, value: r => r.qty, format: v => plural(v, 'sold', 'sold'), label: r => r.name, meta: r => r.restaurant })}
      ${barList({ id: 'ch-rest', title: 'Top restaurants', sub: 'By revenue, last 30 days', rows: d.topRestaurants, value: r => r.revenue, format: eur, label: r => r.name, meta: r => plural(r.orders, 'order', 'orders') })}
    </div>`;
}

/* One tooltip for every chart, on hover and keyboard focus. */
const tip = document.createElement('div');
tip.className = 'chart-tip';
tip.setAttribute('role', 'tooltip');
document.body.appendChild(tip);
function showTip(el) {
  const [a, b] = el.dataset.tip.split('|');
  tip.innerHTML = `<strong>${esc(a)}</strong><span>${esc(b)}</span>`;
  const box = (el.querySelector('.col-bar, .bl-bar') || el).getBoundingClientRect();
  tip.classList.add('show');
  const w = tip.offsetWidth;
  tip.style.left = `${Math.min(window.innerWidth - w - 8, Math.max(8, box.left + box.width / 2 - w / 2))}px`;
  tip.style.top = `${Math.max(8, box.top - tip.offsetHeight - 8)}px`;
}
root.addEventListener('pointerover', e => { const el = e.target.closest('[data-tip]'); if (el) showTip(el); });
root.addEventListener('pointerout', e => { if (e.target.closest('[data-tip]')) tip.classList.remove('show'); });
window.addEventListener('scroll', () => tip.classList.remove('show'), { passive: true });
root.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el) showTip(el); });
root.addEventListener('focusout', () => tip.classList.remove('show'));

/* ================= Orders ================= */

let ordersPage = 1;
async function drawOrders() {
  const f = filters.orders;
  if (view.param === 'active') { f.status = 'active'; view.param = ''; history.replaceState(null, '', '#orders'); }
  root.innerHTML = `
    <div class="staff-head"><div><h1>Orders</h1><p class="muted" id="o-count">Loading…</p></div></div>
    <form class="filter-bar" id="o-filters" role="search">
      ${selectHTML('of-status', 'Status', `<option value="all">All statuses</option><option value="active" ${f.status === 'active' ? 'selected' : ''}>In progress</option>${STATUSES.map(s => `<option value="${s}" ${f.status === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}`)}
      ${selectHTML('of-rest', 'Restaurant', restaurantOptions(f.restaurant))}
      <label class="date-field"><span>From</span><input class="input" type="date" id="of-from" value="${esc(f.from)}"></label>
      <label class="date-field"><span>To</span><input class="input" type="date" id="of-to" value="${esc(f.to)}"></label>
      <label class="search-field"><span class="visually-hidden">Search orders</span>${ic('search')}<input class="input" type="search" id="of-q" placeholder="Customer, street or order number" value="${esc(f.q)}"></label>
    </form>
    <div class="table-wrap"><table class="data-table orders-table"><thead><tr><th scope="col">Order</th><th scope="col">Placed</th><th scope="col">Restaurant</th><th scope="col">Customer</th><th scope="col" class="num">Total</th><th scope="col">Status</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead><tbody id="o-rows"></tbody></table></div>
    <button class="btn btn-secondary" type="button" id="o-more" hidden>Show more orders</button>`;
  const read = () => { f.status = $('#of-status').value; f.restaurant = $('#of-rest').value; f.from = $('#of-from').value; f.to = $('#of-to').value; f.q = $('#of-q').value.trim(); };
  let t = 0;
  $('#o-filters').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { if (view.section === 'orders') { read(); loadOrders(1); } }, 250); });
  $('#o-filters').addEventListener('submit', e => { e.preventDefault(); read(); loadOrders(1); });
  $('#o-more').addEventListener('click', () => loadOrders(ordersPage + 1));
  loadOrders(1);
}
async function loadOrders(page) {
  const f = filters.orders;
  const qs = new URLSearchParams({ status: f.status, page, ...(f.restaurant ? { restaurant: f.restaurant } : {}), ...(f.from ? { from: f.from } : {}), ...(f.to ? { to: f.to } : {}), ...(f.q ? { q: f.q } : {}) });
  let d;
  try { d = await call('GET', `/admin/orders?${qs}`); } catch (err) { toast(err.message); return; }
  if (view.section !== 'orders') return;
  ordersPage = page;
  $('#o-count').textContent = `${plural(d.total, 'order', 'orders')} · ${eur(d.revenue)} revenue, cancelled orders not counted`;
  const rows = d.orders.map(o => `<tr>
    <td><button class="link-btn mono" type="button" data-act="order" data-id="${esc(o._id)}">${shortId(o._id)}</button></td>
    <td>${esc(dayTime(new Date(o.createdAt)))}</td>
    <td>${esc(o.restaurantName)}</td>
    <td>${esc(o.customerName || '–')}</td>
    <td class="num">${eur(o.pricing.total)}</td>
    <td>${statusChip(o.status)}</td>
    <td><button class="btn btn-sm btn-secondary" type="button" data-act="order" data-id="${esc(o._id)}">Open</button></td></tr>`).join('');
  if (page === 1) $('#o-rows').innerHTML = rows || '<tr><td colspan="7" class="muted">No orders match these filters.</td></tr>';
  else $('#o-rows').insertAdjacentHTML('beforeend', rows);
  $('#o-more').hidden = !d.hasMore;
}

async function openOrder(id) {
  let o;
  try { o = (await call('GET', `/admin/orders/${id}`)).order; } catch (err) { toast(err.message); return; }
  const p = o.pricing;
  const m = openModal(`
    <div class="modal-head"><h2 id="od-title">Order ${shortId(o._id)} ${statusChip(o.status)}</h2><p>${esc(o.restaurantName)} · placed ${esc(dayTime(new Date(o.createdAt)))} · ${esc(whenText(o))}</p></div>
    <div class="modal-body">
      <dl class="kv">
        <div><dt>Customer</dt><dd>${esc(o.customerName || '–')}${o.customerEmail ? `<br><small>${esc(o.customerEmail)}</small>` : ''}</dd></div>
        <div><dt>Deliver to</dt><dd>${esc(o.address.street)}${o.address.details ? `, ${esc(o.address.details)}` : ''}<br><small>${esc(o.address.city)}</small></dd></div>
        <div><dt>Courier</dt><dd>${o.courier.assigned ? `${esc(o.courier.name)} (${esc(o.courier.vehicle)})${o.courierEmail ? `<br><small>${esc(o.courierEmail)}</small>` : '<br><small>Demo courier</small>'}` : 'Not assigned yet'}</dd></div>
        <div><dt>Payment</dt><dd>${o.payment === 'cash' ? 'Cash on delivery' : 'Card'}${o.promoCode ? `<br><small>Promo ${esc(o.promoCode)}</small>` : ''}</dd></div>
      </dl>
      ${o.courierNote ? `<p class="o-note">Courier note: “${esc(o.courierNote)}”</p>` : ''}
      <h3 class="sub-label">Items</h3>
      ${linesHTML(o.items)}
      <dl class="rows">
        <div class="row"><dt>Subtotal</dt><dd>${eur(p.subtotal)}</dd></div>
        <div class="row"><dt>Delivery</dt><dd>${eur(p.deliveryFee - (p.deliveryDiscount || 0))}</dd></div>
        <div class="row"><dt>Service fee</dt><dd>${eur(p.serviceFee)}</dd></div>
        ${p.smallOrderFee ? `<div class="row"><dt>Small order fee</dt><dd>${eur(p.smallOrderFee)}</dd></div>` : ''}
        ${p.discount ? `<div class="row"><dt>Discount</dt><dd>−${eur(p.discount)}</dd></div>` : ''}
        ${p.tip ? `<div class="row"><dt>Tip</dt><dd>${eur(p.tip)}</dd></div>` : ''}
        <div class="row total"><dt>Total</dt><dd>${eur(p.total)}</dd></div>
      </dl>
      <h3 class="sub-label">Timeline</h3>
      <ol class="timeline">${o.timeline.map(t => `<li><span class="t-time">${clock(new Date(t.at))}</span><span>${esc(STATUS_LABEL[t.status])} <span class="muted">by ${esc(t.by)}</span>${t.note ? ` · ${esc(t.note)}` : ''}</span></li>`).join('')}</ol>
      <form class="status-form" id="od-form" novalidate>
        <h3 class="sub-label">Change status</h3>
        <div class="status-row">${selectHTML('od-status', 'New status', STATUSES.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join(''))}
          <input class="input" id="od-reason" maxlength="160" placeholder="Reason (needed to cancel; the customer sees it)">
          <button class="btn btn-primary" type="submit">Update</button></div>
        <p class="err" role="alert"></p>
      </form>
    </div>`, { label: 'od-title', wide: true, cls: 'admin-modal' });
  $('#od-form', m.wrap).addEventListener('submit', async e => {
    e.preventDefault();
    const status = $('#od-status', m.wrap).value, reason = $('#od-reason', m.wrap).value.trim();
    if (status === o.status) { $('.err', m.wrap).textContent = 'Choose a different status.'; return; }
    if (status === 'cancelled' && !reason) { $('.err', m.wrap).textContent = 'Give a reason for cancelling. The customer sees it.'; return; }
    try {
      await call('POST', `/admin/orders/${o._id}/status`, { status, reason });
      closeModal(m);
      toast(`Order ${shortId(o._id)} is now ${STATUS_LABEL[status].toLowerCase()}`);
      if (view.section === 'orders') loadOrders(1);
    } catch (err) { $('.err', m.wrap).textContent = err.message; }
  });
}

/* ================= Restaurants ================= */

async function drawRestaurants() {
  loading();
  try { await loadRestaurants(); } catch (err) { return failed(err); }
  if (view.section !== 'restaurants') return;
  root.innerHTML = `
    <div class="staff-head"><div><h1>Restaurants</h1><p class="muted">${plural(restaurants.length, 'restaurant', 'restaurants')} · ${restaurants.filter(r => r.paused).length} paused</p></div>
      <button class="btn btn-primary" type="button" data-act="new-rest">${ic('plus')}Add restaurant</button></div>
    <div class="rest-list">${restaurants.map(r => `<article class="panel rest-row">
      <div class="rest-id">${logoBadge(r)}<div><h2>${esc(r.name)}</h2><p class="muted">${esc(r.label || r.cuisines.join(', '))} · ${esc(r.priceLevel)} · ${r.rating ? `${r.rating.toFixed(1)} ★ (${r.reviewCount})` : 'No ratings yet'}</p></div></div>
      <dl class="rest-facts">
        <div><dt>Now</dt><dd>${r.paused ? '<span class="chip st-cancelled">Paused</span>' : isOpenNow(r) ? '<span class="chip st-delivered">Open</span>' : '<span class="chip">Closed</span>'}</dd></div>
        <div><dt>Hours</dt><dd>${esc(hoursText(r))}</dd></div>
        <div><dt>Delivery fee</dt><dd>${r.deliveryFee ? eur(r.deliveryFee) : 'Free'}</dd></div>
        <div><dt>Minimum</dt><dd>${eur(r.minOrder)}</dd></div>
        <div><dt>Menu</dt><dd>${plural(r.dishes, 'item', 'items')}${r.soldOut ? `, ${r.soldOut} sold out` : ''}</dd></div>
        <div><dt>Orders today</dt><dd>${r.ordersToday}</dd></div>
      </dl>
      <div class="rest-acts">
        <button class="btn btn-sm btn-secondary" type="button" data-act="edit-rest" data-slug="${esc(r.slug)}">Edit</button>
        <a class="btn btn-sm btn-secondary" href="#menus/${esc(r.slug)}">Menu</a>
        <button class="btn btn-sm btn-outline" type="button" data-act="pause-rest" data-slug="${esc(r.slug)}" data-paused="${r.paused}">${r.paused ? 'Resume orders' : 'Pause orders'}</button>
        <a class="link-btn" href="/#r-${esc(r.slug)}" target="_blank" rel="noopener">View page</a>
      </div>
    </article>`).join('')}</div>`;
}

function hourRow(h) {
  return `<div class="hours-row"><input class="input" type="time" data-h="open" value="${hhmm(h.open)}" aria-label="Opens at"><span>to</span><input class="input" type="time" data-h="close" value="${h.close === 1440 ? '00:00' : hhmm(h.close)}" aria-label="Closes at"><button class="icon-x" type="button" data-act="del-row" aria-label="Remove these hours">${ic('close')}</button></div>`;
}

function editRestaurant(r) {
  const isNew = !r;
  r = r || { name: '', label: '', cuisines: [], tagline: '', priceLevel: '€€', eta: { min: 25, max: 35 }, deliveryFee: 199, minOrder: 1000, hours: [{ open: 660, close: 1320 }], color: '#FFE2D1', ink: '#8A3413', illustration: 'bowl', paused: false, image: '' };
  formModal({
    title: isNew ? 'Add a restaurant' : `Edit ${r.name}`,
    sub: isNew ? 'It appears on the home page straight away. Add its menu next.' : '',
    submitLabel: isNew ? 'Add restaurant' : 'Save changes',
    body: `
      <div class="grid-2">
        <div class="field"><label for="r-name">Name</label><input class="input" id="r-name" value="${esc(r.name)}" maxlength="60" required></div>
        <div class="field"><label for="r-label">Label <small>Shown on cards, e.g. “Pizza”</small></label><input class="input" id="r-label" value="${esc(r.label)}" maxlength="40"></div>
      </div>
      <div class="field"><label for="r-tag">Tagline</label><input class="input" id="r-tag" value="${esc(r.tagline)}" maxlength="140"></div>
      <div class="grid-2">
        <div class="field"><label for="r-cuis">Cuisines <small>Comma separated</small></label><input class="input" id="r-cuis" value="${esc(r.cuisines.join(', '))}"></div>
        <div class="field"><label for="r-price">Price level</label>${selectHTML('r-price', 'Price level', ['€', '€€', '€€€'].map(p => `<option ${p === r.priceLevel ? 'selected' : ''}>${p}</option>`).join(''), 'full')}</div>
      </div>
      <div class="grid-4">
        <div class="field"><label for="r-fee">Delivery fee (€)</label><input class="input" id="r-fee" inputmode="decimal" value="${euroField(r.deliveryFee)}"></div>
        <div class="field"><label for="r-min">Minimum order (€)</label><input class="input" id="r-min" inputmode="decimal" value="${euroField(r.minOrder)}"></div>
        <div class="field"><label for="r-eta1">Delivery from (min)</label><input class="input" id="r-eta1" type="number" min="5" max="120" value="${r.eta.min}"></div>
        <div class="field"><label for="r-eta2">to (min)</label><input class="input" id="r-eta2" type="number" min="5" max="180" value="${r.eta.max}"></div>
      </div>
      <fieldset class="field fs"><legend class="label">Opening hours <small>Server time. A closing time before the opening time means after midnight.</small></legend>
        <div id="r-hours">${r.hours.map(hourRow).join('')}</div>
        <button class="link-btn" type="button" data-act="add-hours">Add another opening</button></fieldset>
      <div class="grid-3">
        <div class="field"><label for="r-color">Card colour</label><input class="input color-in" id="r-color" type="color" value="${esc(r.color)}"></div>
        <div class="field"><label for="r-ink">Text colour</label><input class="input color-in" id="r-ink" type="color" value="${esc(r.ink)}"></div>
        <div class="field"><label for="r-ill">Illustration</label>${selectHTML('r-ill', 'Illustration', ILLUSTRATIONS.map(i => `<option ${i === r.illustration ? 'selected' : ''}>${i}</option>`).join(''), 'full')}</div>
      </div>
      <label class="check"><input type="checkbox" id="r-paused" ${r.paused ? 'checked' : ''}><span>Paused: shown, but not taking orders</span></label>
      ${isNew ? '' : photoFields(r.slug, null, r.image, 'Cover photo')}`,
    onOpen: form => {
      form.addEventListener('click', e => {
        if (e.target.closest('[data-act="add-hours"]')) $('#r-hours', form).insertAdjacentHTML('beforeend', hourRow({ open: 1080, close: 1320 }));
        const del = e.target.closest('[data-act="del-row"]');
        if (del && $$('.hours-row', form).length > 1) del.closest('.hours-row').remove();
      });
      bindPhoto(form);
    },
    submit: async form => {
      const v = id => $(id, form).value.trim();
      const hours = $$('.hours-row', form).map(row => {
        const open = toMinutes($('[data-h=open]', row).value), close0 = toMinutes($('[data-h=close]', row).value);
        if (Number.isNaN(open) || Number.isNaN(close0)) fail('Fill in every opening and closing time.');
        const close = close0 <= open ? close0 + 1440 : close0;
        return { open, close };
      });
      const body = {
        name: v('#r-name'), label: v('#r-label'), tagline: v('#r-tag'), priceLevel: v('#r-price'),
        cuisines: v('#r-cuis').split(',').map(s => s.trim()).filter(Boolean),
        deliveryFee: toCents(v('#r-fee')), minOrder: toCents(v('#r-min')),
        eta: { min: Number(v('#r-eta1')), max: Number(v('#r-eta2')) }, hours,
        color: v('#r-color').toUpperCase(), ink: v('#r-ink').toUpperCase(), illustration: v('#r-ill'), paused: $('#r-paused', form).checked
      };
      if (Number.isNaN(body.deliveryFee) || Number.isNaN(body.minOrder)) fail('Enter fees as amounts like 1.99.');
      if (isNew) { await call('POST', '/admin/restaurants', body); toast(`${body.name} added`); }
      else { await call('PATCH', `/admin/restaurants/${r.slug}`, body); toast('Restaurant saved'); }
      drawRestaurants();
      return true;
    }
  });
}

/* Photo by URL or upload (the old /admin page). Saves straight away, separately from the form. */
function photoFields(slug, itemSlug, image, label) {
  return `<fieldset class="field fs photo-fs" data-r="${esc(slug)}" data-i="${esc(itemSlug || '')}"><legend class="label">${esc(label)} <small>Paste an image URL or upload a JPG, PNG or WebP up to 8 MB. Saved straight away.</small></legend>
    <div class="photo-row"><span class="photo-thumb ${image ? 'has' : ''}">${image ? `<img src="${esc(image.includes('images.unsplash.com') ? image + (image.includes('?') ? '&' : '?') + 'w=160&h=120&fit=crop&auto=format' : image)}" alt="">` : 'No photo'}</span>
      <div class="photo-ctl"><input class="input" type="url" data-photo-url placeholder="https://… image URL" value="${esc(image && !image.startsWith('/uploads/') ? image : '')}" aria-label="${esc(label)} URL">
        <div class="ph-row"><button class="btn btn-sm btn-secondary" type="button" data-act="photo-url">Save URL</button><label class="btn btn-sm btn-outline file-label">${ic('camera')}Upload<input class="visually-hidden" type="file" accept="${IMAGE_TYPES.join(',')}" data-photo-file></label>${image ? '<button class="btn btn-sm btn-outline" type="button" data-act="photo-remove">Remove</button>' : ''}</div>
        <p class="err" data-photo-err role="alert"></p></div></div>
  </fieldset>`;
}
function bindPhoto(form) {
  const fs = $('.photo-fs', form);
  if (!fs) return;
  const save = async payload => {
    const err = $('[data-photo-err]', fs);
    err.textContent = '';
    try {
      const image = await api.setImage(fs.dataset.r, fs.dataset.i || null, payload);
      const thumb = $('.photo-thumb', fs);
      thumb.className = `photo-thumb ${image ? 'has' : ''}`;
      thumb.innerHTML = image ? `<img src="${esc(image)}" alt="">` : 'No photo';
      toast(image ? 'Photo saved' : 'Photo removed');
    } catch (e) { err.textContent = e.message; }
  };
  fs.addEventListener('click', e => {
    if (e.target.closest('[data-act="photo-url"]')) {
      const url = $('[data-photo-url]', fs).value.trim();
      if (!/^https?:\/\//i.test(url)) { $('[data-photo-err]', fs).textContent = 'Paste a full image URL starting with https://.'; return; }
      save({ url });
    }
    if (e.target.closest('[data-act="photo-remove"]')) save({ url: '' });
  });
  fs.addEventListener('change', e => {
    const input = e.target.closest('[data-photo-file]');
    const file = input && input.files[0];
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) { $('[data-photo-err]', fs).textContent = 'Use a JPG, PNG or WebP photo.'; return; }
    if (file.size > 8 * 1024 * 1024) { $('[data-photo-err]', fs).textContent = 'That photo is too large. Use one under 8 MB.'; return; }
    save({ file });
  });
}

/* ================= Menus ================= */

let menu = null;
async function drawMenus() {
  loading();
  try { if (!restaurants.length) await loadRestaurants(); } catch (err) { return failed(err); }
  const slug = restaurants.some(r => r.slug === view.param) ? view.param : restaurants[0] && restaurants[0].slug;
  if (!slug) { root.innerHTML = '<div class="empty"><h3>No restaurants yet</h3><p>Add a restaurant first.</p><a class="btn btn-primary" href="#restaurants">Restaurants</a></div>'; return; }
  try { menu = await call('GET', `/admin/restaurants/${slug}/menu`); } catch (err) { return failed(err); }
  if (view.section !== 'menus') return;
  const r = menu.restaurant;
  const items = r.menu.flatMap(s => s.items);
  root.innerHTML = `
    <div class="staff-head"><div><h1>Menus</h1><p class="muted">${plural(items.length, 'item', 'items')} · ${items.filter(i => i.soldOut).length} sold out · ${items.filter(i => i.kind === 'deal').length} meal deals</p></div>
      ${selectHTML('m-rest', 'Restaurant', restaurantOptions(slug, ''), 'lg')}</div>
    <div class="filter-bar"><button class="btn btn-primary" type="button" data-act="new-item">${ic('plus')}Add dish</button><button class="btn btn-secondary" type="button" data-act="new-deal">${ic('plus')}Add meal deal</button><a class="link-btn" href="/admin/photos">Find photos on Unsplash</a></div>
    ${r.menu.length ? r.menu.map(s => `<section class="panel menu-sec"><h2>${esc(s.category)} <span class="count">${s.items.length}</span></h2>
      <ul class="menu-rows">${s.items.map(it => `<li class="${it.soldOut ? 'is-sold-out' : ''}">
        <span class="m-thumb ${it.image ? 'has' : ''}">${it.image ? `<img src="${esc(it.image.includes('images.unsplash.com') ? it.image + (it.image.includes('?') ? '&' : '?') + 'w=96&h=96&fit=crop&auto=format' : it.image)}" alt="" loading="lazy">` : ''}</span>
        <div class="m-main"><strong>${esc(it.name)}</strong>${it.popular ? '<span class="tag-pop">Popular</span>' : ''}${it.kind === 'deal' ? '<span class="chip">Meal deal</span>' : ''}
          <small>${esc(cap(it.kind))}${it.tags.length ? ' · ' + esc(it.tags.join(', ')) : ''}${it.optionGroups.length ? ` · ${plural(it.optionGroups.length, 'option group', 'option groups')}` : ''}</small></div>
        <span class="m-price">${eur(it.price)}</span>
        <button class="switch-btn sm ${it.soldOut ? 'is-off' : ''}" type="button" data-act="item-soldout" data-slug="${esc(it.slug)}" aria-pressed="${!it.soldOut}" aria-label="${esc(it.name)} available"><span class="sw" aria-hidden="true"></span><span>${it.soldOut ? 'Sold out' : 'Available'}</span></button>
        <button class="btn btn-sm btn-secondary" type="button" data-act="edit-item" data-slug="${esc(it.slug)}">Edit</button>
      </li>`).join('')}</ul></section>`).join('') : '<div class="empty"><h3>No dishes yet</h3><p>Add the first dish to this menu.</p></div>'}`;
  $('#m-rest').addEventListener('change', e => { location.hash = `menus/${e.target.value}`; });
}

const findMenuItem = slug => menu.restaurant.menu.flatMap(s => s.items.map(it => ({ ...it, category: s.category }))).find(it => it.slug === slug);

function ingredientRow(i) {
  return `<div class="rep-row" data-row="ing" data-id="${esc(i.id || '')}"><input class="input" data-k="name" value="${esc(i.name)}" placeholder="Ingredient" aria-label="Ingredient"><label class="check sm"><input type="checkbox" data-k="removable" ${i.removable ? 'checked' : ''}><span>Can be left out</span></label><button class="icon-x" type="button" data-act="del-row" aria-label="Remove ingredient">${ic('close')}</button></div>`;
}
function choiceRow(c) {
  return `<div class="rep-row" data-row="choice" data-id="${esc(c.id || '')}"><input class="input" data-k="name" value="${esc(c.name)}" placeholder="Choice" aria-label="Choice name"><label class="euro-in"><span>+€</span><input class="input" data-k="price" inputmode="decimal" value="${euroField(c.price || 0)}" aria-label="Extra price"></label><button class="icon-x" type="button" data-act="del-row" aria-label="Remove choice">${ic('close')}</button></div>`;
}
function groupBlock(g) {
  return `<div class="rep-block" data-row="group" data-key="${esc(g.key || '')}">
    <div class="rep-row"><input class="input" data-k="name" value="${esc(g.name)}" placeholder="Group name, e.g. Size" aria-label="Option group name">
      <label class="select-wrap"><span class="visually-hidden">Type</span><select data-k="type"><option value="one" ${g.type === 'one' ? 'selected' : ''}>Pick one (required)</option><option value="many" ${g.type === 'many' ? 'selected' : ''}>Pick any (optional)</option></select>${ic('chevron')}</label>
      <label class="euro-in"><span>Max</span><input class="input" data-k="max" type="number" min="1" max="10" value="${g.max || g.choices.length || 3}" aria-label="Most choices allowed"></label>
      <button class="icon-x" type="button" data-act="del-block" aria-label="Remove option group">${ic('close')}</button></div>
    <div class="rep-list">${g.choices.map(choiceRow).join('')}</div>
    <button class="link-btn" type="button" data-act="add-choice">Add choice</button></div>`;
}
function partBlock(p, dishes) {
  const chosen = new Map(p.choices.map(c => [c.itemSlug, c.delta]));
  return `<div class="rep-block" data-row="part" data-key="${esc(p.key || '')}">
    <div class="rep-row"><input class="input" data-k="name" value="${esc(p.name)}" placeholder="Part name, e.g. Burger" aria-label="Part name">
      <label class="check sm"><input type="radio" name="main-part" data-k="main" ${p.main ? 'checked' : ''}><span>Main dish (customisable)</span></label>
      <button class="icon-x" type="button" data-act="del-block" aria-label="Remove part">${ic('close')}</button></div>
    <div class="deal-choices">${dishes.map(d => `<label class="deal-choice"><input type="checkbox" data-dish="${esc(d.slug)}" ${chosen.has(d.slug) ? 'checked' : ''}><span>${esc(d.name)} <small>${eur(d.price)}</small></span>
      <span class="euro-in"><span>+€</span><input class="input" data-delta inputmode="decimal" value="${euroField(chosen.get(d.slug) || 0)}" aria-label="Surcharge for ${esc(d.name)}"></span></label>`).join('')}</div>
  </div>`;
}

function editItem(slug, kind) {
  const r = menu.restaurant;
  const cats = r.menu.map(s => s.category);
  const it = slug ? findMenuItem(slug) : { name: '', description: '', price: 0, kind: kind || 'main', category: kind === 'deal' ? 'Meal deals' : (cats.find(c => c !== 'Meal deals') || 'Mains'), popular: false, soldOut: false, tags: [], allergens: [], ingredients: [], optionGroups: [], deal: kind === 'deal' ? { parts: [{ key: 'main', name: 'Main', main: true, choices: [] }, { key: 'side', name: 'Side', main: false, choices: [] }] } : null, image: '' };
  const dishes = r.menu.flatMap(s => s.items).filter(d => d.kind !== 'deal' && d.slug !== slug);
  formModal({
    title: slug ? `Edit ${it.name}` : it.kind === 'deal' ? 'Add a meal deal' : 'Add a dish',
    sub: esc(r.name),
    submitLabel: slug ? 'Save changes' : 'Add to menu',
    danger: slug ? { label: 'Delete', run: async () => {
      if (!(await confirmDialog({ title: `Delete ${esc(it.name)}?`, body: 'It disappears from the menu and from baskets. Past orders keep it.', confirm: 'Delete', cancel: 'Keep it' }))) return false;
      try { await call('DELETE', `/admin/restaurants/${r.slug}/items/${slug}`); toast(`${it.name} deleted`); drawMenus(); return true; }
      catch (err) { toast(err.message); return false; }
    } } : null,
    body: `
      <div class="grid-2">
        <div class="field"><label for="i-name">Name</label><input class="input" id="i-name" value="${esc(it.name)}" maxlength="60" required></div>
        <div class="field"><label for="i-cat">Category</label><input class="input" id="i-cat" list="i-cats" value="${esc(it.category)}" maxlength="40"><datalist id="i-cats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      </div>
      <div class="field"><label for="i-desc">Description</label><textarea class="input" id="i-desc" maxlength="240">${esc(it.description)}</textarea></div>
      <div class="grid-3">
        <div class="field"><label for="i-price">Price (€)</label><input class="input" id="i-price" inputmode="decimal" value="${euroField(it.price)}"></div>
        <div class="field"><label for="i-kind">Kind</label>${selectHTML('i-kind', 'Kind', KINDS.map(k => `<option value="${k}" ${k === it.kind ? 'selected' : ''}>${k === 'deal' ? 'Meal deal' : cap(k)}</option>`).join(''), 'full')}</div>
        <div class="field checks-col"><label class="check"><input type="checkbox" id="i-pop" ${it.popular ? 'checked' : ''}><span>Popular</span></label><label class="check"><input type="checkbox" id="i-sold" ${it.soldOut ? 'checked' : ''}><span>Sold out</span></label></div>
      </div>
      <fieldset class="field fs"><legend class="label">Dietary tags</legend><div class="check-grid">${TAGS.map(t => `<label class="check"><input type="checkbox" data-tag="${t}" ${it.tags.includes(t) ? 'checked' : ''}><span>${cap(t.replace('-', ' '))}</span></label>`).join('')}</div></fieldset>
      <fieldset class="field fs"><legend class="label">Allergens</legend><div class="check-grid">${ALLERGENS.map(a => `<label class="check"><input type="checkbox" data-allergen="${a}" ${it.allergens.includes(a) ? 'checked' : ''}><span>${cap(a)}</span></label>`).join('')}</div></fieldset>
      <div id="i-deal" ${it.kind === 'deal' ? '' : 'hidden'}>
        <fieldset class="field fs"><legend class="label">Deal parts <small>Tick the dishes customers can pick for each part, with any surcharge</small></legend>
          <div id="i-parts">${(it.deal ? it.deal.parts : []).map(p => partBlock(p, dishes)).join('')}</div>
          <button class="link-btn" type="button" data-act="add-part">Add part</button></fieldset>
      </div>
      <div id="i-dish" ${it.kind === 'deal' ? 'hidden' : ''}>
        <fieldset class="field fs"><legend class="label">Ingredients</legend><div class="rep-list" id="i-ings">${it.ingredients.map(ingredientRow).join('')}</div><button class="link-btn" type="button" data-act="add-ing">Add ingredient</button></fieldset>
        <fieldset class="field fs"><legend class="label">Option groups <small>Sizes, extras, spice levels…</small></legend><div id="i-groups">${it.optionGroups.map(groupBlock).join('')}</div><button class="link-btn" type="button" data-act="add-group">Add option group</button></fieldset>
        ${slug ? photoFields(r.slug, slug, it.image, 'Photo') : '<p class="muted">Add a photo after saving the dish.</p>'}
      </div>`,
    onOpen: form => {
      $('#i-kind', form).addEventListener('change', e => { const deal = e.target.value === 'deal'; $('#i-deal', form).hidden = !deal; $('#i-dish', form).hidden = deal; });
      form.addEventListener('click', e => {
        const a = e.target.closest('[data-act]');
        if (!a) return;
        if (a.dataset.act === 'add-ing') $('#i-ings', form).insertAdjacentHTML('beforeend', ingredientRow({ name: '', removable: true }));
        if (a.dataset.act === 'add-group') $('#i-groups', form).insertAdjacentHTML('beforeend', groupBlock({ name: '', type: 'one', choices: [{ name: '', price: 0 }] }));
        if (a.dataset.act === 'add-choice') $('.rep-list', a.closest('.rep-block')).insertAdjacentHTML('beforeend', choiceRow({ name: '', price: 0 }));
        if (a.dataset.act === 'add-part') $('#i-parts', form).insertAdjacentHTML('beforeend', partBlock({ name: '', main: false, choices: [] }, dishes));
        if (a.dataset.act === 'del-row') a.closest('.rep-row').remove();
        if (a.dataset.act === 'del-block') a.closest('.rep-block').remove();
      });
      bindPhoto(form);
    },
    submit: async form => {
      const kindV = $('#i-kind', form).value;
      const body = {
        name: $('#i-name', form).value.trim(), category: $('#i-cat', form).value.trim(), description: $('#i-desc', form).value.trim(),
        price: toCents($('#i-price', form).value), kind: kindV, popular: $('#i-pop', form).checked, soldOut: $('#i-sold', form).checked,
        tags: $$('[data-tag]:checked', form).map(x => x.dataset.tag), allergens: $$('[data-allergen]:checked', form).map(x => x.dataset.allergen)
      };
      if (!body.name) fail('Enter the dish name.');
      if (!body.category) fail('Choose a category.');
      if (Number.isNaN(body.price)) fail('Enter the price as an amount like 9.50.');
      if (kindV === 'deal') {
        const keys = [];
        const parts = $$('#i-parts > .rep-block', form).map(b => {
          const name = $('[data-k=name]', b).value.trim();
          if (!name) fail('Every part of the deal needs a name.');
          const key = b.dataset.key || idOf(name, keys); keys.push(key);
          const choices = $$('.deal-choice', b).filter(l => $('[data-dish]', l).checked).map(l => ({ itemSlug: $('[data-dish]', l).dataset.dish, delta: toCents($('[data-delta]', l).value) || 0 }));
          if (!choices.length) fail(`Tick at least one dish for “${name}”.`);
          return { key, name, main: $('[data-k=main]', b).checked, choices };
        });
        if (parts.length < 2) fail('A meal deal has at least two parts.');
        body.deal = { parts };
        body.ingredients = []; body.optionGroups = [];
      } else {
        const ingIds = [];
        body.ingredients = $$('#i-ings [data-row=ing]', form).map(row => ({ name: $('[data-k=name]', row).value.trim(), removable: $('[data-k=removable]', row).checked, id: row.dataset.id })).filter(i => i.name)
          .map(i => { const id = i.id || idOf(i.name, ingIds); ingIds.push(id); return { id, name: i.name, removable: i.removable }; });
        const groupKeys = [];
        body.optionGroups = $$('#i-groups > .rep-block', form).map(b => {
          const name = $('[data-k=name]', b).value.trim();
          if (!name) fail('Every option group needs a name.');
          const key = b.dataset.key || idOf(name, groupKeys); groupKeys.push(key);
          const ids = [];
          const choices = $$('[data-row=choice]', b).map(row => ({ name: $('[data-k=name]', row).value.trim(), price: toCents($('[data-k=price]', row).value) || 0, id: row.dataset.id })).filter(c => c.name)
            .map(c => { const id = c.id || idOf(c.name, ids); ids.push(id); return { id, name: c.name, price: c.price }; });
          if (!choices.length) fail(`Add at least one choice to “${name}”.`);
          const type = $('[data-k=type]', b).value;
          return { key, name, type, ...(type === 'many' ? { max: Math.min(choices.length, Number($('[data-k=max]', b).value) || choices.length) } : {}), choices };
        });
        body.deal = null;
      }
      if (slug) await call('PATCH', `/admin/restaurants/${r.slug}/items/${slug}`, body);
      else await call('POST', `/admin/restaurants/${r.slug}/items`, body);
      toast(slug ? 'Saved' : `${body.name} added to the menu`);
      drawMenus();
      return true;
    }
  });
}

/* ================= Users ================= */

let usersPage = 1;
async function drawUsers() {
  try { if (!restaurants.length) await loadRestaurants(); } catch (err) { return failed(err); }
  const f = filters.users;
  root.innerHTML = `
    <div class="staff-head"><div><h1>Users</h1><p class="muted" id="u-count">Loading…</p></div><button class="btn btn-primary" type="button" data-act="new-user">${ic('plus')}Add staff account</button></div>
    <form class="filter-bar" id="u-filters" role="search">
      <label class="search-field"><span class="visually-hidden">Search users</span>${ic('search')}<input class="input" type="search" id="uf-q" placeholder="Name or email" value="${esc(f.q)}"></label>
      <div class="seg" role="group" aria-label="Role">${[['all', 'Everyone'], ['customer', 'Customers'], ['staff', 'All staff'], ['partner', 'Partners'], ['courier', 'Couriers'], ['admin', 'Admins']].map(([k, l]) => `<button class="pill" type="button" data-role="${k}" aria-pressed="${f.role === k}">${l}</button>`).join('')}</div>
    </form>
    <div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col" class="num">Orders</th><th scope="col">Status</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead><tbody id="u-rows"></tbody></table></div>
    <button class="btn btn-secondary" type="button" id="u-more" hidden>Show more</button>`;
  let t = 0;
  $('#uf-q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { if (view.section === 'users') { f.q = $('#uf-q').value.trim(); loadUsers(1); } }, 250); });
  $('#u-filters').addEventListener('submit', e => e.preventDefault());
  $('#u-filters').addEventListener('click', e => { const b = e.target.closest('[data-role]'); if (!b) return; f.role = b.dataset.role; $$('[data-role]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); loadUsers(1); });
  $('#u-more').addEventListener('click', () => loadUsers(usersPage + 1));
  loadUsers(1);
}
const userRole = u => `${ROLE_LABEL[u.role]}${u.role === 'partner' ? ` <small>${esc(u.restaurantName || 'No restaurant')}</small>` : u.role === 'courier' ? ` <small>${esc(u.vehicle || '')}</small>` : ''}`;
let usersById = new Map();
async function loadUsers(page) {
  const f = filters.users;
  let d;
  try { d = await call('GET', `/admin/users?${new URLSearchParams({ q: f.q, role: f.role, page })}`); } catch (err) { toast(err.message); return; }
  if (view.section !== 'users') return;
  usersPage = page;
  if (page === 1) usersById = new Map();
  d.users.forEach(u => usersById.set(u._id, u));
  $('#u-count').textContent = plural(d.total, 'account', 'accounts');
  const rows = d.users.map(u => `<tr class="${u.disabled ? 'is-disabled' : ''}">
    <td><strong>${esc(u.name)}</strong>${u._id === me._id ? ' <span class="default-tag">You</span>' : ''}</td><td>${esc(u.email)}</td><td>${userRole(u)}</td><td class="num">${u.orders}</td>
    <td>${u.disabled ? '<span class="chip st-cancelled">Disabled</span>' : '<span class="chip st-delivered">Active</span>'}</td>
    <td class="row-acts"><button class="btn btn-sm btn-secondary" type="button" data-act="role" data-id="${esc(u._id)}">Change role</button><button class="btn btn-sm btn-outline" type="button" data-act="disable" data-id="${esc(u._id)}">${u.disabled ? 'Enable' : 'Disable'}</button></td></tr>`).join('');
  if (page === 1) $('#u-rows').innerHTML = rows || '<tr><td colspan="6" class="muted">No accounts match.</td></tr>';
  else $('#u-rows').insertAdjacentHTML('beforeend', rows);
  $('#u-more').hidden = !d.hasMore;
}

const roleFieldsHTML = u => `
  <div class="field"><label for="u-role">Role</label>${selectHTML('u-role', 'Role', ['customer', 'partner', 'courier', 'admin'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join(''), 'full')}</div>
  <div class="field" id="u-rest-f" ${u.role === 'partner' ? '' : 'hidden'}><label for="u-rest">Restaurant</label>${selectHTML('u-rest', 'Restaurant', restaurantOptions(restaurants.find(r => r._id === u.restaurant) ? restaurants.find(r => r._id === u.restaurant).slug : '', 'Choose a restaurant'), 'full')}</div>
  <div class="field" id="u-veh-f" ${u.role === 'courier' ? '' : 'hidden'}><label for="u-veh">Vehicle</label>${selectHTML('u-veh', 'Vehicle', VEHICLES.map(v => `<option value="${v}" ${u.vehicle === v ? 'selected' : ''}>${cap(v)}</option>`).join(''), 'full')}</div>`;
const bindRole = form => $('#u-role', form).addEventListener('change', e => { $('#u-rest-f', form).hidden = e.target.value !== 'partner'; $('#u-veh-f', form).hidden = e.target.value !== 'courier'; });
const readRole = form => {
  const role = $('#u-role', form).value;
  const slug = $('#u-rest', form).value;
  const rest = restaurants.find(r => r.slug === slug);
  if (role === 'partner' && !rest) fail('Choose the restaurant this partner works for.');
  return { role, restaurant: role === 'partner' ? rest._id : null, vehicle: role === 'courier' ? $('#u-veh', form).value : null };
};

function newUser() {
  formModal({
    title: 'Add a staff account', sub: 'Share the email and password with them. They can change the password from their account page.', submitLabel: 'Create account', wide: false,
    body: `<div class="field"><label for="u-name">Full name</label><input class="input" id="u-name" maxlength="80" required></div>
      <div class="field"><label for="u-email">Email</label><input class="input" id="u-email" type="email" autocomplete="off" required></div>
      <div class="field"><label for="u-pass">Password <small>At least 8 characters</small></label><input class="input" id="u-pass" type="text" autocomplete="new-password" minlength="8" required></div>
      ${roleFieldsHTML({ role: 'partner' })}`,
    onOpen: bindRole,
    submit: async form => {
      await call('POST', '/admin/users', { name: $('#u-name', form).value.trim(), email: $('#u-email', form).value.trim(), password: $('#u-pass', form).value, ...readRole(form) });
      toast('Staff account created');
      loadUsers(1);
      return true;
    }
  });
}
function changeRole(u) {
  formModal({
    title: `Change role for ${u.name}`, sub: esc(u.email), submitLabel: 'Save role', wide: false,
    body: roleFieldsHTML(u), onOpen: bindRole,
    submit: async form => { await call('PATCH', `/admin/users/${u._id}`, readRole(form)); toast('Role updated'); loadUsers(1); return true; }
  });
}

/* ================= Reviews ================= */

let reviewsPage = 1;
async function drawReviews() {
  try { if (!restaurants.length) await loadRestaurants(); } catch (err) { return failed(err); }
  const f = filters.reviews;
  root.innerHTML = `
    <div class="staff-head"><div><h1>Reviews</h1><p class="muted" id="rv-count">Loading…</p></div></div>
    <p class="staff-note">Hidden reviews disappear from the restaurant page and don’t count towards its rating.</p>
    <form class="filter-bar" id="rv-filters" role="search">
      ${selectHTML('rf-rest', 'Restaurant', restaurantOptions(f.restaurant))}
      ${selectHTML('rf-show', 'Show', [['all', 'All reviews'], ['visible', 'Visible'], ['hidden', 'Hidden'], ['low', '1 or 2 stars']].map(([k, l]) => `<option value="${k}" ${f.show === k ? 'selected' : ''}>${l}</option>`).join(''))}
      <label class="search-field"><span class="visually-hidden">Search reviews</span>${ic('search')}<input class="input" type="search" id="rf-q" placeholder="Words in the review or author" value="${esc(f.q)}"></label>
    </form>
    <ul class="admin-reviews" id="rv-rows"></ul>
    <button class="btn btn-secondary" type="button" id="rv-more" hidden>Show more</button>`;
  let t = 0;
  const read = () => { f.restaurant = $('#rf-rest').value; f.show = $('#rf-show').value; f.q = $('#rf-q').value.trim(); loadReviews(1); };
  $('#rv-filters').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { if (view.section === 'reviews') read(); }, 250); });
  $('#rv-filters').addEventListener('submit', e => { e.preventDefault(); read(); });
  $('#rv-more').addEventListener('click', () => loadReviews(reviewsPage + 1));
  loadReviews(1);
}
const starsText = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const adminReview = r => `<li class="panel a-review ${r.hidden ? 'is-hidden' : ''}" data-id="${esc(r._id)}">
  <div class="a-review-top"><div><strong>${esc(r.author)}</strong> <span class="muted">on ${esc(r.restaurantName)} · ${new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
    <span class="a-stars" aria-label="${r.food} out of 5 stars">${starsText(r.food)}</span></div>
  ${r.comment ? `<p>${esc(r.comment)}</p>` : '<p class="muted">No comment</p>'}
  ${r.reply ? `<p class="a-reply"><strong>Restaurant reply:</strong> ${esc(r.reply.text)}</p>` : ''}
  <div class="a-review-foot">${r.hidden ? '<span class="chip st-cancelled">Hidden</span>' : '<span class="chip">Visible</span>'}<button class="btn btn-sm ${r.hidden ? 'btn-secondary' : 'btn-outline'}" type="button" data-act="hide-review" data-id="${esc(r._id)}" data-hidden="${r.hidden}">${r.hidden ? 'Show again' : 'Hide review'}</button></div>
</li>`;
async function loadReviews(page) {
  const f = filters.reviews;
  let d;
  try { d = await call('GET', `/admin/reviews?${new URLSearchParams({ show: f.show, page, q: f.q, ...(f.restaurant ? { restaurant: f.restaurant } : {}) })}`); } catch (err) { toast(err.message); return; }
  if (view.section !== 'reviews') return;
  reviewsPage = page;
  $('#rv-count').textContent = plural(d.total, 'review', 'reviews');
  if (page === 1) $('#rv-rows').innerHTML = d.reviews.map(adminReview).join('') || '<li class="muted">No reviews match.</li>';
  else $('#rv-rows').insertAdjacentHTML('beforeend', d.reviews.map(adminReview).join(''));
  $('#rv-more').hidden = !d.hasMore;
}

/* ================= Promo codes ================= */

let promos = [];
const promoValue = p => p.type === 'percent' ? `${p.value}% off food${p.maxDiscount ? `, up to ${eur(p.maxDiscount)}` : ''}` : p.type === 'fixed' ? `${eur(p.value)} off food` : 'Free delivery';
async function drawPromos() {
  loading();
  try { promos = (await call('GET', '/admin/promos')).promos; } catch (err) { return failed(err); }
  if (view.section !== 'promos') return;
  root.innerHTML = `
    <div class="staff-head"><div><h1>Promo codes</h1><p class="muted">${promos.filter(p => p.active).length} active · uses count orders that weren’t cancelled</p></div><button class="btn btn-primary" type="button" data-act="new-promo">${ic('plus')}New code</button></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Code</th><th scope="col">Discount</th><th scope="col">Conditions</th><th scope="col" class="num">Uses</th><th scope="col" class="num">Given away</th><th scope="col">Status</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
    <tbody>${promos.map(p => `<tr class="${p.active ? '' : 'is-disabled'}"><td><span class="code">${esc(p.code)}</span><br><small class="muted">${esc(p.description)}</small></td><td>${esc(promoValue(p))}</td>
      <td>${[p.firstOrderOnly ? 'First order only' : '', p.minSubtotal ? `Food over ${eur(p.minSubtotal)}` : ''].filter(Boolean).join(', ') || 'None'}</td>
      <td class="num">${p.uses}</td><td class="num">${eur(p.discountGiven)}</td>
      <td><button class="switch-btn sm ${p.active ? '' : 'is-off'}" type="button" data-act="promo-active" data-id="${esc(p._id)}" aria-pressed="${p.active}" aria-label="${esc(p.code)} active"><span class="sw" aria-hidden="true"></span><span>${p.active ? 'On' : 'Off'}</span></button></td>
      <td><button class="btn btn-sm btn-secondary" type="button" data-act="edit-promo" data-id="${esc(p._id)}">Edit</button></td></tr>`).join('')}</tbody></table></div>`;
}
function editPromo(p) {
  const isNew = !p;
  p = p || { code: '', rawDescription: '', type: 'percent', value: 10, maxDiscount: null, minSubtotal: 0, firstOrderOnly: false, active: true };
  formModal({
    title: isNew ? 'New promo code' : `Edit ${p.code}`, submitLabel: isNew ? 'Create code' : 'Save changes', wide: false,
    body: `
      <div class="field"><label for="p-code">Code <small>Letters, numbers and dashes</small></label><input class="input code-in" id="p-code" value="${esc(p.code)}" maxlength="30" ${isNew ? '' : 'disabled'}></div>
      <div class="field"><label for="p-desc">Description <small>Optional. Shown at checkout; left empty, it’s written for you</small></label><input class="input" id="p-desc" value="${esc(p.rawDescription)}" maxlength="160"></div>
      <div class="field"><label for="p-type">Discount</label>${selectHTML('p-type', 'Discount type', [['percent', 'Percentage off food'], ['fixed', 'Fixed amount off food'], ['delivery', 'Free delivery']].map(([k, l]) => `<option value="${k}" ${p.type === k ? 'selected' : ''}>${l}</option>`).join(''), 'full')}</div>
      <div class="grid-2" id="p-amounts">
        <div class="field" id="p-val-f"><label for="p-val" id="p-val-l">Percent off</label><input class="input" id="p-val" inputmode="decimal" value="${p.type === 'fixed' ? euroField(p.value) : p.value}"></div>
        <div class="field" id="p-max-f"><label for="p-max">Most it takes off (€) <small>Optional</small></label><input class="input" id="p-max" inputmode="decimal" value="${p.maxDiscount ? euroField(p.maxDiscount) : ''}"></div>
      </div>
      <div class="field"><label for="p-min">Minimum food subtotal (€) <small>0 for none</small></label><input class="input" id="p-min" inputmode="decimal" value="${euroField(p.minSubtotal)}"></div>
      <label class="check"><input type="checkbox" id="p-first" ${p.firstOrderOnly ? 'checked' : ''}><span>First order only (needs an account)</span></label>
      <label class="check"><input type="checkbox" id="p-active" ${p.active ? 'checked' : ''}><span>Active</span></label>`,
    onOpen: form => {
      const sync = () => { const t = $('#p-type', form).value; $('#p-amounts', form).hidden = t === 'delivery'; $('#p-max-f', form).hidden = t !== 'percent'; $('#p-val-l', form).textContent = t === 'fixed' ? 'Amount off (€)' : 'Percent off'; };
      $('#p-type', form).addEventListener('change', sync); sync();
    },
    submit: async form => {
      const type = $('#p-type', form).value;
      const raw = $('#p-val', form).value;
      const body = {
        description: $('#p-desc', form).value.trim(), type,
        value: type === 'percent' ? Math.round(Number(raw)) : type === 'fixed' ? toCents(raw) : 0,
        maxDiscount: type === 'percent' && $('#p-max', form).value.trim() ? toCents($('#p-max', form).value) : null,
        minSubtotal: toCents($('#p-min', form).value || '0') || 0, firstOrderOnly: $('#p-first', form).checked, active: $('#p-active', form).checked
      };
      if (Number.isNaN(body.value)) fail('Enter how much the code takes off.');
      if (isNew) await call('POST', '/admin/promos', { code: $('#p-code', form).value.trim().toUpperCase(), ...body });
      else await call('PATCH', `/admin/promos/${p._id}`, body);
      toast(isNew ? 'Promo code created' : 'Promo code saved');
      drawPromos();
      return true;
    }
  });
}

/* ================= Settings ================= */

async function drawSettings() {
  loading();
  let s;
  try { s = await call('GET', '/admin/settings'); } catch (err) { return failed(err); }
  if (view.section !== 'settings') return;
  root.innerHTML = `
    <div class="staff-head"><div><h1>Settings</h1></div></div>
    <section class="panel setting">
      <div><h2>Demo autopilot</h2>
        <p>Moves orders along by themselves when nobody acts, so a presentation works with only the customer side open: the restaurant accepts after a moment, cooks for the preparation time, and a demo courier picks up and delivers.</p>
        <p class="muted">It never takes a restaurant’s steps while that restaurant’s partner page is open, never touches a delivery a real courier has accepted, and leaves new deliveries to couriers while a courier page is open. Turn it off to run every step by hand.</p></div>
      <button class="switch-btn lg ${s.autopilot ? '' : 'is-off'}" type="button" data-act="autopilot" aria-pressed="${s.autopilot}"><span class="sw" aria-hidden="true"></span><span>${s.autopilot ? 'On' : 'Off'}</span></button>
    </section>
    <section class="panel setting"><div><h2>Photos</h2><p>Set photos for restaurants and dishes in their edit windows, or review Unsplash photos for the whole catalog.</p></div><a class="btn btn-secondary" href="/admin/photos">Unsplash photos</a></section>`;
}

/* ================= Events ================= */

root.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.closest('.modal')) return;
  const id = el.dataset.id;
  try {
    switch (el.dataset.act) {
      case 'order': openOrder(id); break;
      case 'new-rest': editRestaurant(null); break;
      case 'edit-rest': editRestaurant(restaurants.find(r => r.slug === el.dataset.slug)); break;
      case 'pause-rest': {
        const paused = el.dataset.paused !== 'true';
        await call('PATCH', `/admin/restaurants/${el.dataset.slug}`, { paused });
        toast(paused ? 'Paused: no new orders' : 'Taking orders again');
        drawRestaurants();
        break;
      }
      case 'new-item': editItem(null, 'main'); break;
      case 'new-deal': editItem(null, 'deal'); break;
      case 'edit-item': editItem(el.dataset.slug); break;
      case 'item-soldout': {
        const soldOut = el.getAttribute('aria-pressed') === 'true';
        await call('PATCH', `/admin/restaurants/${menu.restaurant.slug}/items/${el.dataset.slug}`, { soldOut });
        toast(soldOut ? 'Marked sold out' : 'Available again');
        drawMenus();
        break;
      }
      case 'new-user': newUser(); break;
      case 'role': changeRole(usersById.get(id)); break;
      case 'disable': {
        const u = usersById.get(id);
        if (!u.disabled && !(await confirmDialog({ title: `Disable ${esc(u.name)}?`, body: 'They’re logged out everywhere and can’t log in until you enable the account again.', confirm: 'Disable account', cancel: 'Keep active' }))) break;
        await call('PATCH', `/admin/users/${id}`, { disabled: !u.disabled });
        toast(u.disabled ? 'Account enabled' : 'Account disabled');
        loadUsers(1);
        break;
      }
      case 'hide-review': {
        const hidden = el.dataset.hidden !== 'true';
        const { review } = await call('PATCH', `/admin/reviews/${id}`, { hidden });
        const li = el.closest('.a-review');
        const restaurantName = li.querySelector('.a-review-top .muted').textContent.replace(/^on /, '').split(' · ')[0];
        li.outerHTML = adminReview({ ...review, restaurantName });
        toast(hidden ? 'Review hidden' : 'Review visible again');
        break;
      }
      case 'new-promo': editPromo(null); break;
      case 'edit-promo': editPromo(promos.find(p => p._id === id)); break;
      case 'promo-active': {
        const active = el.getAttribute('aria-pressed') !== 'true';
        await call('PATCH', `/admin/promos/${id}`, { active });
        toast(active ? 'Code turned on' : 'Code turned off');
        drawPromos();
        break;
      }
      case 'autopilot': {
        const on = el.getAttribute('aria-pressed') !== 'true';
        await call('PUT', '/admin/settings', { autopilot: on });
        toast(on ? 'Demo autopilot on' : 'Demo autopilot off: every step is done by hand');
        drawSettings();
        break;
      }
    }
  } catch (err) { toast(err.message); }
});
window.addEventListener('hashchange', route);

gate(root, {
  roles: ['admin'],
  title: 'Morsel admin',
  intro: 'Log in with an admin account to manage restaurants, orders and users.',
  ready: user => { me = user; $('#side').hidden = false; route(); }
});
