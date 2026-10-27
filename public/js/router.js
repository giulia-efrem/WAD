import { $ } from './util.js';
import { state } from './state.js';
import { refreshOrderUI, closeBasketsMenu } from './views/basket.js';
import { renderHome } from './views/home.js';
import { renderRestaurant } from './views/restaurant.js';
import { renderCheckout } from './views/checkout.js';
import { renderOrder } from './views/order.js';
import { renderAccount } from './views/account.js';
import { renderCredits, renderPage, renderNotFound } from './views/pages.js';

/* Every view has its own address, so a refresh, the back button and a shared link all land on the
   same page. The server sends index.html for each of these paths. */
export const PATH_VIEWS = { '/credits': 'credits', '/about': 'about', '/help': 'help', '/terms': 'terms', '/privacy': 'privacy', '/account': 'account' };

export function pathFor(view, params = {}) {
  const enc = encodeURIComponent;
  switch (view) {
    case 'home': return '/';
    case 'restaurant': return `/r/${enc(params.id)}${params.dish ? `?dish=${enc(params.dish)}` : ''}`;
    case 'checkout': return params.slug ? `/checkout/${enc(params.slug)}` : '/checkout';
    case 'order': return `/order/${enc(params.id)}`;
    default: return Object.keys(PATH_VIEWS).find(p => PATH_VIEWS[p] === view) || '/';
  }
}

/* Which view a URL shows. Old links such as /#r-forno-sette still work. */
export function routeOf(url) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const parts = path.split('/').slice(1).map(decodeURIComponent);
  if (PATH_VIEWS[path]) return { view: PATH_VIEWS[path], params: {} };
  if (parts[0] === 'r' && parts[1] && parts.length === 2) return { view: 'restaurant', params: { id: parts[1], ...(url.searchParams.get('dish') ? { dish: url.searchParams.get('dish') } : {}) } };
  if (parts[0] === 'order' && parts[1] && parts.length === 2) return { view: 'order', params: { id: parts[1] } };
  if (parts[0] === 'checkout' && parts.length <= 2) return { view: 'checkout', params: parts[1] ? { slug: parts[1] } : {} };
  if (path !== '/' && path !== '/index.html') return { view: 'notfound', params: {} };
  const hash = (url.hash || '').slice(1);
  if (hash.startsWith('r-')) return { view: 'restaurant', params: { id: hash.slice(2) } };
  if (hash.startsWith('order-')) return { view: 'order', params: { id: hash.slice(6) } };
  if (hash.startsWith('checkout-')) return { view: 'checkout', params: { slug: hash.slice(9) } };
  if (['checkout', 'account'].includes(hash)) return { view: hash, params: {} };
  return { view: 'home', params: {} };
}

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
  refreshOrderUI();
  if (keepScroll) window.scrollTo(0, y);
}

export function go(view, params = {}) {
  closeBasketsMenu();
  state.view = view;
  state.params = params;
  const path = pathFor(view, params);
  if (view !== 'notfound' && location.pathname + location.search + location.hash !== path) history.pushState(null, '', path);
  render();
  window.scrollTo(0, 0);
  app().focus({ preventScroll: true });
}

/* Changes the address without adding a history step, e.g. when the dish window opens or closes. */
export function setPath(params) {
  state.params = { ...state.params, ...params };
  Object.keys(state.params).forEach(k => state.params[k] === undefined && delete state.params[k]);
  const path = pathFor(state.view, state.params);
  if (location.pathname + location.search !== path) history.replaceState(null, '', path);
}
