'use strict';

/* The demo accounts npm run seed creates. The emails are reserved for demo data: re-seeding
   replaces these accounts (and their orders) but never touches anyone else's. The passwords
   are listed in README.md. */

const DEMO_CUSTOMER = { name: 'Alex Morgan', email: 'demo@morsel.app', password: 'morsel-demo-2026' };

const ADMIN = { name: 'Morgan Ellis', email: 'admin@morsel.app', password: 'morsel-admin-2026' };

const PARTNER_PASSWORD = 'morsel-partner-2026';
/* One partner per catalog restaurant: partner.<restaurant slug>@morsel.app */
const PARTNER_NAMES = {
  'forno-sette': 'Giulia Moretti',
  'smash-society': 'Jake Turner',
  'bao-and-broth': 'Mei Lin',
  'kaze-sushi': 'Haruto Sato',
  'green-theory': 'Freya Larsen',
  'taqueria-luna': 'Diego Ramírez',
  'sweet-spot': 'Amélie Laurent',
  'morning-club': 'Oscar Bennett',
  'spice-route': 'Anika Sharma'
};
const partnerEmail = slug => `partner.${slug}@morsel.app`;

const COURIER_PASSWORD = 'morsel-courier-2026';
const COURIERS = [
  { name: 'Dan Ionescu', email: 'courier1@morsel.app', vehicle: 'bike' },
  { name: 'Ruth Okafor', email: 'courier2@morsel.app', vehicle: 'scooter' },
  { name: 'Pia Novak', email: 'courier3@morsel.app', vehicle: 'car' }
];

/* Customers behind the order history on the admin dashboard. They can't log in (random passwords). */
const HISTORY_DOMAIN = 'customers.morsel.app';

const reservedEmails = () => [DEMO_CUSTOMER.email, ADMIN.email, ...Object.keys(PARTNER_NAMES).map(partnerEmail), ...COURIERS.map(c => c.email)];

module.exports = { DEMO_CUSTOMER, ADMIN, PARTNER_PASSWORD, PARTNER_NAMES, partnerEmail, COURIER_PASSWORD, COURIERS, HISTORY_DOMAIN, reservedEmails };
