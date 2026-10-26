import { $, esc, initials, firstName } from '../util.js';
import { ic } from '../art.js';
import { state } from '../state.js';

export function updateHeader() {
  const u = state.user;
  const def = u && u.addresses.find(a => a.isDefault);
  $('#addr-label').textContent = def ? `${def.label}, ${def.street}` : 'Add delivery address';
  $('#addr-btn').setAttribute('aria-label', def ? `Delivering to ${def.label}, ${def.street}. Change address` : 'Add a delivery address');
  const b = $('#acct-btn');
  if (u) { b.classList.add('has-avatar'); b.innerHTML = `<span class="avatar" aria-hidden="true">${esc(initials(u.name))}</span><span class="lbl">${esc(firstName(u.name))}</span>`; b.setAttribute('aria-label', `Your account, ${u.name}`); }
  else { b.classList.remove('has-avatar'); b.innerHTML = `${ic('user')}<span class="lbl">Log in</span>`; b.setAttribute('aria-label', 'Log in or sign up'); }
  const admin = $('#admin-link');
  admin.hidden = !(u && u.role === 'admin');
  admin.setAttribute('aria-label', 'Manage restaurant and dish photos');
}
