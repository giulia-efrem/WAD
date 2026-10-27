'use strict';

const { badRequest } = require('./httpError');

/* All money is in integer cents. Nothing price-related is taken from the browser:
   every figure here is rebuilt from the restaurant document in MongoDB. */

const SERVICE_FEE_RATE = 0.05;
const SERVICE_FEE_MIN = 49;
const SERVICE_FEE_MAX = 199;
const WELCOME_RATE = 0.2;
const WELCOME_MAX = 800;
const TIP_CHOICES = [0, 100, 200, 300];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function findItem(restaurant, itemSlug) {
  for (const section of restaurant.menu) {
    const item = section.items.find(it => it.slug === itemSlug);
    if (item) return item;
  }
  return null;
}

/* Checks a dish's chosen options and left-out ingredients. Returns what they add to the price
   and their snapshot for the order. Throws a 400 that says what was wrong. */
function customise(item, requested = {}, remove = []) {
  const groups = item.optionGroups || [];
  for (const key of Object.keys(requested)) {
    if (!groups.some(g => g.key === key)) throw badRequest(`${item.name} has no “${key}” option.`, 'unknown_option');
  }
  const options = [];
  let extra = 0;
  for (const g of groups) {
    const raw = requested[g.key];
    if (g.type === 'one') {
      if (raw == null) throw badRequest(`Choose a ${g.name.toLowerCase()} for ${item.name}.`, 'missing_option');
      if (typeof raw !== 'string') throw badRequest(`Pick one ${g.name.toLowerCase()} for ${item.name}.`, 'invalid_option');
      const choice = g.choices.find(c => c.id === raw);
      if (!choice) throw badRequest(`“${raw}” isn’t a ${g.name.toLowerCase()} for ${item.name}.`, 'unknown_option');
      options.push({ group: g.name, choice: choice.name, price: choice.price });
      extra += choice.price;
    } else {
      if (raw == null) continue;
      const ids = Array.isArray(raw) ? raw : [raw];
      if (ids.some(id => typeof id !== 'string')) throw badRequest(`Invalid ${g.name.toLowerCase()} for ${item.name}.`, 'invalid_option');
      if (new Set(ids).size !== ids.length) throw badRequest(`Each ${g.name.toLowerCase()} can only be added once.`, 'invalid_option');
      if (ids.length > g.max) throw badRequest(`Choose up to ${g.max} ${g.name.toLowerCase()} for ${item.name}.`, 'too_many_options');
      /* Keep the menu's order so equal selections always produce the same line. */
      for (const choice of g.choices) {
        if (!ids.includes(choice.id)) continue;
        options.push({ group: g.name, choice: choice.name, price: choice.price });
        extra += choice.price;
      }
      const unknown = ids.find(id => !g.choices.some(c => c.id === id));
      if (unknown) throw badRequest(`“${unknown}” isn’t an option for ${item.name}.`, 'unknown_option');
    }
  }
  if (remove.some(id => typeof id !== 'string')) throw badRequest(`Invalid ingredient for ${item.name}.`, 'invalid_option');
  if (new Set(remove).size !== remove.length) throw badRequest('Each ingredient can only be removed once.', 'invalid_option');
  for (const id of remove) {
    const ing = (item.ingredients || []).find(i => i.id === id);
    if (!ing) throw badRequest(`“${id}” isn’t an ingredient of ${item.name}.`, 'unknown_ingredient');
    if (!ing.removable) throw badRequest(`${ing.name} can’t be left out of ${item.name}.`, 'not_removable');
  }
  /* In the menu's order, so equal choices always describe the same line. */
  const removed = (item.ingredients || []).filter(i => remove.includes(i.id)).map(i => ({ id: i.id, name: i.name }));
  return { extra, options, removed };
}

/* The standard version of a deal's side or drink: the first choice of each required group. */
const standardOptions = item => (item.optionGroups || []).filter(g => g.type === 'one').map(g => ({ group: g.name, choice: g.choices[0].name, price: g.choices[0].price }));

/* Turns one requested line into a priced order line, or throws a 400 that says what was wrong.
   Dish: { itemSlug, qty, options: { groupKey: choiceId | [choiceIds] }, remove: [ingredientIds], note }
   Meal deal: the same plus parts: { partKey: dishSlug }; options and remove apply to the main dish.
   A deal costs its price, plus each chosen part's surcharge, plus the main dish's paid options. */
function priceLine(restaurant, line) {
  const item = findItem(restaurant, line.itemSlug);
  if (!item) throw badRequest(`“${line.itemSlug}” isn’t on the menu at ${restaurant.name}.`, 'unknown_item');
  if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 20) {
    throw badRequest(`Choose between 1 and 20 of ${item.name}.`, 'invalid_quantity');
  }
  const note = (line.note || '').trim();
  if (item.kind !== 'deal') {
    if (line.parts && Object.keys(line.parts).length) throw badRequest(`${item.name} isn’t a meal deal.`, 'invalid_option');
    const { extra, options, removed } = customise(item, line.options, line.remove || []);
    return { itemSlug: item.slug, name: item.name, qty: line.qty, unitPrice: item.price + extra, options, removed, parts: [], note };
  }
  const deal = item.deal || { parts: [] };
  const picked = line.parts || {};
  for (const key of Object.keys(picked)) {
    if (!deal.parts.some(p => p.key === key)) throw badRequest(`${item.name} has no “${key}” part.`, 'unknown_part');
  }
  let unitPrice = item.price;
  let main = { extra: 0, options: [], removed: [] };
  const parts = [];
  for (const part of deal.parts) {
    const slugValue = picked[part.key];
    if (!slugValue) throw badRequest(`Choose a ${part.name.toLowerCase()} for ${item.name}.`, 'missing_part');
    if (typeof slugValue !== 'string') throw badRequest(`Pick one ${part.name.toLowerCase()} for ${item.name}.`, 'invalid_part');
    const choice = part.choices.find(c => c.itemSlug === slugValue);
    if (!choice) throw badRequest(`“${slugValue}” isn’t a ${part.name.toLowerCase()} you can choose in ${item.name}.`, 'unknown_part');
    const dish = findItem(restaurant, slugValue);
    if (!dish) throw badRequest(`“${slugValue}” isn’t on the menu at ${restaurant.name}.`, 'unknown_item');
    unitPrice += choice.delta;
    if (part.main) main = customise(dish, line.options, line.remove || []);
    parts.push({ group: part.name, itemSlug: dish.slug, name: dish.name, price: choice.delta, options: part.main ? [] : standardOptions(dish) });
  }
  if (!deal.parts.some(p => p.main) && ((line.remove || []).length || Object.keys(line.options || {}).length)) {
    throw badRequest(`${item.name} can’t be customised.`, 'invalid_option');
  }
  return { itemSlug: item.slug, name: item.name, qty: line.qty, unitPrice: unitPrice + main.extra, options: main.options, removed: main.removed, parts, note };
}

/* Returns '' when the code can be used, otherwise the message to show (same wording as the reference). */
function promoError(code, { restaurant, user, orderCount }) {
  if (code === 'WELCOME20') {
    if (!user) return 'Log in to use WELCOME20.';
    if (orderCount > 0) return 'WELCOME20 is for your first order only.';
    return '';
  }
  if (code === 'FREEDEL') {
    if (restaurant && !restaurant.deliveryFee) return 'Delivery from this restaurant is already free.';
    return '';
  }
  return 'That code isn’t valid. Check the spelling and try again.';
}

function computePricing({ restaurant, subtotal, promoCode, tip }) {
  const deliveryFee = restaurant.deliveryFee;
  const smallOrderFee = Math.max(0, restaurant.minOrder - subtotal);
  const serviceFee = clamp(Math.round(subtotal * SERVICE_FEE_RATE), SERVICE_FEE_MIN, SERVICE_FEE_MAX);
  let discount = 0, deliveryDiscount = 0;
  if (promoCode === 'WELCOME20') discount = Math.min(WELCOME_MAX, Math.round(subtotal * WELCOME_RATE));
  if (promoCode === 'FREEDEL') deliveryDiscount = deliveryFee;
  const total = subtotal + deliveryFee + serviceFee + smallOrderFee - discount - deliveryDiscount + tip;
  return { subtotal, deliveryFee, serviceFee, smallOrderFee, discount, deliveryDiscount, tip, total };
}

module.exports = { TIP_CHOICES, findItem, priceLine, promoError, computePricing };
