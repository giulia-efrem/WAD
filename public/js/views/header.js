import { $, esc, initials, firstName } from '../util.js';
import { ic } from '../art.js';
import { state } from '../state.js';

const STAFF = {
  admin: { href: '/admin', icon: 'grid', label: 'Admin', aria: 'Open the admin dashboard' },
  partner: { href: '/partner', icon: 'bag', label: 'Restaurant', aria: 'Open your restaurant’s orders' },
  courier: { href: '/courier', icon: 'bike', label: 'Deliveries', aria: 'Open your deliveries' }
};

export function updateHeader() {
  const u = state.user;
  const def = u && u.addresses.find(a => a.isDefault);
  /* On phones only the label (Home, Work) shows, rather than an address cut off mid-word. */
  $('#addr-label').innerHTML = def ? `${esc(def.label)}<span class="addr-street">, ${esc(def.street)}</span>` : 'Add<span class="addr-street"> delivery</span> address';
  $('#addr-btn').setAttribute('aria-label', def ? `Deliver to ${def.label}, ${def.street}. Change address` : 'Add delivery address');
  $('#addr-btn').setAttribute('aria-label', def ? `Delivering to ${def.label}, ${def.street}. Change address` : 'Add a delivery address');
  const b = $('#acct-btn');
  if (u) { b.classList.add('has-avatar'); b.innerHTML = `<span class="avatar" aria-hidden="true">${esc(initials(u.name))}</span><span class="lbl">${esc(firstName(u.name))}</span>`; b.setAttribute('aria-label', `Your account, ${u.name}`); }
  else { b.classList.remove('has-avatar'); b.innerHTML = `${ic('user')}<span class="lbl">Log in</span>`; b.setAttribute('aria-label', 'Log in or sign up'); }
  /* Staff get a shortcut to their own page. */
  const staff = u && STAFF[u.role];
  const link = $('#admin-link');
  link.hidden = !staff;
  if (staff) {
    link.href = staff.href;
    link.innerHTML = `${ic(staff.icon)}<span class="lbl">${staff.label}</span>`;
    link.setAttribute('aria-label', staff.aria);
  }
}
