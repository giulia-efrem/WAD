import { $, $$ } from './util.js';
import { ic } from './art.js';
import { renderDrawer, updateCartbar } from './views/bag.js';

/* ================= Drawer ================= */
let lastFocus = null;
export function lockScroll(on) { document.body.classList.toggle('locked', on); }
export const drawerOpen = () => $('#drawer').classList.contains('open');
export function openDrawer() {
  lastFocus = document.activeElement;
  renderDrawer();
  $('#drawer').classList.add('open');
  $('#overlay').classList.add('show');
  lockScroll(true);
  updateCartbar();
  setTimeout(() => $('#drawer .close-btn').focus(), 50);
}
export function closeDrawer(silent) {
  const d = $('#drawer');
  if (!d.classList.contains('open')) return;
  d.classList.remove('open');
  $('#overlay').classList.remove('show');
  if (!$('#modal-root').children.length) lockScroll(false);
  updateCartbar();
  if (!silent && lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

/* ================= Modals ================= */
let modalStack = [];
export function openModal(html, { onClose, wide, label } = {}) {
  const prevFocus = document.activeElement;
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" ${label ? `aria-labelledby="${label}"` : ''}>
    <button class="close-btn" type="button" data-modal-close aria-label="Close">${ic('close')}</button>${html}</div>`;
  $('#modal-root').appendChild(wrap);
  lockScroll(true);
  const entry = { wrap, prevFocus, onClose };
  modalStack.push(entry);
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) closeModal(entry); });
  wrap.querySelector('[data-modal-close]').addEventListener('click', () => closeModal(entry));
  setTimeout(() => {
    const f = wrap.querySelector('[autofocus]') || wrap.querySelector('input, select, textarea, .modal-body button, .modal-foot button');
    (f || wrap.querySelector('[data-modal-close]')).focus();
  }, 30);
  return entry;
}
export function closeModal(entry, result) {
  entry = entry || modalStack[modalStack.length - 1];
  if (!entry || !entry.wrap.isConnected) return;
  entry.wrap.remove();
  modalStack = modalStack.filter(m => m !== entry);
  if (!modalStack.length && !drawerOpen()) lockScroll(false);
  if (entry.onClose) entry.onClose(result);
  if (entry.prevFocus && document.contains(entry.prevFocus)) entry.prevFocus.focus();
}
export function closeAllModals() { while (modalStack.length) closeModal(modalStack[modalStack.length - 1]); }
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (modalStack.length) { e.preventDefault(); closeModal(); }
    else if (drawerOpen()) closeDrawer();
  }
  if (e.key === 'Tab') {
    const top = modalStack.length ? modalStack[modalStack.length - 1].wrap : (drawerOpen() ? $('#drawer') : null);
    if (!top) return;
    const focusables = $$('button:not([disabled]), input:not([disabled]), select, textarea, [href]', top).filter(el => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
export function confirmDialog({ title, body, confirm, cancel }) {
  return new Promise(resolve => {
    let answered = false;
    const m = openModal(`
      <div class="modal-head"><h2 id="cf-title">${title}</h2><p>${body}</p></div>
      <div class="modal-foot"><button class="btn btn-secondary" type="button" data-cf="0">${cancel}</button><button class="btn btn-primary" type="button" data-cf="1" style="flex:1">${confirm}</button></div>`,
      { label: 'cf-title', onClose: () => { if (!answered) resolve(false); } });
    m.wrap.addEventListener('click', e => {
      const b = e.target.closest('[data-cf]');
      if (!b) return;
      answered = true;
      resolve(b.dataset.cf === '1');
      closeModal(m);
    });
  });
}

/* ================= Toast ================= */
let toastTimer = 0;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3600);
}
