import { ic } from '../art.js';
import { state } from '../state.js';

/* Phones only (the CSS hides it on wider screens): Home, Search, Orders and Account at the
   bottom, like a delivery app. It steps aside where a page needs the whole screen. */
const TABS = [['home', '/', 'Home', 'home'], ['search', '/search', 'Search', 'search'], ['orders', '/orders', 'Orders', 'receipt'], ['account', '/account', 'Account', 'user']];
const HIDDEN_ON = ['checkout', 'reset', 'receipt'];

function currentTab() {
  if (state.view === 'home' || state.view === 'restaurant') return 'home';
  if (state.view === 'search') return 'search';
  if (state.view === 'order' || (state.view === 'account' && state.acctTab === 'orders')) return 'orders';
  if (state.view === 'account') return 'account';
  return '';
}

export function updateTabbar() {
  let bar = document.getElementById('tabbar');
  if (!bar) {
    bar = document.createElement('nav');
    bar.className = 'tabbar';
    bar.id = 'tabbar';
    bar.setAttribute('aria-label', 'Main');
    bar.innerHTML = TABS.map(([key, href, label, icon]) => `<a href="${href}" data-tab="${key}">${ic(icon)}<span>${label}</span></a>`).join('');
    document.getElementById('toast').before(bar);
  }
  const hide = HIDDEN_ON.includes(state.view);
  bar.hidden = hide;
  document.body.classList.toggle('has-tabbar', !hide);
  const here = currentTab();
  bar.querySelectorAll('a').forEach(a => { if (a.dataset.tab === here) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
}
