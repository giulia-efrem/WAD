import { LS } from './state.js';

/* A short notice, once: Morsel uses only essential cookies (the login cookie), so there is nothing
   to accept or refuse, just "OK". Dismissing it is remembered in this browser. */
const KEY = 'morsel.cookieNotice';

export function cookieNotice() {
  if (LS.get(KEY, false)) return;
  const bar = document.createElement('div');
  bar.className = 'cookie-note';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Cookies');
  bar.innerHTML = `<p>Morsel only uses essential cookies: one keeps you logged in. No tracking, no ads. <a href="/privacy#cookies">More about privacy</a></p>
    <button class="btn btn-sm btn-primary" type="button">OK</button>`;
  bar.querySelector('button').addEventListener('click', () => {
    LS.set(KEY, true);
    bar.classList.add('is-leaving');
    setTimeout(() => bar.remove(), 200);
  });
  document.body.appendChild(bar);
  document.body.classList.add('has-cookie-note');
  bar.querySelector('button').addEventListener('click', () => document.body.classList.remove('has-cookie-note'));
}
