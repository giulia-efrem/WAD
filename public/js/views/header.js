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
  /* Logged in, the button opens the account menu (with Log out); logged out, it opens the login window. */
  closeAccountMenu();
  if (u) {
    b.classList.add('has-avatar'); b.innerHTML = `<span class="avatar" aria-hidden="true">${esc(initials(u.name))}</span><span class="lbl">${esc(firstName(u.name))}</span>`;
    b.setAttribute('aria-label', `Your account, ${u.name}`); b.setAttribute('aria-haspopup', 'menu'); b.setAttribute('aria-expanded', 'false');
  } else {
    b.classList.remove('has-avatar'); b.innerHTML = `${ic('user')}<span class="lbl">Log in</span>`;
    b.setAttribute('aria-label', 'Log in or sign up'); b.removeAttribute('aria-haspopup'); b.removeAttribute('aria-expanded');
  }
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

/* ================= Account menu ================= */
/* Your name and email, the account pages, your staff page if you have one, Help, and Log out. */
export function toggleAccountMenu() {
  const pop = $('#acct-pop');
  if (!pop.hidden) { closeAccountMenu(); return; }
  const u = state.user;
  if (!u) return;
  const staff = STAFF[u.role];
  const item = (href, icon, label) => `<a role="menuitem" href="${href}" class="menu-item">${ic(icon)}<span>${label}</span></a>`;
  pop.innerHTML = `
    <div class="menu-who" role="presentation"><strong>${esc(u.name)}</strong><small>${esc(u.email)}</small></div>
    ${item('/orders', 'receipt', 'Orders')}
    ${item('/account', 'user', 'Account and password')}
    ${item('/account/addresses', 'pin', 'Addresses')}
    ${item('/account/favourites', 'heart', 'Favourites')}
    ${staff ? item(staff.href, staff.icon, staff.aria) : ''}
    ${item('/help', 'help', 'Help')}
    <div class="menu-sep" role="separator"></div>
    <button role="menuitem" type="button" class="menu-item menu-logout" data-act="logout" id="menu-logout">${ic('back')}<span>Log out</span></button>`;
  pop.hidden = false;
  $('#acct-btn').setAttribute('aria-expanded', 'true');
  const first = pop.querySelector('[role="menuitem"]');
  if (first) first.focus();
}
export function closeAccountMenu({ focusButton = false } = {}) {
  const pop = $('#acct-pop');
  if (!pop || pop.hidden) return;
  pop.hidden = true;
  const b = $('#acct-btn');
  if (b) { b.setAttribute('aria-expanded', 'false'); if (focusButton) b.focus(); }
}
document.addEventListener('click', e => {
  const pop = $('#acct-pop');
  if (!pop || pop.hidden) return;
  /* A choice in the menu, or a click anywhere else, closes it. */
  if (e.target.closest('#acct-pop [role="menuitem"]') || !e.target.closest('#acct-pop, #acct-btn')) closeAccountMenu();
});
document.addEventListener('keydown', e => {
  const pop = $('#acct-pop');
  if (!pop || pop.hidden) return;
  const items = [...pop.querySelectorAll('[role="menuitem"]')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'Escape') { e.preventDefault(); closeAccountMenu({ focusButton: true }); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
  else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
  else if (e.key === 'Tab') closeAccountMenu();
});
