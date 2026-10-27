import { $, esc, eur, clock, plural, reduced, logoBadge } from '../util.js';
import { ic, art } from '../art.js';
import { api } from '../api.js';
import { state, R, menuOf, loadMenu, isOpen, etaText, basketLines, basketCount, basketSubtotal, allBaskets, clearBasket, setPromo, pricing, priceRows, promoError, promoKey, describeLine, findItem } from '../state.js';
import { hasPhoto, photoImg, photoStyle } from '../photos.js';
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

/* Checkout is for one restaurant's basket. Without one (an old #checkout link), pick a basket first. */
const checkoutSlug = () => {
  if (state.params.slug) return state.params.slug;
  const list = allBaskets().filter(b => R(b.slug));
  return list.length === 1 ? list[0].slug : null;
};

export function renderCheckout() {
  const slug = checkoutSlug();
  const r = slug ? R(slug) : null;
  if (!r || !basketLines(slug).length) {
    const list = allBaskets().filter(b => R(b.slug));
    app().innerHTML = list.length
      ? `<div class="wrap page"><h1 class="page-title">Which order?</h1><p class="lead">Each restaurant has its own basket. Choose one to check out.</p>
          <ul class="basket-choices">${list.map(b => { const x = R(b.slug); return `<li><button class="radio-card" type="button" data-act="checkout-basket" data-r="${esc(b.slug)}">${logoBadge(x)}<span class="rc-main"><strong>${esc(x.name)}</strong><span class="sub">${plural(b.count, 'item', 'items')} · ${eur(b.subtotal)}</span></span>${ic('back', 'chev-r')}</button></li>`; }).join('')}</ul></div>`
      : `<div class="wrap"><div class="empty"><div class="empty-art">${art('cupcake')}</div><h3>Nothing to check out yet</h3><p>Pick a restaurant and add a few things, then come back to check out.</p><button class="btn btn-primary" type="button" data-act="home">Browse restaurants</button></div></div>`;
    return;
  }
  /* Brings bag prices up to date with the menu before the customer pays. */
  if (!menuOf(r.slug)) loadMenu(r.slug).catch(() => {});
  const u = state.user;
  const p = pricing(slug, true);
  const open = isOpen(r);
  const slots = scheduleSlots(r);
  if (!open && state.co.when === 'asap') state.co.when = 'later';
  if (state.co.when === 'later' && !slots.some(s => String(s.getTime()) === state.co.slot)) state.co.slot = slots[0] ? String(slots[0].getTime()) : '';
  const promo = state.promo;
  if (promo) checkPromo(promo, r.slug);
  const promoErr = promo ? promoError(promo, r, p.subtotal) : '';
  const checking = promo && state.promoCheck.key !== promoKey(promo, r.slug);
  /* Dishes that sold out since they went into the bag, and a restaurant that paused orders. */
  const menu = menuOf(r.slug);
  const soldOut = menu ? basketLines(slug).filter(l => { const it = findItem(menu, l.itemSlug); return it && (it.soldOut || (l.parts && it.deal && it.deal.parts.some(pt => { const c = pt.choices.find(x => x.itemSlug === l.parts[pt.key]); return c && c.soldOut; }))); }) : [];
  const paused = !!(menu ? menu.paused : r.paused);
  const blocked = paused ? `${r.name} isn’t taking orders right now. Try again a little later.` : soldOut.length ? `${soldOut.map(l => l.name).join(', ')} ${soldOut.length === 1 ? 'is' : 'are'} sold out right now. Remove ${soldOut.length === 1 ? 'it' : 'them'} from your bag to order.` : '';
  const scroll = window.scrollY;
  app().innerHTML = `
    <div class="wrap">
      <div class="back-row"><button class="back-link" type="button" data-act="open-r" data-id="${esc(r.slug)}">${ic('back')}Back to ${esc(r.name)}</button></div>
      <h1 class="page-title">Checkout</h1>
      <div class="checkout">
        <div>
          ${blocked ? `<p class="notice" style="margin:0 0 16px">${esc(blocked)}</p>` : ''}
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
            <div class="sum-r"><span class="thumb ${hasPhoto(r) ? 'has-photo' : ''}" style="--cv:${r.color};${photoStyle(r)}">${art(r.illustration)}${photoImg(r, { size: 'thumb' })}</span><div><h2 id="co-sum" style="margin:0">${esc(r.name)}</h2><span class="muted" style="font-size:.92rem">${plural(basketCount(slug), 'item', 'items')}</span></div></div>
            <ul class="sum-items">${basketLines(slug).map(l => { const d = describeLine(l); return `<li><span><span class="q">${l.qty}×</span>${esc(l.name)}${d ? `<br><span class="muted" style="font-size:.85rem">${esc(d)}</span>` : ''}${l.note ? `<br><span class="muted" style="font-size:.85rem">Note: “${esc(l.note)}”</span>` : ''}</span><span>${eur(l.unitPrice * l.qty)}</span></li>`; }).join('')}</ul>
            <p class="sub-label">Promo code</p>
            ${promo && checking ? `<div class="applied"><span>${ic('tag')} Checking ${esc(promo)}…</span></div>`
              : promo && !promoErr ? `<div class="applied"><span>${ic('tag')} ${esc(promo)} applied</span><button class="link-btn" type="button" data-act="remove-promo">Remove</button></div>`
              : `<div class="promo-row"><label class="visually-hidden" for="promo">Promo code</label><input class="input" id="promo" placeholder="Enter code" value="${esc(promo || '')}" autocomplete="off"><button class="btn btn-secondary" type="button" data-act="apply-promo" style="min-height:46px">Apply</button></div>
                 <p class="err" id="promo-err" style="margin-top:6px">${promo ? esc(promoErr) : ''}</p>`}
            <p class="sub-label">Tip your courier</p>
            <div class="tips" role="group" aria-label="Courier tip">${[0, 100, 200, 300].map(v => `<button class="pill" type="button" data-act="tip" data-v="${v}" aria-pressed="${state.tip === v}">${v ? eur(v) : 'None'}</button>`).join('')}</div>
            ${priceRows(p, { tip: true })}
            <button class="btn btn-primary btn-block btn-split" type="button" data-act="place-order" id="place-btn" style="margin-top:16px" ${blocked ? 'disabled' : ''}><span>Place order</span><span>${eur(p.total)}</span></button>
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

/* Asks the server about the code once per user, order count and restaurant, then redraws. */
let checkingKey = '';
function checkPromo(code, slug) {
  const key = promoKey(code, slug);
  if (state.promoCheck.key === key || checkingKey === key) return;
  checkingKey = key;
  api.validatePromo(code, slug, basketSubtotal(slug))
    .then(rule => { state.promoRule = rule; state.promoCheck = { key, error: '' }; })
    .catch(err => { state.promoCheck = { key, error: err.code === 'invalid_promo' || err.code === 'validation_failed' ? err.message : '' }; })
    .finally(() => { checkingKey = ''; if (state.view === 'checkout') renderCheckout(); });
}

let applying = false;
export async function applyPromo() {
  const input = $('#promo');
  if (!input || applying) return;
  const code = input.value.trim().toUpperCase();
  const errEl = $('#promo-err');
  if (!code) { errEl.textContent = 'Enter a promo code.'; input.focus(); return; }
  applying = true;
  const slug = checkoutSlug();
  try {
    state.promoRule = await api.validatePromo(code, slug, basketSubtotal(slug));
  } catch (err) {
    applying = false;
    errEl.textContent = err.message;
    input.focus();
    return;
  }
  applying = false;
  setPromo(code);
  state.promoCheck = { key: promoKey(code, slug), error: '' };
  renderCheckout();
  toast(`${code} applied`);
}

export async function placeOrder() {
  if (!state.user) { openAuth('login', { reason: 'Log in to place your order. Your bag is saved.' }); return; }
  const slug = checkoutSlug();
  const r = R(slug);
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
  const p = pricing(slug, true);
  const later = state.co.when === 'later';
  const promo = state.promo;
  try {
    const order = await api.createOrder({
      restaurantSlug: r.slug,
      items: basketLines(slug).map(l => ({ itemSlug: l.itemSlug, qty: l.qty, options: l.sel, remove: l.remove || [], ...(l.parts ? { parts: l.parts } : {}), note: l.note })),
      addressId: addr._id,
      payment: state.co.pay,
      courierNote: state.co.note.trim(),
      delivery: later ? { type: 'scheduled', at: Number(state.co.slot) } : { type: 'asap' },
      promoCode: promo && !promoError(promo, r, p.subtotal) && (p.discount || p.deliveryDiscount) ? promo : null,
      tip: state.tip,
      expectedTotal: p.total
    });
    state.orderCount += 1;
    state.tip = 100; state.co.note = ''; state.co.when = 'asap';
    clearBasket(slug);
    setPromo(null);
    go('order', { id: order._id });
    toast('Order placed');
  } catch (err) {
    if (err.code === 'price_mismatch' || err.code === 'sold_out' || err.code === 'restaurant_paused') {
      try { await loadMenu(r.slug, { fresh: true }); } catch (e) { /* keep the message below */ }
      if (state.view === 'checkout') renderCheckout();
    } else if (state.view === 'checkout' && document.contains(btn)) {
      btn.disabled = false;
      btn.innerHTML = `<span>Place order</span><span>${eur(p.total)}</span>`;
    }
    toast(err.message);
  }
}
