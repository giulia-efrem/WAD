'use strict';

const config = require('../config');
const { isOpenNow } = require('./hours');
const { estimate } = require('./orderFlow');

/* Shapes documents into the JSON the front end reads. */

/* A photo as the browser needs it: the URL plus what to show while it loads and who to credit. */
function photoOut(e) {
  const c = e.imageCredit;
  return {
    image: e.image || '',
    imageColor: e.imageColor || '',
    imageAlt: e.imageAlt || '',
    imageCredit: c && c.name ? { name: c.name, profileUrl: c.profileUrl, photoUrl: c.photoUrl } : null
  };
}

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
    ...photoOut(r),
    isOpen: isOpenNow(r.hours, now),
    /* Paused by the restaurant or an admin: shown, but not taking orders. */
    paused: !!r.paused,
    /* Lets search find dishes (and their tags) and show them with a photo and price, without
       loading every menu. A meal deal shows its main dish's photo, as on the menu. */
    dishes: r.menu.flatMap(s => s.items.map(it => {
      const photo = it.kind === 'deal' && it.deal ? dealOut(r, it).photo : it;
      return {
        slug: it.slug, name: it.name, description: it.description, tags: it.tags || [], category: s.category,
        kind: it.kind || 'main', price: it.price, popular: !!it.popular, soldOut: !!it.soldOut,
        image: photo.image || '', imageColor: photo.imageColor || ''
      };
    }))
  };
}

const findDish = (r, slug) => { for (const s of r.menu) { const it = s.items.find(x => x.slug === slug); if (it) return it; } return null; };

/* A meal deal shows the photo of its default main dish (no photo of its own). */
function dealOut(r, it) {
  const mainPart = it.deal.parts.find(p => p.main) || it.deal.parts[0];
  const mainDish = mainPart && findDish(r, mainPart.choices[0].itemSlug);
  return {
    photo: photoOut(mainDish || {}),
    deal: {
      parts: it.deal.parts.map(p => ({
        key: p.key, name: p.name, main: p.main,
        choices: p.choices.map(c => { const d = findDish(r, c.itemSlug); return { itemSlug: c.itemSlug, name: d ? d.name : c.itemSlug, price: d ? d.price : 0, delta: c.delta, soldOut: !d || !!d.soldOut }; })
      }))
    }
  };
}

/* Every EU allergen that appears somewhere on the menu, for the restaurant's info section. */
const menuAllergens = r => [...new Set(r.menu.flatMap(s => s.items.flatMap(it => it.allergens || [])))].sort();

function restaurantDetail(r, now = new Date()) {
  const { dishes, ...card } = restaurantCard(r, now);
  return {
    ...card,
    address: { street: (r.address && r.address.street) || '', area: (r.address && r.address.area) || '' },
    allergens: menuAllergens(r),
    menu: r.menu.map(s => ({
      category: s.category,
      items: s.items.map(it => ({
        slug: it.slug,
        name: it.name,
        description: it.description,
        price: it.price,
        popular: it.popular,
        soldOut: !!it.soldOut,
        kind: it.kind || 'main',
        tags: it.tags || [],
        allergens: it.allergens || [],
        ...(it.kind === 'deal' && it.deal ? (({ photo, deal }) => ({ ...photo, deal }))(dealOut(r, it)) : { ...photoOut(it), deal: null }),
        ingredients: (it.ingredients || []).map(i => ({ id: i.id, name: i.name, removable: i.removable })),
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
  const est = estimate(o, now);
  const rest = o.restaurant && o.restaurant.slug ? o.restaurant : null;
  return {
    _id: String(o._id),
    restaurant: String(rest ? rest._id : o.restaurant),
    restaurantSlug: rest ? rest.slug : null,
    restaurantName: o.restaurantName,
    items: o.items.map(l => ({
      itemSlug: l.itemSlug, name: l.name, qty: l.qty, unitPrice: l.unitPrice,
      options: l.options.map(x => ({ group: x.group, choice: x.choice, price: x.price })),
      parts: (l.parts || []).map(x => ({ group: x.group, itemSlug: x.itemSlug, name: x.name, price: x.price })),
      removed: (l.removed || []).map(x => ({ id: x.id, name: x.name })), note: l.note || ''
    })),
    pricing: { ...(o.pricing.toObject ? o.pricing.toObject() : o.pricing) },
    address: { label: o.address.label, street: o.address.street, details: o.address.details || '', city: o.address.city },
    payment: o.payment,
    courierNote: o.courierNote || '',
    delivery: o.delivery.type === 'scheduled' ? { type: 'scheduled', at: o.delivery.at } : { type: 'asap' },
    promoCode: o.promoCode || null,
    etaMin: o.etaMin,
    startAt: new Date(o.startAt).getTime(),
    customerName: o.customerName || '',
    courier: { name: (o.courier && o.courier.name) || '', vehicle: (o.courier && o.courier.vehicle) || '', assigned: !!(o.courier && o.courier.name) },
    review: o.review && o.review.food ? { food: o.review.food, delivery: o.review.delivery, comment: o.review.comment || '', reviewedAt: o.review.reviewedAt } : null,
    createdAt: o.createdAt,
    status: o.status || 'placed',
    statusAt: new Date(o.statusAt || o.createdAt).getTime(),
    timeline: (o.timeline || []).map(t => ({ status: t.status, at: t.at, by: t.by, note: t.note || '' })),
    prepMinutes: est.prep,
    travelMinutes: est.travel,
    cancelReason: o.cancelReason || '',
    /* Minutes left and how far the courier is along the route (0 to 1), from the server's clock. */
    track: { remaining: est.remaining, frac: est.frac, scheduled: !!est.scheduled },
    serverNow: now,
    simMinuteMs: config.simMinuteMs,
    demoSpeed: config.demoSpeed
  };
}

module.exports = { photoOut, restaurantCard, restaurantDetail, orderOut };
