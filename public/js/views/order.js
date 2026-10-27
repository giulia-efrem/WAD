import { $, $$, esc, eur, clock, dayTime, clamp, initials, plural } from '../util.js';
import { ic, ICON, FOOD } from '../art.js';
import { api } from '../api.js';
import { state, R, catalog, describeChoices } from '../state.js';
import { progress, serverNow } from '../progress.js';
import { toast } from '../ui.js';
import { app, onLeave } from '../router.js';

const restaurantOf = o => R(o.restaurantSlug) || { name: o.restaurantName, color: catalog.list[0] ? catalog.list[0].color : '#EEE', illustration: 'bowl' };

export function stageCopy(o, pr) {
  const r = restaurantOf(o);
  const c = o.courier.name, v = o.courier.vehicle;
  switch (pr.stage) {
    case 'scheduled': return { title: `Scheduled for ${clock(new Date(o.delivery.at))}`, sub: `We’ll send your order to ${r.name}’s kitchen at the right time.` };
    case 'placed': return { title: 'Sending your order', sub: `Waiting for ${r.name} to accept it.` };
    case 'confirmed': return { title: 'Order confirmed', sub: `${r.name} has accepted your order.` };
    case 'preparing': return { title: 'Preparing your food', sub: `The kitchen is on it. ${c} will pick it up when it’s ready.` };
    case 'pickup': return { title: `${c} is picking up your order`, sub: 'Your food is being packed for the ride.' };
    case 'onway': return { title: 'On the way', sub: `${c} is heading to you by ${v}.` };
    default: return { title: 'Delivered. Enjoy your meal!', sub: `${c} dropped it off at ${o.address.street}.` };
  }
}

const ROUTE = [[96, 236], [96, 192], [236, 192], [236, 118], [326, 118], [326, 74]];
function routePoint(frac) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < ROUTE.length; i++) { const l = Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1]); segs.push(l); total += l; }
  let d = clamp(frac, 0, 1) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i]) { const t = d / segs[i]; return [ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * t, ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * t]; }
    d -= segs[i];
  }
  return ROUTE[ROUTE.length - 1];
}
function mapSVG(o) {
  const r = restaurantOf(o);
  const xs = [24, 96, 166, 236, 326, 400], ys = [-10, 44, 118, 192, 266, 340];
  let blocks = '';
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    const x = xs[i] + 8, y = ys[j] + 8, w = xs[i + 1] - xs[i] - 16, h = ys[j + 1] - ys[j] - 16;
    if (w <= 0 || h <= 0) continue;
    const park = (i === 2 && j === 3);
    blocks += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" style="fill:var(${park ? '--map-park' : '--map-block'})"/>`;
  }
  const roads = xs.map(x => `<path d="M${x} -20 V340"/>`).join('') + ys.map(y => `<path d="M-20 ${y} H420"/>`).join('');
  const pts = ROUTE.map(p => p.join(',')).join(' ');
  return `<svg viewBox="0 0 400 320" role="img" aria-label="Map showing your courier’s route from ${esc(r.name)} to your address">
    <rect width="400" height="320" style="fill:var(--map-bg)"/>
    ${blocks}
    <path d="M260 -10 C300 60 360 40 410 90" style="stroke:var(--map-water)" stroke-width="22" fill="none" stroke-linecap="round"/>
    <g style="stroke:var(--map-road)" stroke-width="9" stroke-linecap="round">${roads}</g>
    <polyline points="${pts}" fill="none" style="stroke:var(--muted)" stroke-width="3.5" stroke-dasharray="2 7" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>
    <polyline id="route-done" points="${pts}" pathLength="1" fill="none" style="stroke:var(--brand)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 1" stroke-dashoffset="1"/>
    <g transform="translate(${ROUTE[0][0]} ${ROUTE[0][1]})">
      <circle r="17" style="fill:${r.color};stroke:var(--surface)" stroke-width="3"/>
      <svg x="-13" y="-13" width="26" height="26" viewBox="0 0 120 120">${FOOD[r.illustration] || ''}</svg>
    </g>
    <text class="map-label" x="${ROUTE[0][0] + 24}" y="${ROUTE[0][1] + 4}">${esc(r.name)}</text>
    <g transform="translate(${ROUTE[ROUTE.length - 1][0]} ${ROUTE[ROUTE.length - 1][1]})">
      <circle r="16" style="fill:var(--brand);stroke:var(--surface)" stroke-width="3"/>
      <path d="M-7 -1 L0 -7 L7 -1 V7 H-7 Z" style="fill:var(--brand-ink)"/>
    </g>
    <text class="map-label" x="${ROUTE[ROUTE.length - 1][0] - 22}" y="${ROUTE[ROUTE.length - 1][1] + 4}" text-anchor="end">You</text>
    <g id="courier" transform="translate(${ROUTE[0][0]} ${ROUTE[0][1]})" style="opacity:0">
      <circle class="courier-ring" r="14" style="fill:var(--accent)" opacity=".5"/>
      <circle r="13" style="fill:var(--accent);stroke:var(--surface)" stroke-width="3"/>
      <g transform="translate(-8 -8) scale(.68)" style="stroke:var(--accent-ink)" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICON.bike}</g>
    </g>
  </svg>`;
}

const SERVER_REFRESH_MS = 10000;

export async function renderOrder(id) {
  if (!state.user) {
    app().innerHTML = `<div class="wrap"><div class="empty"><h3>Log in to see this order</h3><p>Orders are linked to your account.</p><button class="btn btn-primary" type="button" data-act="login">Log in</button></div></div>`;
    return;
  }
  app().innerHTML = `<div class="wrap" aria-busy="true" aria-label="Loading order"><div class="track" style="padding-top:28px"><div><div class="sk sk-text w40"></div><div class="sk sk-title"></div><div class="sk sk-text w60" style="margin-top:18px"></div><div class="sk sk-item" style="margin-top:28px"></div></div><div class="sk" style="aspect-ratio:5/4;border-radius:24px"></div></div></div>`;
  let o;
  try { o = await api.getOrder(id); }
  catch (err) {
    if (state.view !== 'order' || state.params.id !== id) return;
    app().innerHTML = `<div class="wrap"><div class="empty"><h3>Order not found</h3><p>${esc(err.message)}</p><button class="btn btn-primary" type="button" data-act="account">See your orders</button></div></div>`;
    return;
  }
  if (state.view !== 'order' || state.params.id !== id) return;
  app().innerHTML = `
    <div class="wrap">
      <div class="back-row"><button class="back-link" type="button" data-act="account">${ic('back')}All orders</button></div>
      <div class="track">
        <div>
          <p class="track-kicker">${esc(o.restaurantName)}, ordered ${dayTime(new Date(o.createdAt))}</p>
          <h1 id="tr-title"></h1>
          <p class="track-sub" id="tr-sub"></p>
          <div class="eta-box" id="tr-eta"></div>
          <ol class="steps" id="tr-steps" aria-label="Order progress">
            ${['Confirmed', 'Preparing', 'On the way', 'Delivered'].map(l => `<li><span class="bar"><i></i></span><span class="lbl">${l}</span></li>`).join('')}
          </ol>
          <p class="demo-note" id="tr-demo" ${o.demoSpeed > 1 ? '' : 'hidden'}><span>Demo runs at ${esc(o.demoSpeed)}× speed.</span><button class="link-btn" type="button" data-act="skip" data-id="${esc(o._id)}">Skip to next step</button></p>
          <div class="courier" id="tr-courier" hidden>
            <span class="avatar" aria-hidden="true">${esc(initials(o.courier.name))}</span>
            <p><strong>${esc(o.courier.name)}</strong> is your courier<br><small>Delivering by ${esc(o.courier.vehicle)}${o.courierNote ? `. Your note: “${esc(o.courierNote)}”` : ''}</small></p>
          </div>
          <div id="tr-rate"></div>
          <section class="panel section-gap" aria-labelledby="tr-details" style="margin-top:24px">
            <h2 id="tr-details">Order details</h2>
            <ul class="sum-items">${o.items.map(l => { const d = describeChoices(l.options, l.removed || []); return `<li><span><span class="q">${l.qty}×</span>${esc(l.name)}${d ? `<br><span class="muted" style="font-size:.85rem">${esc(d)}</span>` : ''}${l.note ? `<br><span class="muted" style="font-size:.85rem">Note: “${esc(l.note)}”</span>` : ''}</span><span>${eur(l.unitPrice * l.qty)}</span></li>`; }).join('')}</ul>
            ${priceRowsStatic(o)}
            <ul class="detail-list" style="margin-top:12px;border-top:1px solid var(--line);padding-top:8px">
              <li><span class="muted">Deliver to</span><span style="text-align:right">${esc(o.address.street)}${o.address.details ? ', ' + esc(o.address.details) : ''}</span></li>
              <li><span class="muted">Payment</span><span>${o.payment === 'cash' ? 'Cash on delivery' : 'Card ending in 4242'}</span></li>
            </ul>
          </section>
        </div>
        <div class="map-col"><div class="map">${mapSVG(o)}</div></div>
      </div>
    </div>`;
  let lastStage = '';
  let order = o;
  const tick = () => {
    if (state.view !== 'order' || state.params.id !== id) return;
    const pr = progress(order);
    const copy = stageCopy(order, pr);
    $('#tr-title').textContent = copy.title;
    $('#tr-sub').textContent = copy.sub;
    const eta = $('#tr-eta');
    if (pr.stage === 'delivered') eta.innerHTML = '';
    else if (pr.stage === 'scheduled') eta.innerHTML = `<div class="eta-big">${clock(new Date(order.delivery.at))}</div><div class="eta-label"><strong>Scheduled arrival</strong>${pr.pl.total} min after we start</div>`;
    else {
      const at = new Date(serverNow(order) + pr.remaining * 60000);
      eta.innerHTML = `<div class="eta-big">${pr.remaining} min</div><div class="eta-label"><strong>Estimated arrival</strong>around ${clock(at)}</div>`;
    }
    const s = pr.sim, pl = pr.pl;
    const fills = pr.stage === 'scheduled' ? [0, 0, 0, 0] : [
      clamp(s / pl.prepStart, 0, 1), clamp((s - pl.prepStart) / (pl.pickup - pl.prepStart), 0, 1),
      clamp((s - pl.pickup) / (pl.total - pl.pickup), 0, 1), s >= pl.total ? 1 : 0
    ];
    $$('#tr-steps li').forEach((li, i) => { $('i', li).style.width = (fills[i] * 100) + '%'; li.classList.toggle('reached', fills[i] > 0); });
    $('#tr-demo').hidden = pr.stage === 'delivered' || !(order.demoSpeed > 1);
    $('#tr-courier').hidden = !['pickup', 'onway', 'delivered'].includes(pr.stage);
    const courier = $('#courier');
    if (courier) {
      const [x, y] = routePoint(pr.frac);
      courier.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      courier.style.opacity = ['pickup', 'onway'].includes(pr.stage) ? '1' : '0';
      $('#route-done').setAttribute('stroke-dashoffset', String(1 - pr.frac));
    }
    if (pr.stage !== lastStage) {
      if (pr.stage === 'delivered') renderFeedback(order);
      lastStage = pr.stage;
    }
  };
  const refresh = async () => {
    try { order = await api.getOrder(id); tick(); } catch (e) { /* keep the last known order */ }
  };
  const timer = setInterval(tick, 500);
  /* The server stays the authority: re-read the order now and then, while it is still live. */
  const poll = setInterval(() => { if (progress(order).stage !== 'delivered') refresh(); }, SERVER_REFRESH_MS);
  onLeave(() => { clearInterval(timer); clearInterval(poll); });
  tick();
  state.refreshOrder = async updated => { if (updated) { order = updated; tick(); } else await refresh(); };
  onLeave(() => { state.refreshOrder = null; });
}

function priceRowsStatic(o) {
  const p = o.pricing;
  const rows = [['Subtotal', eur(p.subtotal)], ['Delivery', p.deliveryFee && !p.deliveryDiscount ? eur(p.deliveryFee) : '<span class="free">Free</span>'], ['Service fee', eur(p.serviceFee)]];
  if (p.smallOrderFee) rows.push(['Small order fee', eur(p.smallOrderFee)]);
  if (p.discount) rows.push([`Promo ${esc(o.promoCode || '')}`, `<span class="neg">−${eur(p.discount)}</span>`]);
  if (p.tip) rows.push(['Courier tip', eur(p.tip)]);
  return `<dl class="rows">${rows.map(([a, b]) => `<div class="row"><dt>${a}</dt><dd>${b}</dd></div>`).join('')}<div class="row total"><dt>Total</dt><dd>${eur(p.total)}</dd></div></dl>`;
}

/* After delivery: rate the food (1-5 stars) and the delivery (thumbs up or down), optional comment. */
function renderFeedback(o) {
  const box = $('#tr-rate');
  if (!box) return;
  if (o.review) {
    box.innerHTML = `<div class="rate"><div class="rated">${ic('check')}<span>You rated the food ${plural(o.review.food, 'star', 'stars')} and gave the delivery a thumbs ${o.review.delivery}. Thanks for the feedback.</span></div></div>`;
    return;
  }
  let food = 0, delivery = '';
  box.innerHTML = `<section class="rate panel" aria-labelledby="rate-h" style="margin-bottom:0">
    <h2 id="rate-h">How was your order?</h2>
    <p class="rate-label" id="rate-food-l">The food</p>
    <div class="stars" role="radiogroup" aria-labelledby="rate-food-l">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="false" data-star="${n}" aria-label="${plural(n, 'star', 'stars')}">${ic('star', 'fill')}</button>`).join('')}</div>
    <p class="rate-label" id="rate-del-l">The delivery</p>
    <div class="thumbs" role="radiogroup" aria-labelledby="rate-del-l">
      <button type="button" role="radio" aria-checked="false" data-thumb="up">${ic('thumb')}<span>Good</span></button>
      <button type="button" role="radio" aria-checked="false" data-thumb="down">${ic('thumb', 'flip')}<span>Not good</span></button>
    </div>
    <div class="field"><label for="rate-c">Anything to add? <small>Optional</small></label><textarea class="input" id="rate-c" maxlength="500" placeholder="What did you love, or what could be better?"></textarea></div>
    <p class="err" id="rate-err" role="alert"></p>
    <button class="btn btn-primary" type="button" id="rate-send" disabled>Send feedback</button>
  </section>`;
  const ready = () => { $('#rate-send').disabled = !(food && delivery); };
  const onClick = async e => {
    const s = e.target.closest('[data-star]');
    if (s) {
      food = Number(s.dataset.star);
      $$('[data-star]', box).forEach(b => { const on = Number(b.dataset.star) <= food; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(Number(b.dataset.star) === food)); });
      ready();
      return;
    }
    const t = e.target.closest('[data-thumb]');
    if (t) {
      delivery = t.dataset.thumb;
      $$('[data-thumb]', box).forEach(b => { const on = b === t; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
      ready();
      return;
    }
    if (e.target.closest('#rate-send') && food && delivery) {
      const btn = $('#rate-send');
      btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>Sending…';
      try {
        const updated = await api.reviewOrder(o._id, { food, delivery, comment: $('#rate-c').value.trim() });
        box.removeEventListener('click', onClick);
        renderFeedback(updated);
        if (state.refreshOrder) state.refreshOrder(updated);
        toast('Thanks for your feedback');
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Send feedback';
        $('#rate-err').textContent = err.message;
      }
    }
  };
  box.addEventListener('click', onClick);
}
