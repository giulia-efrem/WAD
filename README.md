# Morsel

A food delivery web app: browse 9 restaurants, build a bag, check out with promo codes and tips, and track the courier live. Express and MongoDB on the server, plain HTML, CSS and JavaScript in the browser. The original single-file design lives in `reference/morsel.html`.

## Setup

You need Node.js 20 or newer and MongoDB (local, or a MongoDB Atlas cluster).

```bash
npm install
cp .env.example .env      # then edit .env (see below)
npm run seed              # loads restaurants, menus and the demo account
npm run dev               # or: npm start
```

Open **http://localhost:3000**. Click **Log in**, then **Continue with the demo account**.

### .env

| Variable | Example | What it does |
|---|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/morsel` | Database connection string |
| `JWT_SECRET` | long random string | Signs the login cookie. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `PORT` | `3000` | HTTP port |
| `ADMIN_EMAIL` | `you@example.com` | Whoever signs up with this email gets the admin role |
| `DEMO_SPEED` | `30` | Order tracking speed. 30 means one simulated minute lasts 2 seconds. 1 is real time, and turns off "Skip to next step" |

Never commit `.env`. It is listed in `.gitignore`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the server and restarts it when files change (`node --watch`) |
| `npm start` | Starts the server |
| `npm run seed` | Resets the 9 restaurants and menus, applies photos from `seed/images.json`, and recreates the demo account |

The seed keeps each restaurant's `_id` stable by slug, so existing favourites and orders keep working. It leaves every account except the demo one alone. Photos are reset to what `seed/images.json` says, so a photo set only in /admin is overwritten by a re-seed.

### Demo account

`demo@morsel.app` / `morsel-demo-2026`, with a saved home address and one delivered, rated order.

### Photos and the admin page

Each restaurant and dish has an `image` field. When it's empty, or the image fails to load, the restaurant's illustration shows instead. There are two ways to set photos:

1. **`seed/images.json`**: fill in URLs for keys like `"forno-sette"` (cover photo) or `"forno-sette/margherita"` (dish), then run `npm run seed`.
2. **`/admin`**: sign up or log in with `ADMIN_EMAIL`, then open http://localhost:3000/admin (or use the **Photos** button in the header). Paste a URL or upload a JPG, PNG or WebP up to 8 MB. Uploads are saved in `uploads/` and served at `/uploads/...`.

## Project layout

```
server/
  app.js            Express app: security headers, static files, API routes, errors
  config.js  db.js
  models/           User, Restaurant, Order (Mongoose)
  routes/           auth, addresses, favorites, restaurants, promo, orders, admin
  middleware/       auth (JWT cookie), validate (zod), rate limits, uploads (multer), errors
  lib/              pricing, orderStatus, hours, response shaping
public/
  index.html  admin.html
  css/              styles.css (from the reference), admin.css
  js/               main.js, router.js, api.js, state.js, ui.js, ... and views/
seed/               seed.js, catalog.js (restaurants and option groups), images.json
uploads/            admin uploads (not committed)
reference/          the original single-file app
```

## How the server keeps orders honest

- **Prices come from the database.** The browser sends only item slugs, quantities, chosen option ids and notes. The server rebuilds each line (base price plus options), then adds delivery, the service fee (5% of the subtotal, min €0.49, max €1.99), a small order fee (the gap to the minimum order), the promo and the tip. Any price fields the browser sends are ignored. If the browser also sends `expectedTotal` and it doesn't match, the order is refused, so the customer never pays an amount they weren't shown.
- **Requests are rejected** for unknown items or options, a missing required option, too many extras, quantities outside 1 to 20, ASAP orders from a closed restaurant, scheduled times outside opening hours (or less than 30 minutes or more than 24 hours ahead), tips other than €0, €1, €2 or €3, invalid promo codes, and addresses that aren't the user's.
- **Promo codes.** `WELCOME20` takes 20% off food, up to €8, on a user's first order only. `FREEDEL` makes delivery free, and is refused where delivery is already free.
- **Order status** is calculated from `startAt` and `DEMO_SPEED` with the same timeline as the reference: placed, confirmed, preparing, pickup, on the way, delivered. It is returned with every order. The tracking page runs the same timeline locally between server updates, so the courier moves smoothly.
- **Opening hours** are checked in the server's local time zone.
- **Ownership.** Users can only read and change their own addresses, favourites and orders. Other people's orders return 404.

## API reference

All endpoints are under `/api`, take and return JSON, and use the session cookie (`morsel_session`: httpOnly, SameSite=Lax, Secure when `NODE_ENV=production`, valid for 7 days). Every error looks like this:

```json
{ "error": { "code": "invalid_quantity", "message": "Choose between 1 and 20 of Fries." } }
```

Money is always in cents.

### Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/signup` | `{ name, email, password }` | Password must be 8 to 72 characters. Sets the cookie. Limited to 10 per hour per IP |
| POST | `/auth/login` | `{ email, password }` | Sets the cookie. 10 failed attempts per 15 minutes per IP |
| POST | `/auth/logout` | | Clears the cookie |
| GET | `/auth/me` | | `{ user }` with `orderCount`, or `{ user: null }` when logged out |

### Addresses and favourites (logged in)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/addresses` | `{ label: Home, Work or Other, street, details?, city, makeDefault? }` | Returns `{ user, addressId }`. The first address becomes the default |
| PATCH | `/addresses/:id/default` | | Returns `{ user }` |
| DELETE | `/addresses/:id` | | Returns `{ user }`. Deleting the default promotes the next address |
| POST | `/favorites/:restaurantId/toggle` | | Returns `{ user, favorite }` |

### Restaurants and promo codes

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/restaurants` | | Cards with `isOpen` and a compact `dishes` list for search |
| GET | `/restaurants/:slug` | | Full restaurant with `menu` and option groups |
| POST | `/promo/validate` | `{ code, restaurantSlug? }` | Login optional. Returns 200 `{ valid, code, kind }`, or 400 `invalid_promo` with the reason |

### Orders (logged in)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/orders` | see below | Returns 201 `{ order }` |
| GET | `/orders/mine` | | Newest first |
| GET | `/orders/:id` | | |
| POST | `/orders/:id/rate` | `{ stars: 1-5, comment? }` | Only once the order is delivered, and only once |
| POST | `/orders/:id/skip` | | Demo only (`DEMO_SPEED` above 1): moves the order to its next stage |

```json
{
  "restaurantSlug": "smash-society",
  "items": [
    { "itemSlug": "classic", "qty": 2, "options": { "sauce": "bbq", "burgerExtras": ["bacon"] }, "note": "No pickles" }
  ],
  "addressId": "…",
  "payment": "card",
  "courierNote": "Ring twice",
  "delivery": { "type": "asap" },
  "promoCode": "WELCOME20",
  "tip": 100,
  "expectedTotal": 2089
}
```

For a scheduled order, use `"delivery": { "type": "scheduled", "at": "2026-10-27T19:30:00+01:00" }`. `at` can also be milliseconds since the epoch.

Each order in a response also includes `status: { stage, remaining, sim, frac }`, `serverNow`, `simMinuteMs` and `demoSpeed`.

### Admin (admin role only)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/admin/catalog` | | All restaurants with full menus |
| PUT | `/admin/restaurants/:slug/image` | JSON `{ url }` or multipart field `image` | An empty `url` removes the photo |
| PUT | `/admin/restaurants/:slug/items/:itemSlug/image` | same | |

Uploads must be JPG, PNG or WebP, up to 8 MB, and the file contents are checked, not only the extension. Once a replaced upload is no longer used anywhere, it is deleted from disk.

## What stays in the browser

Only the bag (with any promo code waiting to be applied) and dismissed banners are kept in `localStorage`. Accounts, addresses, favourites and orders all live in MongoDB.
