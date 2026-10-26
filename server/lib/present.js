'use strict';

const config = require('../config');
const { isOpenNow } = require('./hours');
const { progress } = require('./orderStatus');

/* Shapes documents into the JSON the front end reads. */

function restaurantCard(r, now = new Date()) {
  return {
    _id: String(r._id),
    slug: r.slug,
    name: r.name,
    cuisines: r.cuisines,
    label: r.label,
    tagline: r.tagline,
    priceLevel: r.priceLevel,
    rating: r.rating,
    reviewCount: r.reviewCount,
    eta: { min: r.eta.min, max: r.eta.max },
    deliveryFee: r.deliveryFee,
    minOrder: r.minOrder,
    hours: r.hours.map(h => ({ open: h.open, close: h.close })),
    color: r.color,
    ink: r.ink,
    illustration: r.illustration,
    image: r.image || '',
    isOpen: isOpenNow(r.hours, now),
    /* Lets the home page search dishes without loading every menu. */
    dishes: r.menu.flatMap(s => s.items.map(it => ({ name: it.name, description: it.description })))
  };
}

function restaurantDetail(r, now = new Date()) {
  const { dishes, ...card } = restaurantCard(r, now);
  return {
    ...card,
    menu: r.menu.map(s => ({
      category: s.category,
      items: s.items.map(it => ({
        slug: it.slug,
        name: it.name,
        description: it.description,
        price: it.price,
        popular: it.popular,
        image: it.image || '',
        optionGroups: it.optionGroups.map(g => ({
          key: g.key, name: g.name, type: g.type, ...(g.type === 'many' ? { max: g.max } : {}),
          choices: g.choices.map(c => ({ id: c.id, name: c.name, price: c.price }))
        }))
      }))
    }))
  };
}

/* `restaurant` may be populated with { slug } or be a bare id. */
function orderOut(o, now = Date.now()) {
  const pr = progress(o, now);
  const rest = o.restaurant && o.restaurant.slug ? o.restaurant : null;
  return {
    _id: String(o._id),
    restaurant: String(rest ? rest._id : o.restaurant),
    restaurantSlug: rest ? rest.slug : null,
    restaurantName: o.restaurantName,
    items: o.items.map(l => ({
      itemSlug: l.itemSlug, name: l.name, qty: l.qty, unitPrice: l.unitPrice,
      options: l.options.map(x => ({ group: x.group, choice: x.choice, price: x.price })), note: l.note || ''
    })),
    pricing: { ...(o.pricing.toObject ? o.pricing.toObject() : o.pricing) },
    address: { label: o.address.label, street: o.address.street, details: o.address.details || '', city: o.address.city },
    payment: o.payment,
    courierNote: o.courierNote || '',
    delivery: o.delivery.type === 'scheduled' ? { type: 'scheduled', at: o.delivery.at } : { type: 'asap' },
    promoCode: o.promoCode || null,
    etaMin: o.etaMin,
    startAt: new Date(o.startAt).getTime(),
    courier: { name: o.courier.name, vehicle: o.courier.vehicle },
    rating: o.rating && o.rating.stars ? { stars: o.rating.stars, comment: o.rating.comment || '', ratedAt: o.rating.ratedAt } : null,
    createdAt: o.createdAt,
    status: { stage: pr.stage, sim: pr.sim, remaining: pr.remaining, frac: pr.frac },
    serverNow: now,
    simMinuteMs: config.simMinuteMs,
    demoSpeed: config.demoSpeed
  };
}

module.exports = { restaurantCard, restaurantDetail, orderOut };
