import { esc, eur, dayTime } from '../util.js';
import { ic, art } from '../art.js';
import { api } from '../api.js';
import { state, R, loadMenu, priceRows, describeLine } from '../state.js';
import { app } from '../router.js';

const LOGO = '<svg class="logo-mark" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" style="fill:var(--brand)"/><circle cx="18.5" cy="21" r="11.5" style="fill:var(--brand-ink)" mask="url(#mk-bite)"/><circle cx="31.4" cy="29.6" r="2.5" style="fill:var(--accent)"/></svg>';

/* A receipt for one of your orders, laid out to print on one page. */
export async function renderReceipt(id) {
  if (!state.user) {
    app().innerHTML = `<div class="wrap"><div class="empty"><div class="empty-art">${art('bowl')}</div><h1 class="empty-h">Log in to see this receipt</h1><p>Receipts are kept with your account.</p><button class="btn btn-primary" type="button" data-act="login">Log in</button></div></div>`;
    return;
  }
  app().innerHTML = `<div class="wrap receipt-page" aria-busy="true" aria-label="Loading receipt"><div class="sk sk-title"></div><div class="sk sk-item" style="margin-top:24px;height:420px"></div></div>`;
  let o;
  try { o = await api.getOrder(id); }
  catch (err) {
    if (state.view !== 'receipt' || state.params.id !== id) return;
    app().innerHTML = `<div class="wrap"><div class="empty"><div class="empty-art">${art('bowl')}</div><h1 class="empty-h">Receipt not found</h1><p>${esc(err.message)}</p><a class="btn btn-primary" href="/orders">See your orders</a></div></div>`;
    return;
  }
  const detail = await loadMenu(o.restaurantSlug).catch(() => null);
  if (state.view !== 'receipt' || state.params.id !== id) return;
  const r = detail || R(o.restaurantSlug) || {};
  const number = String(o._id).slice(-8).toUpperCase();
  document.title = `Receipt ${number} · Morsel`;
  const where = r.address && r.address.street ? `${esc(r.address.street)}, ${esc(r.address.area)}` : '';
  const a = o.address || {};
  const cancelled = o.status === 'cancelled';
  app().innerHTML = `
    <div class="wrap receipt-page">
      <div class="receipt-actions no-print">
        <a class="back-link" href="/order/${esc(o._id)}">${ic('back')}Back to the order</a>
        <button class="btn btn-primary" type="button" data-act="print">${ic('print')}Print receipt</button>
      </div>
      <article class="receipt panel" aria-labelledby="rc-title">
        <header class="rc-head">
          <div class="rc-brand">${LOGO}<span>morsel</span></div>
          <div class="rc-id"><h1 id="rc-title">Receipt</h1><p>Order ${esc(number)}</p></div>
        </header>
        ${cancelled ? `<p class="rc-cancelled">This order was cancelled${o.cancelReason ? `: ${esc(o.cancelReason)}` : ''}. Nothing was charged.</p>` : ''}
        <dl class="rc-meta">
          <div><dt>Date</dt><dd>${dayTime(new Date(o.createdAt))}</dd></div>
          <div><dt>From</dt><dd><strong>${esc(o.restaurantName)}</strong>${where ? `<br>${where}` : ''}</dd></div>
          <div><dt>Delivered to</dt><dd>${esc(o.customerName || state.user.name)}<br>${esc(a.street || '')}${a.details ? `, ${esc(a.details)}` : ''}<br>${esc(a.city || '')}</dd></div>
          <div><dt>Payment</dt><dd>${o.payment === 'cash' ? 'Cash on delivery' : 'Card ending in 4242'}</dd></div>
        </dl>
        <table class="rc-lines">
          <caption class="visually-hidden">What you ordered</caption>
          <thead><tr><th scope="col">Item</th><th scope="col" class="num">Qty</th><th scope="col" class="num">Price</th><th scope="col" class="num">Amount</th></tr></thead>
          <tbody>${o.items.map(l => {
            const d = describeLine(l);
            return `<tr><td><strong>${esc(l.name)}</strong>${d ? `<small>${esc(d)}</small>` : ''}${l.note ? `<small>Note: “${esc(l.note)}”</small>` : ''}</td><td class="num">${l.qty}</td><td class="num">${eur(l.unitPrice)}</td><td class="num">${eur(l.unitPrice * l.qty)}</td></tr>`;
          }).join('')}</tbody>
        </table>
        <div class="rc-totals">${priceRows(o.pricing, { tip: o.pricing.tip > 0, promo: o.promoCode, totalLabel: cancelled ? 'Total (not charged)' : o.payment === 'cash' ? 'Total paid in cash' : 'Total charged' })}</div>
        <p class="rc-note">Prices include VAT. Morsel is a demo: no real payment was taken and no food was delivered.</p>
        <p class="rc-note">Questions about this order? Write to us from the Help centre and mention order ${esc(number)}.</p>
      </article>
    </div>`;
}
