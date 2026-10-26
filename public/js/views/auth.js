import { $, esc, firstName } from '../util.js';
import { api } from '../api.js';
import { state } from '../state.js';
import { openModal, closeModal, toast } from '../ui.js';
import { updateHeader } from './header.js';
import { render } from '../router.js';

export function openAuth(mode = 'login', { reason = '', then } = {}) {
  let current = mode;
  const m = openModal(`<div id="auth-inner"></div>`, { label: 'auth-title' });
  const w = m.wrap;
  const draw = () => {
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
          ${current === 'signup' ? `<div class="field"><label for="a-name">Full name</label><input class="input" id="a-name" autocomplete="name" autofocus><p class="err" id="e-name"></p></div>` : ''}
          <div class="field"><label for="a-email">Email</label><input class="input" id="a-email" type="email" inputmode="email" autocomplete="email" ${current === 'login' ? 'autofocus' : ''}><p class="err" id="e-email"></p></div>
          <div class="field"><label for="a-pass">Password ${current === 'signup' ? '<small>At least 8 characters</small>' : ''}</label>
            <div class="pw-wrap"><input class="input" id="a-pass" type="password" autocomplete="${current === 'login' ? 'current-password' : 'new-password'}"><button class="pw-toggle" type="button" data-pw>Show</button></div>
            <p class="err" id="e-pass"></p></div>
          <button class="btn btn-primary btn-block" type="submit" id="auth-submit">${current === 'login' ? 'Log in' : 'Create account'}</button>
        </form>
        <div class="divider">or</div>
        <button class="btn btn-outline btn-block" type="button" data-demo>Continue with the demo account</button>
        <p class="hint">Your account keeps your addresses, favourites and orders on any device.</p>
      </div>`;
  };
  draw();
  const finish = (user, msg) => {
    closeModal(m);
    onAuth(user).then(() => { toast(msg); if (then) then(); });
  };
  const setBusy = (btn, busy, label) => { btn.disabled = busy; btn.innerHTML = busy ? `<span class="spinner"></span>${label}` : label; };
  w.addEventListener('click', async e => {
    const mb = e.target.closest('[data-mode]');
    if (mb && mb.dataset.mode !== current) { current = mb.dataset.mode; draw(); setTimeout(() => { const f = $('[autofocus]', w); if (f) f.focus(); }, 0); return; }
    const pw = e.target.closest('[data-pw]');
    if (pw) { const inp = $('#a-pass', w); const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; pw.textContent = show ? 'Hide' : 'Show'; return; }
    const demo = e.target.closest('[data-demo]');
    if (demo) {
      setBusy(demo, true, 'Signing in…');
      try { const u = await api.demoLogIn(); finish(u, `Signed in as ${u.name}`); }
      catch (err) { setBusy(demo, false, 'Continue with the demo account'); $('#auth-error', w).textContent = err.message; }
    }
  });
  w.addEventListener('submit', async e => {
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
