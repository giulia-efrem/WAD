import { $ } from './util.js';
import { state } from './state.js';
import { closeDrawer } from './ui.js';
import { updateCartbar } from './views/bag.js';
import { renderHome } from './views/home.js';
import { renderRestaurant } from './views/restaurant.js';
import { renderCheckout } from './views/checkout.js';
import { renderOrder } from './views/order.js';
import { renderAccount } from './views/account.js';
import { renderCredits, renderPage, renderNotFound } from './views/pages.js';

/* Views that have their own address (served by the server as index.html). */
export const PATH_VIEWS = { '/credits': 'credits', '/about': 'about', '/help': 'help', '/terms': 'terms', '/privacy': 'privacy' };
const pathOf = view => Object.keys(PATH_VIEWS).find(p => PATH_VIEWS[p] === view) || '/';

export const app = () => $('#app');

/* Timers and observers a view sets up are stopped when the view is replaced. */
let cleanups = [];
export const onLeave = fn => cleanups.push(fn);

const TITLES = { home: 'Morsel, food delivery', credits: 'Photo credits · Morsel', checkout: 'Checkout · Morsel', account: 'Your account · Morsel' };

export function render(keepScroll) {
  document.title = TITLES[state.view] || 'Morsel, food delivery';
  cleanups.forEach(fn => fn());
  cleanups = [];
  const y = window.scrollY;
  switch (state.view) {
    case 'restaurant': renderRestaurant(state.params.id); break;
    case 'checkout': renderCheckout(); break;
    case 'order': renderOrder(state.params.id); break;
    case 'account': renderAccount(); break;
    case 'credits': renderCredits(); break;
    case 'about': case 'help': case 'terms': case 'privacy': renderPage(state.view); break;
    case 'notfound': renderNotFound(); break;
    default: renderHome();
  }
  updateCartbar();
  if (keepScroll) window.scrollTo(0, y);
}

export function go(view, params = {}) {
  closeDrawer(true);
  state.view = view;
  state.params = params;
  const path = pathOf(view);
  if (view !== 'notfound' && location.pathname !== path) history.pushState(null, '', path);
  render();
  window.scrollTo(0, 0);
  app().focus({ preventScroll: true });
}
