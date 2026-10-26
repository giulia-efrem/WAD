import { esc, eur, dayTime, initials } from '../util.js';
import { ic, art } from '../art.js';
import { api } from '../api.js';
import { state, R, catalog, isOpen } from '../state.js';
import { hasPhoto, photoImg, photoStyle } from '../photos.js';
import { progress } from '../progress.js';
import { cardHTML } from './home.js';
import { addrIcon, addrLine } from './addresses.js';
import { app } from '../router.js';

export async function renderAccount() {
  const u = state.user;
  if (!u) {
    app().innerHTML = `<div class="wrap"><div class="empty"><div class="empty-art">${art('burger')}</div><h3>Your account</h3><p>Log in to see your orders, saved addresses and favourite restaurants.</p><button class="btn btn-primary" type="button" data-act="login">Log in</button> <button class="btn btn-outline" type="button" data-act="signup">Sign up</button></div></div>`;
    return;
  }
  const tabs = [['orders', 'Orders'], ['addresses', 'Addresses'], ['favorites', 'Favourites'], ['profile', 'Profile']];
  const tab = state.acctTab;
  app().innerHTML = `
    <div class="wrap">
      <div class="acct-head"><span class="avatar-lg" aria-hidden="true">${esc(initials(u.name))}</span><div><h1>${esc(u.name)}</h1><p>${esc(u.email)}</p></div></div>
      <div class="tabs" role="tablist" aria-label="Account sections">${tabs.map(([k, l]) => `<button type="button" role="tab" id="tab-${k}" aria-selected="${tab === k}" aria-controls="acct-panel" data-act="acct-tab" data-tab="${k}">${l}</button>`).join('')}</div>
      <div class="tab-panel" id="acct-panel" role="tabpanel" aria-labelledby="tab-${tab}"></div>
    </div>`;
  const panel = document.getElementById('acct-panel');
  if (tab === 'orders') {
    panel.innerHTML = '<div aria-busy="true" aria-label="Loading orders">' + '<div class="sk sk-order"></div>'.repeat(3) + '</div>';
    let orders;
    try { orders = await api.listOrders(); }
    catch (err) { if (panel.isConnected) panel.innerHTML = `<p class="muted" style="margin:18px 0">${esc(err.message)}</p>`; return; }
    if (!panel.isConnected || state.acctTab !== 'orders') return;
    state.orderCount = orders.length;
    panel.innerHTML = orders.length ? orders.map(o => {
      const r = R(o.restaurantSlug) || catalog.list[0] || { color: '#EEE', illustration: 'bowl' };
      const st = progress(o).stage;
      const status = st === 'delivered' ? '<span class="status done">Delivered</span>' : st === 'scheduled' ? '<span class="status live">Scheduled</span>' : '<span class="status live">In progress</span>';
      return `<div class="order-row">
        <span class="thumb ${hasPhoto(r) ? 'has-photo' : ''}" style="--cv:${r.color};${photoStyle(r)}">${art(r.illustration)}${photoImg(r, { size: 'thumb' })}</span>
        <div><h3>${esc(o.restaurantName)} ${status}${o.rating ? `<span class="mini-stars" aria-label="Rated ${o.rating.stars} of 5">${Array.from({ length: o.rating.stars }, () => ic('star', 'fill')).join('')}</span>` : ''}</h3>
          <p>${dayTime(new Date(o.createdAt))}</p>
          <p>${esc(o.items.map(i => `${i.qty}× ${i.name}`).join(', '))}</p></div>
        <div class="order-actions"><strong>${eur(o.pricing.total)}</strong>
          ${st === 'delivered' ? `<button class="btn btn-sm btn-secondary" type="button" data-act="reorder" data-id="${esc(o._id)}">Reorder</button><button class="link-btn" type="button" data-act="track" data-id="${esc(o._id)}" style="font-size:.88rem">Details</button>` : `<button class="btn btn-sm btn-primary" type="button" data-act="track" data-id="${esc(o._id)}">Track</button>`}</div>
      </div>`;
    }).join('') : `<div class="empty"><div class="empty-art">${art('pizza')}</div><h3>No orders yet</h3><p>Your first order gets 20% off with WELCOME20.</p><button class="btn btn-primary" type="button" data-act="home">Find something to eat</button></div>`;
  } else if (tab === 'addresses') {
    panel.innerHTML = (u.addresses.length ? u.addresses.map(a => `
      <div class="addr-row">
        <span class="rc-ic">${addrIcon(a)}</span>
        <div class="main"><strong>${esc(a.label)}${a.isDefault ? '<span class="default-tag">Default</span>' : ''}</strong><p>${addrLine(a)}</p></div>
        <div class="acts">${a.isDefault ? '' : `<button class="btn btn-sm btn-secondary" type="button" data-act="default-addr" data-id="${a._id}">Make default</button>`}<button class="btn btn-sm btn-outline" type="button" data-act="del-addr" data-id="${a._id}">Delete</button></div>
      </div>`).join('') : '<p class="muted" style="margin:18px 0">No saved addresses yet.</p>') +
      `<button class="btn btn-primary section-gap" type="button" data-act="add-addr">${ic('plus')}Add an address</button>`;
  } else if (tab === 'favorites') {
    const favs = catalog.list.filter(r => u.favorites.includes(r._id));
    panel.innerHTML = favs.length ? `<div class="grid" style="padding-top:18px">${favs.map(r => cardHTML({ r, match: '', open: isOpen(r) })).join('')}</div>`
      : `<div class="empty"><div class="empty-art">${art('cupcake')}</div><h3>No favourites yet</h3><p>Tap the heart on any restaurant to keep it here.</p><button class="btn btn-primary" type="button" data-act="home">Browse restaurants</button></div>`;
  } else {
    panel.innerHTML = `<dl class="profile-list">
        <div><dt>Name</dt><dd>${esc(u.name)}</dd></div>
        <div><dt>Email</dt><dd>${esc(u.email)}</dd></div>
        <div><dt>Member since</dt><dd>${new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</dd></div>
        <div><dt>Orders placed</dt><dd>${state.orderCount}</dd></div>
      </dl>
      ${u.role === 'admin' ? `<a class="btn btn-secondary" href="/admin" style="margin-right:8px">${ic('camera')}Manage photos</a>` : ''}
      <button class="btn btn-outline" type="button" data-act="logout">Log out</button>`;
  }
}
