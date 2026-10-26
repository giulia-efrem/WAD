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
| `UNSPLASH_ACCESS_KEY` | from unsplash.com/developers | Optional. Used only by `npm run photos` and /admin/photos, never sent to the browser |

Never commit `.env`. It is listed in `.gitignore`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the server and restarts it when files change (`node --watch`) |
| `npm start` | Starts the server |
| `npm run seed` | Resets the 9 restaurants and menus, applies photos from `seed/images.json`, and recreates the demo account |
| `npm run photos` | Finds Unsplash photos for every restaurant and dish (see below). Safe to stop and run again |
| `npm run screenshots` | Screenshots the main views at 375, 768 and 1440 px in light and dark mode into `screenshots/` (needs the server running) |

The seed keeps each restaurant's `_id` stable by slug, so existing favourites and orders keep working. It leaves every account except the demo one alone. Photos are reset to what `seed/images.json` says, so a photo set only in /admin is overwritten by a re-seed.

### Demo account

`demo@morsel.app` / `morsel-demo-2026`, with a saved home address and one delivered, rated order.

### Photos

Each restaurant and dish has an `image` field plus its colour, alt text and photo credit. While a photo loads its colour shows, then it fades in. When there's no photo, or it fails to load, the restaurant's illustration shows instead.

**From Unsplash (`npm run photos`).** `scripts/fetch-photos.js` runs one search per item with the query in `scripts/photo-queries.js`: restaurant covers first, then popular dishes, then the rest. It keeps the 8 best results per item in `seed/photo-candidates.json`, picks a default (right shape, no people, text or logos in its description, never the same photo twice), triggers that photo's Unsplash download event, and saves it to MongoDB and `seed/images.json`.

- **Rate limits.** It uses at most 40 requests in any rolling hour (`PHOTOS_PER_HOUR` changes this), and pauses whenever Unsplash reports 10 or fewer left, so the review page always has some. Rate-limit errors wait for the next hour once; any other error stops the run. Nothing is retried in a loop. A demo key needs about 4 hours for all 77 items.
- **Resuming.** Run `npm run photos` again at any time. Items with a photo are skipped and saved searches are reused, so no request is wasted. Change a query in `photo-queries.js` and that item is searched again on the next run. Its progress is logged to the console (redirect it to `photos.log` if you like).
- **Hotlinking.** Photos are shown straight from Unsplash using the URL the API returned, with size parameters added (`w`, `h`, `fit=crop`, `q`, `auto=format`) and a `srcset` for each place. Nothing is downloaded or re-hosted, and the access key never leaves the server.
- **Credit.** "Photo by NAME on Unsplash" appears on restaurant covers and in the dish window, and [/credits](http://localhost:3000/credits) lists every photo. Links carry `?utm_source=morsel&utm_medium=referral`.

**Review (`/admin/photos`).** Shows every restaurant and dish with its current photo and the other saved results. Clicking a result makes it the photo and triggers its download event (1 request). "Search again" runs your own query (1 request) and replaces the saved results; the script then keeps your query. "Remove photo" brings back the illustration, and the script won't pick a new one.

**By hand (`/admin`).** Paste any image URL or upload a JPG, PNG or WebP up to 8 MB. Uploads are saved in `uploads/` and served at `/uploads/...`.

**`seed/images.json`** mirrors whatever is chosen, so `npm run seed` restores every photo with its credit. Values are either a plain URL or `{ url, color, blurHash, alt, credit }`.

Sign up or log in with `ADMIN_EMAIL` to use the admin pages (or the **Photos** button in the header).

## Pages

| Address | What it is |
|---|---|
| `/` | Home: search, cuisines, the "Popular right now", "Under 25 minutes" and "Free delivery" rows, then every restaurant |
| `/#r-forno-sette` | A restaurant and its menu (`#checkout`, `#account` and `#order-<id>` work the same way) |
| `/about`, `/help`, `/terms`, `/privacy` | Placeholder content pages |
| `/credits` | Every Unsplash photo with its photographer |
| `/admin`, `/admin/photos` | Admin only: set photos by URL or upload, and review Unsplash photos |

Any other address shows a "page not found" view with a 404 status.

## Project layout

```
server/
  app.js            Express app: security headers, static files, page routes, API routes, errors
  config.js  db.js
  models/           User, Restaurant, Order (Mongoose)
  routes/           auth, addresses, favorites, restaurants, promo, orders, admin, credits
  middleware/       auth (JWT cookie), validate (zod), rate limits, uploads (multer), errors
  lib/              pricing, orderStatus, hours, response shaping, unsplash, photos, photoPick
public/
  index.html  admin.html  admin-photos.html
  css/              styles.css, admin.css
  js/               main.js, router.js, api.js, state.js, ui.js, photos.js, ... and views/
scripts/            fetch-photos.js and photo-queries.js (npm run photos), screenshots.js
seed/               seed.js, catalog.js, images.json, photo-candidates.json
screenshots/        the latest npm run screenshots output
uploads/            admin uploads (not committed)
reference/          the original single-file app
```

### Screenshots

With the server running, `npm run screenshots` saves home, a restaurant, the dish window, the bag, checkout, order tracking, the account page, `/admin/photos` and `/credits` at 375, 768 and 1440 px in light and dark mode to `screenshots/`. It uses the Microsoft Edge already installed (set `PW_CHANNEL=chrome` for Chrome), logs in as the demo account, and creates a temporary admin user and order that it deletes again. Options: `--views=home,restaurant`, `--widths=375,1440`, `--themes=dark`, `--out=folder`.

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

### Restaurants, promo codes and credits

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/restaurants` | | Cards with `isOpen` and a compact `dishes` list for search |
| GET | `/restaurants/:slug` | | Full restaurant with `menu` and option groups |
| GET | `/credits` | | Every Unsplash photo in use with its photographer |
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
| GET | `/admin/photos` | | Every restaurant and dish with its photo, saved Unsplash results and the request quota |
| POST | `/admin/photos/choose` | `{ key, photoId }` | Uses a saved result and triggers its Unsplash download event. 409 if another item uses it |
| POST | `/admin/photos/search` | `{ key, query }` | New Unsplash search for that item (replaces its saved results) |
| POST | `/admin/photos/remove` | `{ key }` | Clears the photo |

`key` is a restaurant slug (`forno-sette`) or `slug/itemSlug` (`forno-sette/margherita`). When the Unsplash limit is nearly used up (3 or fewer left), choose and search return 429 `rate_limited`.

Uploads must be JPG, PNG or WebP, up to 8 MB, and the file contents are checked, not only the extension. Once a replaced upload is no longer used anywhere, it is deleted from disk.

## What stays in the browser

Only the bag (with any promo code waiting to be applied) and dismissed banners are kept in `localStorage`. Accounts, addresses, favourites and orders all live in MongoDB.
