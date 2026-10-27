import { $, esc, firstName } from '../util.js';
import { api } from '../api.js';
import { state } from '../state.js';
import { openModal, closeModal, toast } from '../ui.js';
import { updateHeader } from './header.js';
import { render } from '../router.js';
import { ic } from '../art.js';

/* Shown only when the server runs with DEMO_MODE=true. Staff land on their own page. */
const DEMO_ROLES = [
  { role: 'customer', label: 'Customer', icon: 'user' },
  { role: 'partner', label: 'Restaurant partner', icon: 'bag', page: '/partner' },
  { role: 'courier', label: 'Courier', icon: 'bike', page: '/courier' },
  { role: 'admin', label: 'Admin', icon: 'grid', page: '/admin' }
];

/* Asked once per page load; a failed request just leaves the section out. */
let demoInfo = null;
const loadDemo = () => demoInfo || (demoInfo = api.demoAccounts().catch(() => { demoInfo = null; return { enabled: false, accounts: [] }; }));

/* The partner button signs in to the restaurant you're looking at, if it has a demo partner. */
function demoButtons(info) {
  const here = state.view === 'restaurant' ? state.params.id : state.view === 'checkout' ? state.params.slug : null;
  const partners = info.accounts.filter(a => a.role === 'partner');
  const partner = partners.find(a => a.restaurant.slug === here) || partners.find(a => a.restaurant.slug === info.defaultPartner) || partners[0];
  return DEMO_ROLES.map(r => {
    const a = r.role === 'partner' ? partner : info.accounts.find(x => x.role === r.role);
    if (!a) return '';
    const who = r.role === 'partner' ? `${a.name} · ${a.restaurant.name}` : r.role === 'courier' && a.vehicle ? `${a.name} · ${a.vehicle}` : a.name;
    return `<button class="demo-acct" type="button" data-demo-role="${r.role}" ${a.restaurant ? `data-restaurant="${esc(a.restaurant.slug)}"` : ''}>
      <span class="demo-ic">${ic(r.icon)}</span><span class="demo-txt"><strong>${r.label}</strong><small>${esc(who)}</small></span></button>`;
  }).join('');
}

export function openAuth(mode = 'login', { reason = '', then } = {}) {
  let current = mode;
  const m = openModal(`<div id="auth-inner"></div>`, { label: 'auth-title' });
  const w = m.wrap;
  const draw = () => {
    if (current === 'forgot') { drawForgot(); return; }
    $('#auth-inner', w).innerHTML = `
      <div class="modal-head">
        <h2 id="auth-title">${current === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p>${reason ? esc(reason) : current === 'login' ? 'Log in to order, track deliveries and save your favourites.' : 'It takes a minute. Your first order gets 20% off.'}</p>
      </div>
      <div class="modal-body">
        <div class="seg" role="tablist" aria-label="Account" style="margin-bottom:18px">
          <button type="button" role="tab" aria-selected="${current === 'login'}" data-mode="login">Log in</button>
          <button type="button" role="tab" aria-selected="${current === 'signup'}" data-mode="signup">Sign up</button>
        </div>
        <form id="auth-form" novalidate>
          <p class="form-error" id="auth-error" role="alert"></p>
          ${current === 'signup' ? `<div class="field"><label for="a-name">Full name</label><input class="input" id="a-name" autocomplete="name" placeholder="First and last name" autofocus><p class="err" id="e-name"></p></div>` : ''}
          <div class="field"><label for="a-email">Email</label><input class="input" id="a-email" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com" ${current === 'login' ? 'autofocus' : ''}><p class="err" id="e-email"></p></div>
          <div class="field"><div class="label-row"><label for="a-pass">Password ${current === 'signup' ? '<small>At least 8 characters</small>' : ''}</label>${current === 'login' ? '<button class="link-btn forgot-link" type="button" data-mode="forgot">Forgot password?</button>' : ''}</div>
            <div class="pw-wrap"><input class="input" id="a-pass" type="password" autocomplete="${current === 'login' ? 'current-password' : 'new-password'}" placeholder="${current === 'login' ? 'Your password' : 'Choose a password'}"><button class="pw-toggle" type="button" data-pw>Show</button></div>
            <p class="err" id="e-pass"></p></div>
          <button class="btn btn-primary btn-block" type="submit" id="auth-submit">${current === 'login' ? 'Log in' : 'Create account'}</button>
        </form>
        <div id="auth-demo"></div>
        <p class="hint">Your account keeps your addresses, favourites and orders on any device.</p>
      </div>`;
  };
  /* "Forgot password?": ask for a reset link. Morsel sends no email, so in demo mode the link is shown here. */
  const drawForgot = () => {
    const typed = ($('#a-email', w) || {}).value || '';
    $('#auth-inner', w).innerHTML = `
      <div class="modal-head"><h2 id="auth-title">Reset your password</h2><p>Enter the email you log in with and we’ll send you a link to choose a new password.</p></div>
      <div class="modal-body">
        <form id="forgot-form" novalidate>
          <p class="form-error" id="fp-error" role="alert"></p>
          <div class="field"><label for="fp-email">Email</label><input class="input" id="fp-email" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com" value="${esc(typed)}" autofocus><p class="err" id="e-fp-email"></p></div>
          <button class="btn btn-primary btn-block" type="submit" id="fp-send">Send reset link</button>
        </form>
        <p class="hint"><button class="link-btn" type="button" data-mode="login">Back to log in</button></p>
      </div>`;
    const form = $('#forgot-form', w);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const input = $('#fp-email', w);
      const bad = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value.trim()) ? '' : 'Enter an email like name@example.com.';
      input.closest('.field').classList.toggle('invalid', !!bad);
      input.setAttribute('aria-invalid', bad ? 'true' : 'false');
      $('#e-fp-email', w).textContent = bad;
      if (bad) { input.focus(); return; }
      const btn = $('#fp-send', w);
      setBusy(btn, true, 'Sending…');
      try {
        const r = await api.forgotPassword(input.value.trim());
        form.outerHTML = `<div class="fp-sent" role="status"><p>${esc(r.message)}</p>
          ${r.demoLink ? `<p class="demo-link"><strong>Demo mode:</strong> Morsel doesn’t send email, so here is the link the email would contain. <a href="${esc(r.demoLink)}">Choose a new password</a></p>` : ''}</div>`;
      } catch (err) {
        setBusy(btn, false, 'Send reset link');
        $('#fp-error', w).textContent = err.message;
      }
    });
  };
  let demo = null;
  const drawDemo = () => {
    const box = $('#auth-demo', w);
    if (!box) return;
    const buttons = demo && demo.enabled ? demoButtons(demo) : '';
    box.innerHTML = buttons ? `<div class="divider">or</div>
      <section class="demo-accts" aria-labelledby="demo-h">
        <h3 id="demo-h">Demo accounts</h3>
        <p>One click, no password. Staff accounts open their own page.</p>
        <p class="form-error" id="demo-error" role="alert"></p>
        <div class="demo-grid">${buttons}</div>
      </section>` : '';
  };
  draw();
  loadDemo().then(d => { demo = d; if (w.isConnected) drawDemo(); });
  const finish = (user, msg) => {
    closeModal(m);
    onAuth(user).then(() => { toast(msg); if (then) then(); });
  };
  const setBusy = (btn, busy, label) => { btn.disabled = busy; btn.innerHTML = busy ? `<span class="spinner"></span>${label}` : label; };
  w.addEventListener('click', async e => {
    const mb = e.target.closest('[data-mode]');
    if (mb && mb.dataset.mode !== current) { current = mb.dataset.mode; draw(); drawDemo(); setTimeout(() => { const f = $('[autofocus]', w); if (f) f.focus(); }, 0); return; }
    const pw = e.target.closest('[data-pw]');
    if (pw) { const inp = $('#a-pass', w); const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; pw.textContent = show ? 'Hide' : 'Show'; return; }
    const acct = e.target.closest('[data-demo-role]');
    if (acct) {
      const role = acct.dataset.demoRole;
      const all = w.querySelectorAll('[data-demo-role]');
      const icon = $('.demo-ic', acct);
      const was = icon.innerHTML;
      all.forEach(b => { b.disabled = true; });
      acct.setAttribute('aria-busy', 'true');
      icon.innerHTML = '<span class="spinner"></span>';
      $('#demo-error', w).textContent = '';
      try {
        const u = await api.demoLogIn(role, acct.dataset.restaurant);
        const page = DEMO_ROLES.find(r => r.role === role).page;
        if (page) { location.href = page; return; }
        finish(u, `Signed in as ${u.name}`);
      } catch (err) {
        all.forEach(b => { b.disabled = false; });
        acct.removeAttribute('aria-busy');
        icon.innerHTML = was;
        $('#demo-error', w).textContent = err.message;
      }
    }
  });
  w.addEventListener('submit', async e => {
    /* The login and signup form only; the forgot-password form handles itself. */
    if (e.target.id !== 'auth-form') return;
    e.preventDefault();
    const name = $('#a-name', w), email = $('#a-email', w), pass = $('#a-pass', w);
    const errs = {};
    if (name && name.value.trim().length < 2) errs.name = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) errs.email = 'Enter an email like name@example.com.';
    if (current === 'signup' && pass.value.length < 8) errs.pass = 'Use at least 8 characters.';
    if (current === 'login' && !pass.value) errs.pass = 'Enter your password.';
    [['name', name], ['email', email], ['pass', pass]].forEach(([k, el]) => {
      if (!el) return;
      el.closest('.field').classList.toggle('invalid', !!errs[k]);
      el.setAttribute('aria-invalid', errs[k] ? 'true' : 'false');
      $('#e-' + k, w).textContent = errs[k] || '';
    });
    $('#auth-error', w).textContent = '';
    const firstBad = Object.keys(errs)[0];
    if (firstBad) { ({ name, email, pass })[firstBad].focus(); return; }
    const btn = $('#auth-submit', w);
    const label = current === 'login' ? 'Log in' : 'Create account';
    setBusy(btn, true, current === 'login' ? 'Logging in…' : 'Creating account…');
    try {
      if (current === 'login') { const u = await api.logIn({ email: email.value, password: pass.value }); finish(u, `Welcome back, ${firstName(u.name)}`); }
      else { const u = await api.signUp({ name: name.value, email: email.value, password: pass.value }); finish(u, `Welcome to Morsel, ${firstName(u.name)}`); }
    } catch (err) {
      setBusy(btn, false, label);
      $('#auth-error', w).textContent = err.message;
    }
  });
}

export async function onAuth(user) {
  state.user = user;
  state.orderCount = user ? user.orderCount || 0 : 0;
  if (user) {
    const def = user.addresses.find(a => a.isDefault);
    if (!state.co.addressId || !user.addresses.some(a => a._id === state.co.addressId)) state.co.addressId = def ? def._id : null;
  } else state.co.addressId = null;
  updateHeader();
  render(true);
}

export function requireAuth(reason, then) {
  if (state.user) { then(); return; }
  openAuth('login', { reason, then });
}
