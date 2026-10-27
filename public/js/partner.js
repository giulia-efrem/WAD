import { $, $$, esc, eur, clock, plural } from './util.js';
import { ic } from './art.js';
import { openModal, closeModal } from './ui.js';
import { call, toast, gate, statusChip, shortId, minutesAgo, linesHTML, whenText, every } from './staff.js';

/* /partner: a restaurant's live order board, menu availability and reviews with public replies. */

const root = $('#staff');
const PREP_CHOICES = [5, 10, 15, 20, 25, 30, 40, 50, 60];
const REJECT_REASONS = ['Too busy right now', 'An item is sold out', 'Closing soon', 'Can’t deliver to this address'];
const COLUMNS = [
  { key: 'new', title: 'New', statuses: ['placed'], empty: 'New orders appear here.' },
  { key: 'kitchen', title: 'In the kitchen', statuses: ['accepted', 'preparing'], empty: 'Accepted orders appear here.' },
  { key: 'ready', title: 'Ready for pickup', statuses: ['ready'], empty: 'Orders waiting for a courier.' },
  { key: 'out', title: 'Out for delivery', statuses: ['pickedup'], empty: 'Orders with a courier.' }
];

let data = null;
let tab = 'orders';
let lastSig = '';
const prepPick = new Map();
const baseTitle = document.title;

const tabFromHash = () => (['orders', 'menu', 'reviews'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'orders');

function setTab(next) {
  tab = next;
  $$('#tabs a').forEach(a => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  lastSig = '';
  if (tab === 'orders') drawOrders();
  if (tab === 'menu') drawMenu();
  if (tab === 'reviews') drawReviews();
}

/* ================= Orders ================= */

async function loadOrders() {
  data = await call('GET', '/partner/orders');
  data.offset = data.serverNow - Date.now();
  const fresh = data.active.filter(o => o.status === 'placed').length;
  const badge = $('#new-count');
  badge.hidden = !fresh;
  badge.textContent = fresh;
  document.title = fresh ? `(${fresh}) New orders · ${baseTitle}` : baseTitle;
  if (tab === 'orders') drawOrders();
}

function pausedSwitch(paused) {
  return `<button class="switch-btn ${paused ? 'is-off' : ''}" type="button" data-act="pause" aria-pressed="${paused}">
    <span class="sw" aria-hidden="true"></span><span>${paused ? 'Paused: not taking orders' : 'Taking new orders'}</span></button>`;
}

function orderCard(o, now) {
  const scheduled = o.delivery.type === 'scheduled';
  const pick = prepPick.get(o._id) || o.prepMinutes;
  let actions = '';
  if (o.status === 'placed') {
    actions = `<div class="o-actions">
      <label class="prep"><span>Ready in</span><span class="select-wrap"><select data-prep="${esc(o._id)}" aria-label="Preparation time for order ${shortId(o._id)}">${PREP_CHOICES.map(m => `<option value="${m}" ${m === pick ? 'selected' : ''}>${m} min</option>`).join('')}${PREP_CHOICES.includes(pick) ? '' : `<option value="${pick}" selected>${pick} min</option>`}</select>${ic('chevron')}</span></label>
      <button class="btn btn-sm btn-primary" type="button" data-act="accept" data-id="${esc(o._id)}">Accept</button>
      <button class="btn btn-sm btn-outline" type="button" data-act="reject" data-id="${esc(o._id)}">Reject</button></div>`;
  } else if (o.status === 'accepted') {
    actions = `<div class="o-actions"><button class="btn btn-sm btn-primary" type="button" data-act="preparing" data-id="${esc(o._id)}">Start preparing</button><button class="btn btn-sm btn-secondary" type="button" data-act="ready" data-id="${esc(o._id)}">Mark ready</button><button class="link-btn danger" type="button" data-act="reject" data-id="${esc(o._id)}">Cancel</button></div>`;
  } else if (o.status === 'preparing') {
    const sim = (now - o.statusAt) / o.simMinuteMs;
    const frac = Math.min(1, sim / o.prepMinutes);
    actions = `<div class="prep-bar" aria-label="${Math.round(frac * 100)}% of the preparation time used"><i style="width:${frac * 100}%"></i></div>
      <div class="o-actions"><button class="btn btn-sm btn-primary" type="button" data-act="ready" data-id="${esc(o._id)}">Mark ready for pickup</button><button class="link-btn danger" type="button" data-act="reject" data-id="${esc(o._id)}">Cancel</button></div>`;
  } else if (o.status === 'ready') {
    actions = `<p class="o-wait">${ic('bike')}${o.courier.assigned ? `${esc(o.courier.name)} is on the way to collect it` : 'Waiting for a courier to accept it'}</p>`;
  } else if (o.status === 'pickedup') {
    actions = `<p class="o-wait">${ic('bike')}${esc(o.courier.name || 'The courier')} picked it up ${minutesAgo(o.statusAt, now)}</p>`;
  }
  return `<article class="o-card ${o.status === 'placed' ? 'is-new' : ''}" data-id="${esc(o._id)}">
    <header class="o-head"><div><strong>${shortId(o._id)}</strong> ${statusChip(o.status)}</div><span class="muted">${clock(new Date(o.createdAt))}</span></header>
    <p class="o-meta">${esc(o.customerName || 'Customer')} · ${plural(o.items.reduce((s, l) => s + l.qty, 0), 'item', 'items')} · ${eur(o.pricing.subtotal)}${scheduled ? ` · <strong>${esc(whenText(o))}</strong>` : ''}</p>
    ${linesHTML(o.items)}
    ${o.status !== 'placed' && o.prepMinutes ? `<p class="o-sub muted">Preparation time ${o.prepMinutes} min</p>` : ''}
    ${actions}
  </article>`;
}

function drawOrders() {
  if (!data) { root.innerHTML = '<div class="sk sk-item" aria-busy="true"></div>'; return; }
  const now = Date.now() + data.offset;
  /* Redraw only when something changed, so an open select keeps its value. */
  const sig = JSON.stringify([data.restaurant.paused, data.autopilot, data.active.map(o => [o._id, o.status, o.courier.name, Math.floor((now - o.statusAt) / (o.simMinuteMs * 2))]), data.done.length]);
  if (sig === lastSig && root.querySelector('.board')) return;
  if (root.contains(document.activeElement) && document.activeElement.matches('select')) return;
  lastSig = sig;
  const r = data.restaurant;
  root.innerHTML = `
    <div class="staff-head">
      <div><h1>${esc(r.name)}</h1><p class="muted">${r.isOpen ? 'Open now' : 'Closed now'} · orders refresh every few seconds</p></div>
      ${pausedSwitch(r.paused)}
    </div>
    ${data.autopilot ? '<p class="staff-note">Demo autopilot is on. While this page is open, Morsel waits for you to accept and prepare orders. Close it and orders move along on their own.</p>' : ''}
    <div class="tiles tiles-3">
      <div class="tile"><span class="tile-label">Orders today</span><strong class="tile-value">${data.today.orders}</strong></div>
      <div class="tile"><span class="tile-label">Food sales delivered today</span><strong class="tile-value">${eur(data.today.revenue)}</strong></div>
      <div class="tile"><span class="tile-label">Active now</span><strong class="tile-value">${data.active.length}</strong></div>
    </div>
    <div class="board">${COLUMNS.map(c => {
      const list = data.active.filter(o => c.statuses.includes(o.status));
      return `<section class="col" aria-labelledby="col-${c.key}"><h2 id="col-${c.key}">${c.title} <span class="count">${list.length}</span></h2>
        ${list.length ? list.map(o => orderCard(o, now)).join('') : `<p class="col-empty">${c.empty}</p>`}</section>`;
    }).join('')}</div>
    ${data.done.length ? `<details class="panel done-list"><summary><h2>Finished today <span class="count">${data.done.length}</span></h2>${ic('chevron', 'chev')}</summary>
      <ul>${data.done.map(o => `<li><strong>${shortId(o._id)}</strong> ${statusChip(o.status)}<span>${esc(o.customerName)} · ${eur(o.pricing.subtotal)}</span><span class="muted">${clock(new Date(o.statusAt))}${o.cancelReason ? ` · ${esc(o.cancelReason)}` : ''}</span></li>`).join('')}</ul></details>` : ''}`;
}

async function act(path, body, msg) {
  try { await call('POST', path, body); if (msg) toast(msg); }
  catch (err) { toast(err.message); }
  await loadOrders();
}

function openReject(id) {
  const o = data.active.find(x => x._id === id);
  const accepted = o && o.status !== 'placed';
  const m = openModal(`
    <div class="modal-head"><h2 id="rj-title">${accepted ? 'Cancel' : 'Reject'} order ${shortId(id)}?</h2><p>The customer sees the reason and isn’t charged.</p></div>
    <form class="modal-body" id="rj-form" novalidate>
      ${REJECT_REASONS.map((r, i) => `<label class="choice"><input type="radio" name="reason" value="${esc(r)}" ${i === 0 ? 'checked' : ''}><span>${esc(r)}</span></label>`).join('')}
      <label class="choice"><input type="radio" name="reason" value="other"><span>Something else</span></label>
      <div class="field"><label for="rj-other" class="visually-hidden">Reason</label><input class="input" id="rj-other" maxlength="160" placeholder="Tell the customer what happened"></div>
      <p class="err" role="alert"></p>
    </form>
    <div class="modal-foot"><button class="btn btn-secondary" type="button" data-close>Keep order</button><button class="btn btn-danger" type="submit" form="rj-form" style="flex:1">${accepted ? 'Cancel order' : 'Reject order'}</button></div>`, { label: 'rj-title' });
  $('[data-close]', m.wrap).addEventListener('click', () => closeModal(m));
  $('#rj-other', m.wrap).addEventListener('input', () => { $('input[value="other"]', m.wrap).checked = true; });
  $('#rj-form', m.wrap).addEventListener('submit', async e => {
    e.preventDefault();
    const picked = $('input[name=reason]:checked', m.wrap).value;
    const reason = picked === 'other' ? $('#rj-other', m.wrap).value.trim() : picked;
    if (reason.length < 2) { $('.err', m.wrap).textContent = 'Give a reason, so the customer knows what happened.'; return; }
    closeModal(m);
    await act(`/partner/orders/${id}/reject`, { reason }, accepted ? 'Order cancelled' : 'Order rejected');
  });
}

/* ================= Menu ================= */

async function drawMenu() {
  root.innerHTML = '<div class="sk sk-item" aria-busy="true"></div>';
  let m;
  try { m = await call('GET', '/partner/menu'); } catch (err) { root.innerHTML = `<p class="muted">${esc(err.message)}</p>`; return; }
  if (tab !== 'menu') return;
  const out = m.menu.flatMap(s => s.items).filter(i => i.soldOut).length;
  root.innerHTML = `
    <div class="staff-head"><div><h1>Menu availability</h1><p class="muted">${out ? `${plural(out, 'item is', 'items are')} sold out. Customers see them but can’t order them.` : 'Everything is available.'}</p></div>${pausedSwitch(m.restaurant.paused)}</div>
    ${m.menu.map(s => `<section class="panel avail"><h2>${esc(s.category)}</h2><ul>${s.items.map(it => `<li>
      <div><strong>${esc(it.name)}</strong><span class="muted">${eur(it.price)}</span></div>
      <button class="switch-btn ${it.soldOut ? 'is-off' : ''}" type="button" data-act="soldout" data-slug="${esc(it.slug)}" aria-pressed="${!it.soldOut}" aria-label="${esc(it.name)} available"><span class="sw" aria-hidden="true"></span><span>${it.soldOut ? 'Sold out' : 'Available'}</span></button>
    </li>`).join('')}</ul></section>`).join('')}`;
}

/* ================= Reviews ================= */

let reviewFilter = 'all';
const stars = n => `<span class="stars-row" aria-label="${n} out of 5 stars">${[1, 2, 3, 4, 5].map(i => `<span class="${i <= n ? 'on' : ''}">${ic('star', 'fill')}</span>`).join('')}</span>`;
const dateText = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function reviewHTML(r) {
  return `<li class="review" data-id="${esc(r._id)}">
    <div class="review-body">
      <div class="review-top"><strong>${esc(r.author)}</strong><span class="muted">${dateText(r.createdAt)}</span></div>
      <div class="review-rating">${stars(r.food)}<span class="rv-thumb ${r.delivery}">${ic('thumb', r.delivery === 'down' ? 'flip' : '')}<span>Delivery</span></span></div>
      ${r.ordered ? `<p class="review-ordered">Ordered ${esc(r.ordered)}</p>` : ''}
      ${r.comment ? `<p class="review-comment">${esc(r.comment)}</p>` : '<p class="muted review-comment">No comment</p>'}
      <form class="reply-form" data-id="${esc(r._id)}" novalidate>
        <label class="sub-label" for="rp-${esc(r._id)}">${r.reply ? 'Your public reply' : 'Reply publicly'}</label>
        <textarea class="input" id="rp-${esc(r._id)}" maxlength="600" placeholder="Thank them, or say what you’re doing about it. Everyone can read this on your restaurant page.">${esc(r.reply ? r.reply.text : '')}</textarea>
        <div class="reply-row"><button class="btn btn-sm btn-primary" type="submit">${r.reply ? 'Update reply' : 'Post reply'}</button>${r.reply ? '<button class="btn btn-sm btn-outline" type="button" data-act="unreply">Remove reply</button>' : ''}</div>
      </form>
    </div>
  </li>`;
}

async function drawReviews(page = 1) {
  if (page === 1) root.innerHTML = '<div class="sk sk-item" aria-busy="true"></div>';
  let d;
  try { d = await call('GET', `/partner/reviews?page=${page}&filter=${reviewFilter}`); } catch (err) { root.innerHTML = `<p class="muted">${esc(err.message)}</p>`; return; }
  if (tab !== 'reviews') return;
  if (page > 1) {
    $('#rv-list').insertAdjacentHTML('beforeend', d.reviews.map(reviewHTML).join(''));
    const more = $('#rv-more');
    if (d.hasMore) { more.dataset.page = page + 1; more.disabled = false; } else more.remove();
    return;
  }
  const s = d.summary;
  root.innerHTML = `
    <div class="staff-head"><div><h1>Reviews</h1><p class="muted">${s.count ? `${s.average.toFixed(1)} out of 5 from ${plural(s.count, 'review', 'reviews')}${s.deliveryUpShare != null ? `, ${s.deliveryUpShare}% liked the delivery` : ''}` : 'No reviews yet.'}</p></div>
      <div class="seg" role="group" aria-label="Show reviews"><button class="pill" type="button" data-act="rv-filter" data-f="all" aria-pressed="${reviewFilter === 'all'}">All</button><button class="pill" type="button" data-act="rv-filter" data-f="unanswered" aria-pressed="${reviewFilter === 'unanswered'}">Not replied yet</button></div></div>
    <p class="staff-note">Replies show under the review on your restaurant page.</p>
    ${d.reviews.length ? `<ul class="review-list panel" id="rv-list">${d.reviews.map(reviewHTML).join('')}</ul>` : '<div class="empty"><h3>Nothing here</h3><p>Every review has a reply.</p></div>'}
    ${d.hasMore ? '<button class="btn btn-secondary" type="button" id="rv-more" data-page="2">Show more reviews</button>' : ''}`;
}

async function saveReply(id, text) {
  try {
    const { review } = await call('PUT', `/partner/reviews/${id}/reply`, { text });
    const li = $(`.review[data-id="${id}"]`);
    if (li) li.outerHTML = reviewHTML(review);
    toast(text ? 'Reply posted' : 'Reply removed');
  } catch (err) { toast(err.message); }
}

/* ================= Events ================= */

root.addEventListener('change', e => {
  const sel = e.target.closest('[data-prep]');
  if (sel) prepPick.set(sel.dataset.prep, Number(sel.value));
});
root.addEventListener('submit', e => {
  const f = e.target.closest('.reply-form');
  if (!f) return;
  e.preventDefault();
  const text = $('textarea', f).value.trim();
  if (!text) { toast('Write a reply first, or use Remove reply.'); return; }
  saveReply(f.dataset.id, text);
});
root.addEventListener('click', async e => {
  const el = e.target.closest('[data-act], #rv-more');
  if (!el) return;
  const id = el.dataset.id;
  if (el.id === 'rv-more') { el.disabled = true; drawReviews(Number(el.dataset.page)); return; }
  switch (el.dataset.act) {
    case 'accept': {
      const minutes = prepPick.get(id) || Number($(`[data-prep="${id}"]`).value);
      el.disabled = true;
      await act(`/partner/orders/${id}/accept`, { prepMinutes: minutes }, `Accepted, ready in ${minutes} min`);
      break;
    }
    case 'reject': openReject(id); break;
    case 'preparing': el.disabled = true; await act(`/partner/orders/${id}/preparing`, undefined, 'Preparing'); break;
    case 'ready': el.disabled = true; await act(`/partner/orders/${id}/ready`, undefined, 'Marked ready for pickup'); break;
    case 'pause': {
      const paused = el.getAttribute('aria-pressed') !== 'true';
      try { await call('PATCH', '/partner/restaurant', { paused }); toast(paused ? 'New orders paused' : 'Taking new orders again'); } catch (err) { toast(err.message); }
      if (tab === 'orders') await loadOrders(); else drawMenu();
      break;
    }
    case 'soldout': {
      const soldOut = el.getAttribute('aria-pressed') === 'true';
      el.disabled = true;
      try {
        await call('PATCH', `/partner/menu/${el.dataset.slug}`, { soldOut });
        el.disabled = false;
        el.setAttribute('aria-pressed', String(!soldOut));
        el.classList.toggle('is-off', soldOut);
        el.lastElementChild.textContent = soldOut ? 'Sold out' : 'Available';
        toast(soldOut ? 'Marked sold out' : 'Available again');
      } catch (err) { el.disabled = false; toast(err.message); }
      break;
    }
    case 'rv-filter': reviewFilter = el.dataset.f; drawReviews(); break;
    case 'unreply': saveReply(el.closest('.reply-form').dataset.id, ''); break;
  }
});
window.addEventListener('hashchange', () => setTab(tabFromHash()));

gate(root, {
  roles: ['partner'],
  title: 'Morsel for restaurants',
  intro: 'Log in with your restaurant partner account to see incoming orders.',
  ready: () => {
    $('#tabs').hidden = false;
    setTab(tabFromHash());
    /* Polling also tells the server this restaurant is online, so the autopilot waits for you. */
    every(4000, loadOrders);
  }
});
