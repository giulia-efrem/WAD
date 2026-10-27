import { esc, eur, dayTime, initials } from '../util.js';
import { ic, art } from '../art.js';
import { api } from '../api.js';
import { state, R, catalog, isOpen } from '../state.js';
import { hasPhoto, photoImg, photoStyle } from '../photos.js';
import { progress } from '../progress.js';
import { toast, confirmDialog } from '../ui.js';
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
      const status = st === 'delivered' ? '<span class="status done">Delivered</span>' : st === 'cancelled' ? '<span class="status off">Cancelled</span>' : st === 'scheduled' ? '<span class="status live">Scheduled</span>' : '<span class="status live">In progress</span>';
      return `<div class="order-row">
        <span class="thumb ${hasPhoto(r) ? 'has-photo' : ''}" style="--cv:${r.color};${photoStyle(r)}">${art(r.illustration)}${photoImg(r, { size: 'thumb' })}</span>
        <div><h3>${esc(o.restaurantName)} ${status}${o.review ? `<span class="mini-stars" aria-label="You rated the food ${o.review.food} of 5">${Array.from({ length: o.review.food }, () => ic('star', 'fill')).join('')}</span>` : ''}</h3>
          <p>${dayTime(new Date(o.createdAt))}</p>
          <p>${esc(o.items.map(i => `${i.qty}× ${i.name}`).join(', '))}</p></div>
        <div class="order-actions"><strong>${eur(o.pricing.total)}</strong>
          ${st === 'delivered' || st === 'cancelled' ? `<button class="btn btn-sm btn-secondary" type="button" data-act="reorder" data-id="${esc(o._id)}">Reorder</button><button class="link-btn" type="button" data-act="track" data-id="${esc(o._id)}" style="font-size:.88rem">Details</button>` : `<button class="btn btn-sm btn-primary" type="button" data-act="track" data-id="${esc(o._id)}">Track</button>`}</div>
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
    renderProfile(panel, u);
  }
}

const STAFF_LINKS = { admin: ['/admin', 'Open the admin dashboard'], partner: ['/partner', 'Open your restaurant’s orders'], courier: ['/courier', 'Open your deliveries'] };

/* Profile: edit your name, change your password, delete your account. */
function renderProfile(panel, u) {
  const staff = STAFF_LINKS[u.role];
  panel.innerHTML = `<dl class="profile-list">
      <div><dt>Email</dt><dd>${esc(u.email)}</dd></div>
      <div><dt>Member since</dt><dd>${new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</dd></div>
      <div><dt>Orders placed</dt><dd>${state.orderCount}</dd></div>
      ${u.role !== 'customer' ? `<div><dt>Account type</dt><dd>${esc({ admin: 'Admin', partner: 'Restaurant partner', courier: 'Courier' }[u.role] || u.role)}</dd></div>` : ''}
    </dl>
    ${staff ? `<a class="btn btn-secondary" href="${staff[0]}" style="margin:0 8px 8px 0">${staff[1]}</a>` : ''}
    <form class="panel profile-form" id="pf-name" novalidate>
      <h2>Your name</h2>
      <div class="field"><label for="pf-name-in">Full name</label><input class="input" id="pf-name-in" name="name" autocomplete="name" maxlength="80" value="${esc(u.name)}" required></div>
      <p class="err" role="alert"></p>
      <button class="btn btn-primary" type="submit">Save name</button>
    </form>
    <form class="panel profile-form" id="pf-pass" novalidate>
      <h2>Change password</h2>
      <p class="muted">You’ll stay logged in here. Other devices are logged out.</p>
      <div class="field"><label for="pf-cur">Current password</label><input class="input" id="pf-cur" type="password" autocomplete="current-password" required></div>
      <div class="field"><label for="pf-new">New password <small>At least 8 characters</small></label><input class="input" id="pf-new" type="password" autocomplete="new-password" minlength="8" maxlength="72" required></div>
      <p class="err" role="alert"></p>
      <button class="btn btn-primary" type="submit">Change password</button>
    </form>
    ${u.role === 'customer' ? `<form class="panel profile-form danger-zone" id="pf-del" novalidate>
      <h2>Delete your account</h2>
      <p class="muted">This removes your account, saved addresses and favourites. Past orders and reviews stay with the restaurants, shown as “Former customer”. This can’t be undone.</p>
      <div class="field"><label for="pf-del-pass">Enter your password to confirm</label><input class="input" id="pf-del-pass" type="password" autocomplete="current-password" required></div>
      <p class="err" role="alert"></p>
      <button class="btn btn-danger" type="submit">Delete my account</button>
    </form>` : ''}
    <button class="btn btn-outline" type="button" data-act="logout">Log out</button>`;

  const busy = (form, on, label) => { const b = form.querySelector('[type=submit]'); b.disabled = on; if (label) b.textContent = label; };
  const fail = (form, err) => { form.querySelector('.err').textContent = err.message; };

  panel.querySelector('#pf-name').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget, name = form.name.value.trim();
    form.querySelector('.err').textContent = '';
    if (name.length < 2) return fail(form, { message: 'Enter your full name.' });
    busy(form, true);
    try {
      state.user = await api.updateMe({ name });
      window.dispatchEvent(new CustomEvent('morsel:user-changed'));
      toast('Name saved');
      document.querySelector('.acct-head h1').textContent = state.user.name;
    } catch (err) { fail(form, err); }
    busy(form, false);
  });
  panel.querySelector('#pf-pass').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget, cur = form.querySelector('#pf-cur').value, next = form.querySelector('#pf-new').value;
    form.querySelector('.err').textContent = '';
    if (!cur) return fail(form, { message: 'Enter your current password.' });
    if (next.length < 8) return fail(form, { message: 'Use at least 8 characters for the new password.' });
    busy(form, true);
    try { await api.changePassword(cur, next); form.reset(); toast('Password changed'); }
    catch (err) { fail(form, err); }
    busy(form, false);
  });
  const del = panel.querySelector('#pf-del');
  if (del) del.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget, pass = form.querySelector('#pf-del-pass').value;
    form.querySelector('.err').textContent = '';
    if (!pass) return fail(form, { message: 'Enter your password to confirm.' });
    const ok = await confirmDialog({ title: 'Delete your account?', body: 'Your account and saved addresses will be removed for good.', confirm: 'Delete account', cancel: 'Keep my account' });
    if (!ok) return;
    busy(form, true);
    try {
      await api.deleteMe(pass);
      window.dispatchEvent(new CustomEvent('morsel:account-deleted'));
    } catch (err) { fail(form, err); busy(form, false); }
  });
}
