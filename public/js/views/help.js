import { $, esc, dayTime } from '../util.js';
import { ic } from '../art.js';
import { api } from '../api.js';
import { state } from '../state.js';
import { app } from '../router.js';

/* The Help centre: short answers to the common questions, then a contact form whose
   messages land in the admin dashboard. */
const FAQ = [
  ['Orders and delivery', [
    ['Where is my order?', 'Open <a href="/orders">Orders</a> and choose the order. You’ll see each step from the kitchen to your door, the courier on the map and an estimated arrival time.'],
    ['Can I cancel an order?', 'Yes, until the restaurant accepts it: open the order and choose “Cancel order”. After that the kitchen has started, so write to us below and we’ll sort it out.'],
    ['Can I order for later?', 'At checkout, choose “Schedule for later” and pick a time when the restaurant is open, from 30 minutes up to 24 hours ahead.'],
    ['Something was missing or wrong', 'We’re sorry. Use the form below, choose the order, and tell us what happened. We usually reply within a day.']
  ]],
  ['Payment and promo codes', [
    ['How do I pay?', 'By card or in cash to the courier. Morsel is a demo, so nothing is ever charged.'],
    ['How do promo codes work?', 'Enter a code at checkout. WELCOME20 takes 20% off your first order, up to €8. FREEDEL makes delivery free at restaurants that charge for it. One code per order.'],
    ['Where is my receipt?', 'Open the order in <a href="/orders">Orders</a> and choose “Receipt”. You can print it or save it as a PDF.']
  ]],
  ['Your account', [
    ['I forgot my password', 'Choose “Log in”, then “Forgot password?”, and enter your email. You’ll get a link to choose a new one; it works for 30 minutes.'],
    ['How do I change my delivery address?', 'Use the address button at the top of the page, or <a href="/account/addresses">Addresses</a> in your account.'],
    ['How do I delete my account?', 'Go to <a href="/account">your account</a>, scroll to “Delete your account” and confirm with your password.']
  ]],
  ['Food and allergies', [
    ['How do I check allergens?', 'Every dish lists its allergens in its window, and each restaurant’s “Info” section names all the allergens its kitchen handles. If you have a severe allergy, add a note to the kitchen and ask us before ordering.'],
    ['Which dishes are vegetarian, vegan or gluten-free?', 'Dishes carry labels, and the filters on the home page and in search show only restaurants and dishes that match.']
  ]]
];

const TOPICS = [['order', 'An order'], ['payment', 'Payment or a promo code'], ['account', 'My account'], ['restaurant', 'A restaurant or its food'], ['partner', 'Listing my restaurant or working as a courier'], ['other', 'Something else']];

export function renderHelp() {
  document.title = 'Help centre · Morsel';
  const u = state.user;
  app().innerHTML = `
    <div class="wrap page help-page">
      <h1 class="page-title">Help centre</h1>
      <p class="lead">Quick answers to the questions people ask most, and a way to reach us.</p>
      <div class="help-grid">
        <div class="faq">${FAQ.map(([group, items], g) => `
          <section class="faq-group" aria-labelledby="faq-${g}"><h2 id="faq-${g}">${group}</h2>
            ${items.map(([q, a]) => `<details class="faq-item"><summary>${esc(q)}${ic('chevron')}</summary><p>${a}</p></details>`).join('')}
          </section>`).join('')}
        </div>
        <section class="panel contact" aria-labelledby="contact-h" id="contact">
          <h2 id="contact-h">Contact us</h2>
          <p class="muted">We read every message and usually reply within a day.</p>
          <form id="contact-form" novalidate>
            <p class="form-error" id="ct-error" role="alert"></p>
            <div class="field"><label for="ct-name">Your name</label><input class="input" id="ct-name" autocomplete="name" maxlength="80" value="${esc(u ? u.name : '')}"><p class="err" id="e-ct-name"></p></div>
            <div class="field"><label for="ct-email">Email</label><input class="input" id="ct-email" type="email" inputmode="email" autocomplete="email" maxlength="254" placeholder="name@example.com" value="${esc(u ? u.email : '')}"><p class="err" id="e-ct-email"></p></div>
            <div class="field"><label for="ct-topic">What is it about?</label><span class="select-wrap select-block"><select class="input" id="ct-topic">${TOPICS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>${ic('chevron')}</span></div>
            <div class="field" id="ct-order-field" hidden><label for="ct-order">Which order? <small>Optional</small></label><span class="select-wrap select-block"><select class="input" id="ct-order"><option value="">Choose an order</option></select>${ic('chevron')}</span></div>
            <div class="field"><label for="ct-body">Your message</label><textarea class="input" id="ct-body" rows="5" maxlength="2000" placeholder="Tell us what happened, and what you’d like us to do."></textarea><p class="err" id="e-ct-body"></p></div>
            <button class="btn btn-primary btn-block" type="submit" id="ct-send">Send message</button>
          </form>
        </section>
      </div>
    </div>`;
  const form = $('#contact-form');
  const topic = $('#ct-topic');
  /* Logged in: "An order" offers your recent orders. */
  const orderField = $('#ct-order-field');
  let orders = null;
  const showOrders = async () => {
    orderField.hidden = !(u && topic.value === 'order');
    if (orderField.hidden || orders) return;
    try { orders = (await api.listOrders()).slice(0, 12); } catch (e) { orders = []; }
    $('#ct-order').insertAdjacentHTML('beforeend', orders.map(o => `<option value="${esc(o._id)}">${esc(o.restaurantName)}, ${esc(dayTime(new Date(o.createdAt)))}</option>`).join(''));
  };
  topic.addEventListener('change', showOrders);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#ct-name'), email = $('#ct-email'), body = $('#ct-body');
    const errs = {};
    if (name.value.trim().length < 2) errs['ct-name'] = 'Enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) errs['ct-email'] = 'Enter an email like name@example.com.';
    if (body.value.trim().length < 10) errs['ct-body'] = 'Tell us a little more (at least 10 characters).';
    for (const el of [name, email, body]) {
      el.closest('.field').classList.toggle('invalid', !!errs[el.id]);
      el.setAttribute('aria-invalid', errs[el.id] ? 'true' : 'false');
      $('#e-' + el.id).textContent = errs[el.id] || '';
    }
    $('#ct-error').textContent = '';
    const first = Object.keys(errs)[0];
    if (first) { $('#' + first).focus(); return; }
    const btn = $('#ct-send');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Sending…';
    try {
      await api.contact({ name: name.value, email: email.value, topic: topic.value, orderId: orderField.hidden ? '' : $('#ct-order').value, body: body.value });
      $('#contact').innerHTML = `<div class="contact-done" role="status">${ic('check')}<h2 id="contact-h">Thanks, ${esc(name.value.trim().split(/\s+/)[0])}</h2><p>We’ve got your message and will reply to ${esc(email.value.trim())}, usually within a day.</p><button class="btn btn-secondary" type="button" data-act="help-again">Send another message</button></div>`;
      $('#contact').scrollIntoView({ block: 'nearest' });
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Send message';
      $('#ct-error').textContent = err.message;
    }
  });
}
