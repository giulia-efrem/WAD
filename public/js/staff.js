import { $, esc, clock, ingredientWords } from './util.js';
import './topbar.js';
import { api, request } from './api.js';

/* Shared by the staff pages (/admin, /partner, /courier): sign-in gate, toasts, status chips
   and how an order's lines read for the kitchen. The pages only show what the API returns;
   every permission is checked on the server. */

export const call = request;

let toastTimer = 0;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3600);
}

export const STATUS_LABEL = { placed: 'New', accepted: 'Accepted', preparing: 'Preparing', ready: 'Ready', pickedup: 'Picked up', delivered: 'Delivered', cancelled: 'Cancelled' };
export const statusChip = s => `<span class="chip st-${esc(s)}">${esc(STATUS_LABEL[s] || s)}</span>`;
export const shortId = id => '#' + String(id).slice(-5).toUpperCase();
export const minutesAgo = (t, now = Date.now()) => { const m = Math.max(0, Math.round((now - new Date(t).getTime()) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`; };
export const ROLE_LABEL = { customer: 'Customer', partner: 'Partner', courier: 'Courier', admin: 'Admin' };

/* Everything the kitchen needs about a line: every choice, the parts of a deal, what's left out, the note. */
export function lineDetail(l) {
  const bits = [];
  if (l.parts && l.parts.length) bits.push(l.parts.map(p => p.name).join(' + '));
  for (const o of l.options || []) bits.push(`${o.group}: ${o.choice}`);
  for (const r of l.removed || []) bits.push(`No ${ingredientWords(r.name)}`);
  return bits;
}
export const linesHTML = items => `<ul class="o-lines">${items.map(l => {
  const d = lineDetail(l);
  return `<li><span class="o-qty">${l.qty}×</span><div><strong>${esc(l.name)}</strong>${d.length ? `<small>${d.map(esc).join(' · ')}</small>` : ''}${l.note ? `<small class="o-note">Note: “${esc(l.note)}”</small>` : ''}</div></li>`;
}).join('')}</ul>`;

export const whenText = o => o.delivery.type === 'scheduled' ? `Scheduled for ${clock(new Date(o.delivery.at))}` : 'As soon as possible';

/* Logging out reloads the page. That stops every refresh loop and any section still loading,
   which would otherwise keep calling the API, get "session ended" and redraw the login form
   while you type in it. */
async function logOutAndReload() {
  try { await api.logOut(); } catch (e) { /* the reload shows the real state either way */ }
  location.reload();
}

/* Shows a login form until someone with one of `roles` is signed in, then calls ready(user). */
export async function gate(root, { roles, title, intro, ready }) {
  const who = $('#who');
  let signedIn = false;
  const show = user => {
    signedIn = !!user;
    if (who) who.innerHTML = user ? `<span>${esc(user.name)}</span><button class="link-btn" type="button" id="logout">Log out</button>` : '';
    const out = $('#logout');
    if (out) out.addEventListener('click', logOutAndReload);
    if (!user) { stopLoops(); return loginForm(); }
    if (!roles.includes(user.role)) {
      root.innerHTML = `<div class="empty"><h1>${esc(title)}</h1><p>You’re signed in as ${esc(user.email)}, which isn’t a ${esc(roles.map(r => ROLE_LABEL[r].toLowerCase()).join(' or '))} account. Staff accounts are created by a Morsel admin.</p><button class="btn btn-outline" type="button" id="switch">Log in with another account</button> <a class="btn btn-primary" href="/">Back to Morsel</a></div>`;
      $('#switch').addEventListener('click', logOutAndReload);
      return;
    }
    ready(user);
  };
  const loginForm = () => {
    root.innerHTML = `<section class="panel staff-login">
      <h1>${esc(title)}</h1>
      <p class="muted">${esc(intro)}</p>
      <form id="login" novalidate>
        <p class="form-error" id="login-err" role="alert"></p>
        <div class="field"><label for="l-email">Email</label><input class="input" id="l-email" type="email" autocomplete="username" autofocus></div>
        <div class="field"><label for="l-pass">Password</label><input class="input" id="l-pass" type="password" autocomplete="current-password"></div>
        <button class="btn btn-primary btn-block" type="submit">Log in</button>
      </form>
      <div id="staff-demo"></div>
    </section>`;
    showDemo();
    $('#login').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('#login button');
      btn.disabled = true;
      try { show(await api.logIn({ email: $('#l-email').value, password: $('#l-pass').value })); }
      catch (err) { btn.disabled = false; $('#login-err').textContent = err.message; }
    });
  };
  /* DEMO_MODE=true: a one-click login with this page's demo account, as in the main login window. */
  const showDemo = async () => {
    let info;
    try { info = await api.demoAccounts(); } catch (e) { return; }
    const box = $('#staff-demo');
    const role = roles[0];
    const a = info.enabled && (info.accounts.find(x => x.role === role && (role !== 'partner' || x.restaurant.slug === info.defaultPartner)) || info.accounts.find(x => x.role === role));
    if (!box || !a) return;
    const who = a.restaurant ? `${a.name} · ${a.restaurant.name}` : a.name;
    box.innerHTML = `<div class="divider">or</div><button class="btn btn-outline btn-block" type="button" id="demo-login">Use the demo account <small class="muted">(${esc(who)})</small></button><p class="form-error" id="demo-err" role="alert"></p>`;
    $('#demo-login').addEventListener('click', async e => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try { show(await api.demoLogIn(role, a.restaurant && a.restaurant.slug)); }
      catch (err) { btn.disabled = false; $('#demo-err').textContent = err.message; }
    });
  };
  /* A session that ends (logged out elsewhere, disabled account) brings the login form back, once:
     while the form is showing, nobody is signed in and there is nothing to end. */
  window.addEventListener('morsel:signed-out', e => {
    if (!signedIn) return;
    toast(e.detail === 'account_disabled' ? 'This account has been disabled.' : 'Your session has ended. Log in again.');
    show(null);
  });
  /* A page restored from the back/forward cache may show someone who has since logged out. */
  window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
  try { show(await api.me()); }
  catch (err) { root.innerHTML = `<div class="empty"><h1>Morsel couldn’t load</h1><p>${esc(err.message)}</p></div>`; }
}

/* Runs fn every `ms` while the tab is visible, and right away when it becomes visible again.
   Every loop stops when the session ends. */
const loops = new Set();
function stopLoops() { for (const l of loops) l.stop(); loops.clear(); }
export function every(ms, fn) {
  let timer = 0, stopped = false;
  const loop = async () => {
    clearTimeout(timer);
    if (stopped) return;
    if (document.visibilityState === 'visible') { try { await fn(); } catch (e) { /* the next run tries again */ } }
    if (!stopped) timer = setTimeout(loop, ms);
  };
  const onVisible = () => { if (document.visibilityState === 'visible') loop(); };
  document.addEventListener('visibilitychange', onVisible);
  const handle = { stop: () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); }, now: loop };
  loops.add(handle);
  loop();
  return handle;
}
