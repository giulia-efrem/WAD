import { $ } from './util.js';
import { state } from './state.js';
import { closeDrawer } from './ui.js';
import { updateCartbar } from './views/bag.js';
import { renderHome } from './views/home.js';
import { renderRestaurant } from './views/restaurant.js';
import { renderCheckout } from './views/checkout.js';
import { renderOrder } from './views/order.js';
import { renderAccount } from './views/account.js';

export const app = () => $('#app');

/* Timers and observers a view sets up are stopped when the view is replaced. */
let cleanups = [];
export const onLeave = fn => cleanups.push(fn);

export function render(keepScroll) {
  cleanups.forEach(fn => fn());
  cleanups = [];
  const y = window.scrollY;
  switch (state.view) {
    case 'restaurant': renderRestaurant(state.params.id); break;
    case 'checkout': renderCheckout(); break;
    case 'order': renderOrder(state.params.id); break;
    case 'account': renderAccount(); break;
    default: renderHome();
  }
  updateCartbar();
  if (keepScroll) window.scrollTo(0, y);
}

export function go(view, params = {}) {
  closeDrawer(true);
  state.view = view;
  state.params = params;
  render();
  window.scrollTo(0, 0);
  app().focus({ preventScroll: true });
}
