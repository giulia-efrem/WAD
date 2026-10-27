import { $, esc, eur, clock, plural, firstName } from './util.js';
import { ic } from './art.js';
import { call, toast, gate, shortId, minutesAgo, linesHTML, every } from './staff.js';

/* /courier: mobile-first. The current delivery with one big button for the next step,
   deliveries waiting for a courier, and today's deliveries and earnings. */

const root = $('#staff');
let data = null;
let me = null;
let lastSig = '';

const STEP_TEXT = {
  accepted: 'The restaurant is about to start cooking.',
  preparing: 'The kitchen is preparing it.',
  ready: 'Ready at the restaurant. Pick it up.',
  pickedup: 'On the way to the customer.'
};

async function load() {
  data = await call('GET', '/courier/deliveries');
  data.offset = data.serverNow - Date.now();
  draw();
}

function currentHTML(o, now) {
  const a = o.address;
  const step = o.status === 'pickedup'
    ? `<button class="btn btn-primary btn-block btn-xl" type="button" data-act="delivered" data-id="${esc(o._id)}">${ic('check')}Mark delivered</button>`
    : o.status === 'ready'
      ? `<button class="btn btn-primary btn-block btn-xl" type="button" data-act="pickedup" data-id="${esc(o._id)}">${ic('bag')}Picked up</button>`
      : `<button class="btn btn-secondary btn-block btn-xl" type="button" disabled>Waiting for the kitchen</button>`;
  return `<section class="panel c-current" aria-labelledby="c-cur-h">
    <p class="c-kicker">Your delivery ${shortId(o._id)}</p>
    <h2 id="c-cur-h">${esc(STEP_TEXT[o.status] || '')}</h2>
    <ol class="c-stops">
      <li class="${o.status === 'pickedup' ? 'done' : 'now'}"><span class="dot" aria-hidden="true"></span><div><small>Pick up from</small><strong>${esc(o.restaurantName)}</strong>${o.status !== 'pickedup' ? `<span class="muted">${o.status === 'ready' ? `Ready ${minutesAgo(o.statusAt, now)}` : `About ${o.prepMinutes} min to prepare`}</span>` : ''}</div></li>
      <li class="${o.status === 'pickedup' ? 'now' : ''}"><span class="dot" aria-hidden="true"></span><div><small>Deliver to ${esc(firstName(o.customerName) || 'the customer')}</small><strong>${esc(a.street)}</strong><span class="muted">${esc([a.details, a.city].filter(Boolean).join(', '))}</span></div></li>
    </ol>
    ${o.courierNote ? `<p class="c-note">${ic('info')}<span>“${esc(o.courierNote)}”</span></p>` : ''}
    <details class="c-items"><summary>${plural(o.items.reduce((s, l) => s + l.qty, 0), 'item', 'items')} · ${o.payment === 'cash' ? `<strong>Collect ${eur(o.pricing.total)} in cash</strong>` : 'Paid by card'}${ic('chevron', 'chev')}</summary>${linesHTML(o.items)}</details>
    ${step}
  </section>`;
}

function availableHTML(d) {
  return `<li class="c-offer">
    <div class="c-offer-main">
      <strong>${esc(d.restaurantName)}</strong>
      <span class="muted">To ${esc(d.area)} · about ${d.travelMinutes} min ride · ${plural(d.itemCount, 'item', 'items')}</span>
      <span class="c-ready">${d.status === 'ready' ? 'Ready now' : d.status === 'preparing' ? 'Being prepared' : 'Accepted by the kitchen'}${d.payment === 'cash' ? ' · cash' : ''}</span>
    </div>
    <div class="c-offer-side"><strong class="c-earn">${eur(d.earnings)}</strong><button class="btn btn-sm btn-primary" type="button" data-act="take" data-id="${esc(d._id)}">Accept</button></div>
  </li>`;
}

function draw() {
  const now = Date.now() + data.offset;
  const sig = JSON.stringify([data.current.map(o => [o._id, o.status]), data.available.map(d => [d._id, d.status]), data.today.deliveries]);
  if (sig === lastSig) return;
  lastSig = sig;
  const t = data.today;
  const busy = data.current.length > 0;
  root.innerHTML = `
    <div class="c-hello"><h1>Hi ${esc(firstName(me.name))}</h1><p class="muted">${esc(me.vehicle ? `Delivering by ${me.vehicle}` : 'Courier')} · ${eur(data.payPerDelivery)} per delivery plus tips</p></div>
    <div class="tiles c-tiles">
      <div class="tile"><span class="tile-label">Earned today</span><strong class="tile-value">${eur(t.earnings)}</strong><span class="tile-sub">${eur(t.pay)} pay + ${eur(t.tips)} tips</span></div>
      <div class="tile"><span class="tile-label">Deliveries today</span><strong class="tile-value">${t.deliveries}</strong></div>
    </div>
    ${data.current.map(o => currentHTML(o, now)).join('')}
    <section aria-labelledby="c-av-h">
      <h2 class="c-h" id="c-av-h">Available deliveries <span class="count">${data.available.length}</span></h2>
      ${busy && data.available.length ? '<p class="staff-note">Finish your current delivery to take another one.</p>' : ''}
      ${data.available.length ? `<ul class="c-offers ${busy ? 'is-busy' : ''}">${data.available.map(availableHTML).join('')}</ul>` : '<p class="col-empty">No deliveries waiting right now. New ones appear here by themselves.</p>'}
    </section>
    <section aria-labelledby="c-today-h">
      <h2 class="c-h" id="c-today-h">Today</h2>
      ${t.list.length ? `<ul class="c-today panel">${t.list.map(x => `<li><div><strong>${esc(x.restaurantName)}</strong><span class="muted">To ${esc(x.area)} · ${clock(new Date(x.deliveredAt))}</span></div><strong>${eur(x.earnings)}</strong></li>`).join('')}</ul>` : '<p class="col-empty">Your finished deliveries show here.</p>'}
    </section>`;
  $$take(busy);
}

/* While busy, offers stay visible but can't be taken. */
function $$take(busy) { root.querySelectorAll('[data-act="take"]').forEach(b => { b.disabled = busy; }); }

root.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const id = el.dataset.id;
  const paths = { take: 'accept', pickedup: 'pickedup', delivered: 'delivered' };
  const done = { take: 'Delivery accepted. Head to the restaurant.', pickedup: 'Picked up. Off you go!', delivered: 'Delivered. Nice work!' };
  if (!paths[el.dataset.act]) return;
  el.disabled = true;
  try { await call('POST', `/courier/deliveries/${id}/${paths[el.dataset.act]}`); toast(done[el.dataset.act]); window.scrollTo({ top: 0 }); }
  catch (err) { toast(err.message); }
  lastSig = '';
  await load();
});

gate(root, {
  roles: ['courier'],
  title: 'Morsel courier',
  intro: 'Log in with your courier account to see deliveries near you.',
  ready: user => {
    me = user;
    root.innerHTML = '<div class="sk sk-item" aria-busy="true"></div>';
    /* Polling also tells the server a courier is online, so the autopilot leaves new deliveries for you. */
    every(4000, load);
  }
});
