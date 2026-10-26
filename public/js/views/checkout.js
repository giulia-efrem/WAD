import { $, esc, eur, clock, plural, reduced } from '../util.js';
import { ic, art } from '../art.js';
import { api } from '../api.js';
import { state, R, menuOf, loadMenu, isOpen, etaText, cartCount, clearCart, setPromo, pricing, priceRows, promoError } from '../state.js';
import { photoUrl, photoImg } from '../photos.js';
import { toast } from '../ui.js';
import { openAuth } from './auth.js';
import { addrIcon, addrLine } from './addresses.js';
import { app, go } from '../router.js';

function scheduleSlots(r) {
  const slots = [];
  const now = new Date();
  let t = new Date(now.getTime() + 60 * 60000);
  t.setMinutes(Math.ceil(t.getMinutes() / 15) * 15, 0, 0);
  for (let i = 0; i < 16 && slots.length < 10; i++) {
    const d = new Date(t.getTime() + i * 15 * 60000);
    if (isOpen(r, d.getHours() * 60 + d.getMinutes())) slots.push(d);
  }
  return slots;
}

export function renderCheckout() {
  const r = R(state.cart.restaurantSlug);
  if (!r || !state.cart.lines.length) {
    app().innerHTML = `<div class="wrap"><div class="empty"><div class="empty-art">${art('cupcake')}</div><h3>Your bag is empty</h3><p>Pick a restaurant and add a few things, then come back to check out.</p><button class="btn btn-primary" type="button" data-act="home">Browse restaurants</button></div></div>`;
    return;
  }
  /* Brings bag prices up to date with the menu before the customer pays. */
  if (!menuOf(r.slug)) loadMenu(r.slug).catch(() => {});
  const u = state.user;
  const p = pricing(true);
  const open = isOpen(r);
  const slots = scheduleSlots(r);
  if (!open && state.co.when === 'asap') state.co.when = 'later';
  if (state.co.when === 'later' && !slots.some(s => String(s.getTime()) === state.co.slot)) state.co.slot = slots[0] ? String(slots[0].getTime()) : '';
  const promo = state.cart.promo;
  const promoErr = promo ? promoError(promo, r) : '';
  const scroll = window.scrollY;
  app().innerHTML = `
    <div class="wrap">
      <div class="back-row"><button class="back-link" type="button" data-act="open-r" data-id="${esc(r.slug)}">${ic('back')}Back to ${esc(r.name)}</button></div>
      <h1 class="page-title">Checkout</h1>
      <div class="checkout">
        <div>
          ${u ? '' : `<div class="login-card"><p><strong>Log in to place your order</strong>Your bag is saved. Log in or create an account to choose an address and pay.</p><button class="btn btn-primary" type="button" data-act="login">Log in</button><button class="btn btn-outline" type="button" data-act="signup">Sign up</button></div>`}
          <section class="panel" aria-labelledby="co-addr">
            <div class="panel-head"><h2 id="co-addr">Delivery address</h2>${u && u.addresses.length ? `<button class="btn btn-sm btn-secondary" type="button" data-act="add-addr">${ic('plus')}New</button>` : ''}</div>
            ${!u ? '<p class="muted" style="margin:0">Log in to add or choose an address.</p>'
              : !u.addresses.length ? `<p class="muted" style="margin:0 0 14px">You haven’t saved an address yet.</p><button class="btn btn-primary" type="button" data-act="add-addr">${ic('plus')}Add delivery address</button>`
              : u.addresses.map(a => `<label class="radio-card"><input type="radio" name="co-addr" value="${a._id}" ${state.co.addressId === a._id ? 'checked' : ''}>
                  <span class="rc-ic">${addrIcon(a)}</span>
                  <span class="rc-main"><strong>${esc(a.label)}</strong><span class="sub">${addrLine(a)}</span></span></label>`).join('')}
            <p class="err" id="err-addr"></p>
          </section>
          <section class="panel" aria-labelledby="co-when">
            <h2 id="co-when">Delivery time</h2>
            <label class="radio-card" ${open ? '' : 'style="opacity:.5;cursor:not-allowed"'}><input type="radio" name="co-when" value="asap" ${state.co.when === 'asap' ? 'checked' : ''} ${open ? '' : 'disabled'}>
              <span class="rc-ic">${ic('bolt')}</span><span class="rc-main"><strong>As soon as possible</strong><span class="sub">${open ? `Arrives in about ${etaText(r)}` : `${esc(r.name)} is closed right now`}</span></span></label>
            <label class="radio-card"><input type="radio" name="co-when" value="later" ${state.co.when === 'later' ? 'checked' : ''} ${slots.length ? '' : 'disabled'}>
              <span class="rc-ic">${ic('calendar')}</span><span class="rc-main"><strong>Schedule for later</strong><span class="sub">${slots.length ? 'Pick a time in the next few hours' : 'No times available in the next few hours'}</span></span></label>
            ${state.co.when === 'later' && slots.length ? `<div class="field" style="margin:4px 0 0"><label for="co-slot">Arrival time</label><select class="input" id="co-slot">${slots.map(s => `<option value="${s.getTime()}" ${String(s.getTime()) === state.co.slot ? 'selected' : ''}>${s.getDate() === new Date().getDate() ? 'Today' : 'Tomorrow'} at ${clock(s)}</option>`).join('')}</select></div>` : ''}
          </section>
          <section class="panel" aria-labelledby="co-pay">
            <h2 id="co-pay">Payment</h2>
            <label class="radio-card"><input type="radio" name="co-pay" value="card" ${state.co.pay === 'card' ? 'checked' : ''}><span class="rc-ic">${ic('card')}</span><span class="rc-main"><strong>Card ending in 4242</strong><span class="sub">Demo card, nothing is charged</span></span></label>
            <label class="radio-card"><input type="radio" name="co-pay" value="cash" ${state.co.pay === 'cash' ? 'checked' : ''}><span class="rc-ic">${ic('cash')}</span><span class="rc-main"><strong>Cash on delivery</strong><span class="sub">Pay the courier when your food arrives</span></span></label>
          </section>
          <section class="panel" aria-labelledby="co-note-h">
            <h2 id="co-note-h">Note for the courier</h2>
            <div class="field" style="margin:0"><label class="visually-hidden" for="co-note">Note for the courier</label><textarea class="input" id="co-note" maxlength="160" placeholder="Ring twice, the buzzer is broken">${esc(state.co.note)}</textarea></div>
          </section>
        </div>
        <aside class="sticky-sum">
          <section class="panel" aria-labelledby="co-sum">
            <div class="sum-r"><span class="thumb ${photoUrl(r) ? 'has-photo' : ''}" style="--cv:${r.color}">${art(r.illustration)}${photoImg(photoUrl(r))}</span><div><h2 id="co-sum" style="margin:0">${esc(r.name)}</h2><span class="muted" style="font-size:.92rem">${plural(cartCount(), 'item', 'items')}</span></div></div>
            <ul class="sum-items">${state.cart.lines.map(l => `<li><span><span class="q">${l.qty}×</span>${esc(l.name)}${l.options.length ? `<br><span class="muted" style="font-size:.85rem">${esc(l.options.map(o => o.choice).join(', '))}</span>` : ''}</span><span>${eur(l.unitPrice * l.qty)}</span></li>`).join('')}</ul>
            <p class="sub-label">Promo code</p>
            ${promo && !promoErr ? `<div class="applied"><span>${ic('tag')} ${esc(promo)} applied</span><button class="link-btn" type="button" data-act="remove-promo">Remove</button></div>`
              : `<div class="promo-row"><label class="visually-hidden" for="promo">Promo code</label><input class="input" id="promo" placeholder="Enter code" value="${esc(promo || '')}" autocomplete="off"><button class="btn btn-secondary" type="button" data-act="apply-promo" style="min-height:46px">Apply</button></div>
                 <p class="err" id="promo-err" style="margin-top:6px">${promo ? esc(promoErr) : ''}</p>`}
            <p class="sub-label">Tip your courier</p>
            <div class="tips" role="group" aria-label="Courier tip">${[0, 100, 200, 300].map(v => `<button class="pill" type="button" data-act="tip" data-v="${v}" aria-pressed="${state.tip === v}">${v ? eur(v) : 'None'}</button>`).join('')}</div>
            ${priceRows(p, { tip: true })}
            <button class="btn btn-primary btn-block btn-split" type="button" data-act="place-order" id="place-btn" style="margin-top:16px"><span>Place order</span><span>${eur(p.total)}</span></button>
            <p class="fine">This is a demo checkout. No payment is taken.</p>
          </section>
        </aside>
      </div>
    </div>`;
  window.scrollTo(0, scroll);
  const slot = $('#co-slot');
  if (slot) slot.addEventListener('change', e => { state.co.slot = e.target.value; });
  $('#co-note').addEventListener('input', e => { state.co.note = e.target.value; });
  const promoInput = $('#promo');
  if (promoInput) promoInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyPromo(); } });
}

let applying = false;
export async function applyPromo() {
  const input = $('#promo');
  if (!input || applying) return;
  const code = input.value.trim().toUpperCase();
  const errEl = $('#promo-err');
  if (!code) { errEl.textContent = 'Enter a promo code.'; input.focus(); return; }
  applying = true;
  try {
    await api.validatePromo(code, state.cart.restaurantSlug);
  } catch (err) {
    applying = false;
    errEl.textContent = err.message;
    input.focus();
    return;
  }
  applying = false;
  setPromo(code);
  renderCheckout();
  toast(`${code} applied`);
}

export async function placeOrder() {
  if (!state.user) { openAuth('login', { reason: 'Log in to place your order. Your bag is saved.' }); return; }
  const r = R(state.cart.restaurantSlug);
  const addr = state.user.addresses.find(a => a._id === state.co.addressId);
  if (!addr) {
    const err = $('#err-addr');
    if (err) err.textContent = state.user.addresses.length ? 'Choose where to deliver your order.' : 'Add an address so the courier knows where to go.';
    $('#co-addr').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    return;
  }
  if (state.co.when === 'asap' && !isOpen(r)) { toast(`${r.name} is closed. Schedule your order for later.`); return; }
  if (state.co.when === 'later' && !state.co.slot) { toast('Pick an arrival time.'); return; }
  const btn = $('#place-btn');
  btn.disabled = true;
  btn.innerHTML = '<span><span class="spinner" style="display:inline-block;vertical-align:-3px;margin-right:8px"></span>Placing order…</span>';
  const p = pricing(true);
  const later = state.co.when === 'later';
  const promo = state.cart.promo;
  try {
    const order = await api.createOrder({
      restaurantSlug: r.slug,
      items: state.cart.lines.map(l => ({ itemSlug: l.itemSlug, qty: l.qty, options: l.sel, note: l.note })),
      addressId: addr._id,
      payment: state.co.pay,
      courierNote: state.co.note.trim(),
      delivery: later ? { type: 'scheduled', at: Number(state.co.slot) } : { type: 'asap' },
      promoCode: promo && !promoError(promo, r) && (p.discount || p.deliveryDiscount) ? promo : null,
      tip: state.tip,
      expectedTotal: p.total
    });
    state.orderCount += 1;
    state.tip = 100; state.co.note = ''; state.co.when = 'asap';
    clearCart();
    go('order', { id: order._id });
    toast('Order placed');
  } catch (err) {
    if (err.code === 'price_mismatch') {
      try { await loadMenu(r.slug, { fresh: true }); } catch (e) { /* keep the message below */ }
      if (state.view === 'checkout') renderCheckout();
    } else if (state.view === 'checkout' && document.contains(btn)) {
      btn.disabled = false;
      btn.innerHTML = `<span>Place order</span><span>${eur(p.total)}</span>`;
    }
    toast(err.message);
  }
}
