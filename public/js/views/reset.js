import { $, esc, firstName } from '../util.js';
import { art } from '../art.js';
import { api } from '../api.js';
import { toast } from '../ui.js';
import { app } from '../router.js';
import { state } from '../state.js';
import { onAuth } from './auth.js';

/* /reset-password?token=…: the page a reset link opens. It checks the link first, then asks for
   a new password, which also logs you in (and signs out every other device). */
export async function renderReset() {
  document.title = 'Choose a new password · Morsel';
  const token = state.params.token || '';
  app().innerHTML = `<div class="wrap page reset-page"><div class="panel login-card" aria-busy="true"><div class="sk sk-title"></div><div class="sk sk-line"></div><div class="sk sk-line"></div></div></div>`;
  let email;
  try { email = (await api.checkReset(token)).email; }
  catch (err) {
    if (state.view !== 'reset') return;
    app().innerHTML = `<div class="wrap page reset-page"><div class="empty"><div class="empty-art">${art('bowl')}</div>
      <h1 class="empty-h">This link doesn’t work any more</h1>
      <p>${esc(err.code === 'invalid_token' || err.code === 'validation_failed' ? 'Reset links work once, for 30 minutes. Ask for a new one and use it straight away.' : err.message)}</p>
      <button class="btn btn-primary" type="button" data-act="forgot">Get a new link</button></div></div>`;
    return;
  }
  if (state.view !== 'reset') return;
  app().innerHTML = `
    <div class="wrap page reset-page">
      <section class="panel login-card" aria-labelledby="rs-title">
        <h1 id="rs-title">Choose a new password</h1>
        <p class="muted">For <strong>${esc(email)}</strong>. You’ll be logged in, and signed out on every other device.</p>
        <form id="reset-form" novalidate>
          <p class="form-error" id="rs-error" role="alert"></p>
          <input type="email" autocomplete="username" value="${esc(email)}" hidden>
          <div class="field"><label for="rs-pass">New password <small>At least 8 characters</small></label>
            <div class="pw-wrap"><input class="input" id="rs-pass" type="password" autocomplete="new-password" minlength="8" maxlength="72" placeholder="Choose a password" autofocus><button class="pw-toggle" type="button" data-pw>Show</button></div>
            <p class="err" id="e-rs-pass"></p></div>
          <button class="btn btn-primary btn-block" type="submit" id="rs-save">Save and log in</button>
        </form>
      </section>
    </div>`;
  const pass = $('#rs-pass');
  pass.focus();
  $('[data-pw]').addEventListener('click', e => { const show = pass.type === 'password'; pass.type = show ? 'text' : 'password'; e.currentTarget.textContent = show ? 'Hide' : 'Show'; });
  $('#reset-form').addEventListener('submit', async e => {
    e.preventDefault();
    const bad = pass.value.length < 8 ? 'Use at least 8 characters.' : '';
    pass.closest('.field').classList.toggle('invalid', !!bad);
    pass.setAttribute('aria-invalid', bad ? 'true' : 'false');
    $('#e-rs-pass').textContent = bad;
    if (bad) { pass.focus(); return; }
    const btn = $('#rs-save');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Saving…';
    try {
      const user = await api.resetPassword(token, pass.value);
      /* Home first, so that logging in redraws the home page rather than this one. */
      history.replaceState(null, '', '/');
      state.view = 'home';
      state.params = {};
      await onAuth(user);
      window.scrollTo(0, 0);
      toast(`Password changed. Welcome back, ${firstName(user.name)}`);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Save and log in';
      $('#rs-error').textContent = err.message;
    }
  });
}
