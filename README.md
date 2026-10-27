# Morsel

A food delivery web app: browse 9 restaurants, customise dishes, keep a basket per restaurant, check out with promo codes and tips, track the courier live, and review the order afterwards. It works like a real platform with four kinds of account: customers order, restaurant partners accept and prepare orders, couriers deliver them, and admins run everything from a dashboard. Express and MongoDB on the server, plain HTML, CSS and JavaScript in the browser. The original single-file design lives in `reference/morsel.html`.

## Setup

You need Node.js 20 or newer and MongoDB (local, or a MongoDB Atlas cluster).

```bash
npm install
cp .env.example .env      # then edit .env (see below)
npm run seed              # loads restaurants, menus, demo accounts and 30 days of orders
npm run dev               # or: npm start
```

Open **http://localhost:3000**. Click **Log in**, then **Continue with the demo account**. Staff pages are at **/admin**, **/partner** and **/courier** (accounts below).

### .env

| Variable | Example | What it does |
|---|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/morsel` | Database connection string |
| `JWT_SECRET` | long random string | Signs the login cookie. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `PORT` | `3000` | HTTP port |
| `DEMO_SPEED` | `30` | Order tracking speed. 30 means one simulated minute lasts 2 seconds. 1 is real time, and turns off "Skip to next step" |
| `UNSPLASH_ACCESS_KEY` | from unsplash.com/developers | Optional. Used only by `npm run photos` and /admin/photos, never sent to the browser |

Never commit `.env`. It is listed in `.gitignore`.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the server and restarts it when files change (`node --watch`) |
| `npm start` | Starts the server |
| `npm run seed` | Resets the 9 restaurants and their menus (190 dishes, 21 meal deals), applies photos from `seed/images.json`, and recreates the demo data: demo accounts, 30 days of order history, seeded reviews and the WELCOME20 and FREEDEL codes |
| `npm run make-admin -- you@example.com` | Gives an existing account the admin role (sign up on the site first) |
| `npm run photos` | Finds Unsplash photos for every restaurant and dish (see below). Safe to stop and run again |
| `npm run screenshots` | Screenshots the main views at 375, 768 and 1440 px in light and dark mode into `screenshots/` (needs the server running) |

**Running the seed again only resets demo data.** Everything the seed creates is marked `seeded`, and a re-run replaces only those records plus the demo emails listed below (and orders placed while logged into a demo account). Accounts, orders, reviews and promo codes you created yourself are never deleted, and neither are restaurants you added in /admin. The 9 catalog restaurants are reset to the catalog (their `_id` stays the same, so favourites and orders keep working), which also undoes sold-out marks, pauses, menu edits and photos set only in the dashboard. Photos come from `seed/images.json`.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Customer | `demo@morsel.app` | `morsel-demo-2026` |
| Admin | `admin@morsel.app` | `morsel-admin-2026` |
| Partner, Forno Sette | `partner.forno-sette@morsel.app` | `morsel-partner-2026` |
| Partner, Smash Society | `partner.smash-society@morsel.app` | `morsel-partner-2026` |
| Partner, Bao & Broth | `partner.bao-and-broth@morsel.app` | `morsel-partner-2026` |
| Partner, Kaze Sushi | `partner.kaze-sushi@morsel.app` | `morsel-partner-2026` |
| Partner, Green Theory | `partner.green-theory@morsel.app` | `morsel-partner-2026` |
| Partner, Taquería Luna | `partner.taqueria-luna@morsel.app` | `morsel-partner-2026` |
| Partner, The Sweet Spot | `partner.sweet-spot@morsel.app` | `morsel-partner-2026` |
| Partner, Morning Club | `partner.morning-club@morsel.app` | `morsel-partner-2026` |
| Partner, Spice Route | `partner.spice-route@morsel.app` | `morsel-partner-2026` |
| Courier (bike) | `courier1@morsel.app` | `morsel-courier-2026` |
| Courier (scooter) | `courier2@morsel.app` | `morsel-courier-2026` |
| Courier (car) | `courier3@morsel.app` | `morsel-courier-2026` |

The demo customer has a saved address and one delivered, rated order (with a reply from Bao & Broth). The seed also adds 20 customers at `@customers.morsel.app` with about 330 past orders over 30 days, so the dashboard has figures. Those customers can't log in. These passwords are public, so change them (or don't seed) on anything that isn't a demo.

## Roles

| Role | Who | What they can do |
|---|---|---|
| `customer` | Everyone who signs up | Order, track, review, manage their own account |
| `partner` | Works for one restaurant | /partner: accept or reject that restaurant's orders, set preparation times, mark orders ready, mark dishes sold out, pause new orders, reply to reviews |
| `courier` | Delivers | /courier: take an available delivery, mark it picked up and delivered, see today's deliveries and earnings |
| `admin` | Runs Morsel | /admin: everything below, for every restaurant |

- **Nobody can make themselves staff.** Signing up always creates a customer, whatever the request says. Admins create staff accounts and change roles in the dashboard, or run `npm run make-admin -- you@example.com` for the first admin.
- **Every check happens on the server.** The user (and so the role) is loaded from MongoDB on every request, so a role change or a disabled account takes effect at once. Partner routes only ever touch the partner's own restaurant. The staff pages load for anyone but get nothing from the API without the right role.
- **Disabling an account** signs it out everywhere and blocks logging in. So does changing a password (except on the device that changed it). Admins can't disable themselves or remove the last admin.

## Order flow and the demo autopilot

Orders go through real steps: **placed → accepted → preparing → ready → picked up → delivered**, or **cancelled**. Each step is saved in the order's `timeline` with who took it and when, and the customer's tracking page shows the six steps, the courier on the map once it's picked up, and the reason if it was cancelled.

| Step | Who |
|---|---|
| Accept (with a preparation time of 5 to 90 minutes) or reject (with a reason) | Partner |
| Start preparing, mark ready for pickup, or cancel with a reason | Partner |
| Take the delivery (from accepted on, one at a time, first come first served) | Courier |
| Picked up (only once ready), delivered | Courier |
| Cancel before the restaurant accepts | Customer |
| Any status, or cancel with a reason | Admin |

The server refuses any other move (`409 order_changed` if someone else moved it first).

**Demo autopilot** (Settings in /admin, on by default) keeps presentations working with only the customer side open. When nobody acts, it accepts an order after a simulated minute, starts preparing a minute later, marks it ready after the preparation time, assigns a demo courier, and picks up and delivers at the same pace as before (`DEMO_SPEED`). It never takes a restaurant's steps while that restaurant's /partner page is open, never touches a delivery a real courier has accepted, and leaves new deliveries to couriers while a /courier page is open. Turn it off to run every step by hand. "Skip to next step" on the tracking page still works in demo mode.

### Photos

Each restaurant and dish has an `image` field plus its colour, alt text and photo credit. While a photo loads its colour shows, then it fades in. When there's no photo, or it fails to load, the restaurant's illustration shows instead.

**From Unsplash (`npm run photos`).** `scripts/fetch-photos.js` runs one search per item with the query in `scripts/photo-queries.js`: restaurant covers first, then popular dishes, then the rest. Only covers, mains, starters and desserts are queued: drinks and sides use text-only cards, and meal deals show the photo of their main dish. It keeps the 8 best results per item in `seed/photo-candidates.json`, picks a default (right shape, no people, text or logos in its description, never the same photo twice), triggers that photo's Unsplash download event, and saves it to MongoDB and `seed/images.json`.

- **Rate limits.** It uses at most 40 requests in any rolling hour (`PHOTOS_PER_HOUR` changes this), and pauses whenever Unsplash reports 10 or fewer left, so the review page always has some. Rate-limit errors wait for the next hour once; any other error stops the run. Nothing is retried in a loop. A demo key needs about 4 hours for all 77 items.
- **Resuming.** Run `npm run photos` again at any time. Items with a photo are skipped and saved searches are reused, so no request is wasted. Change a query in `photo-queries.js` and that item is searched again on the next run. Its progress is logged to the console (redirect it to `photos.log` if you like).
- **Hotlinking.** Photos are shown straight from Unsplash using the URL the API returned, with size parameters added (`w`, `h`, `fit=crop`, `q`, `auto=format`) and a `srcset` for each place. Nothing is downloaded or re-hosted, and the access key never leaves the server.
- **Credit.** "Photo by NAME on Unsplash" appears on restaurant covers and in the dish window, and [/credits](http://localhost:3000/credits) lists every photo. Links carry `?utm_source=morsel&utm_medium=referral`.

**Review (`/admin/photos`).** Shows every restaurant and dish with its current photo and the other saved results. Clicking a result makes it the photo and triggers its download event (1 request). "Search again" runs your own query (1 request) and replaces the saved results; the script then keeps your query. "Remove photo" brings back the illustration, and the script won't pick a new one.

**By hand (`/admin`).** In a restaurant's or dish's edit window, paste any image URL or upload a JPG, PNG or WebP up to 8 MB. Uploads are saved in `uploads/` and served at `/uploads/...`.

**`seed/images.json`** mirrors whatever is chosen, so `npm run seed` restores every photo with its credit. Values are either a plain URL or `{ url, color, blurHash, alt, credit }`.

Log in with an admin account to use them (the header shows an **Admin** button).

## Pages

| Address | What it is |
|---|---|
| `/` | Home: search, cuisines, the "Popular right now", "Under 25 minutes" and "Free delivery" rows, then every restaurant |
| `/#r-forno-sette` | A restaurant and its menu (`#checkout`, `#account` and `#order-<id>` work the same way) |
| `/about`, `/help`, `/terms`, `/privacy` | Placeholder content pages |
| `/credits` | Every Unsplash photo with its photographer |
| `/admin` | Admin dashboard (see below) |
| `/admin/photos` | Admin only: review Unsplash photos |
| `/partner` | Restaurant partners: live orders, menu availability, reviews |
| `/courier` | Couriers, built for phones: available and current deliveries, today's earnings |
| `/#account` | Customers: orders, addresses, favourites, and a Profile tab to edit your name, change your password or delete your account |

### Admin dashboard (`/admin`)

- **Overview:** orders, revenue and average order value today (compared with yesterday by the same time), the average rating, orders in progress, orders and revenue per day for 14 days, and the top dishes and restaurants of the last 30 days. Cancelled orders are never counted. Every chart has a table view.
- **Orders:** filter by status, restaurant, dates and search (customer, street or order number); open an order for its items, address, courier, timeline and totals; change its status or cancel it with a reason.
- **Restaurants:** add and edit restaurants (name, label, tagline, cuisines, price level, delivery time, fees, minimum order, opening hours, colours, illustration, cover photo), and pause or resume orders.
- **Menus:** add, edit and delete dishes and meal deals (price, category, kind, description, tags, allergens, ingredients, option groups with prices, deal parts with surcharges, photo) and mark items sold out. A dish used in a deal can't be deleted until it's removed from the deal.
- **Users:** search, filter by role, create staff accounts, change roles (partners choose a restaurant, couriers a vehicle), disable or enable accounts.
- **Reviews:** filter and search, hide inappropriate reviews (they leave the restaurant page and its rating) or show them again.
- **Promo codes:** create and edit codes (percentage with an optional cap, fixed amount, or free delivery; minimum subtotal; first order only), turn them on and off, and see how often each was used and how much it gave away.
- **Settings:** the demo autopilot.

### Restaurant partner (`/partner`)

New orders appear by themselves (the page checks every 4 seconds, and the tab title counts new orders). A new order shows its items with every choice, ingredient left out and kitchen note; choose a preparation time and accept, or reject with a reason. Then start preparing and mark it ready; the card shows when a courier has taken it. The Menu tab switches dishes between available and sold out, and the switch at the top pauses new orders. The Reviews tab lists the restaurant's reviews (or only the ones without a reply), and a reply is shown publicly under the review on the restaurant page.

### Courier (`/courier`)

Made for phones. Available deliveries show the restaurant, the area, the ride time and what the delivery pays (€3.50 plus the customer's tip), but not the street until it's accepted. The current delivery shows the pickup, the customer's address and note, the items, whether to collect cash, and one big button for the next step. Today's deliveries and earnings are at the top.

### Customer-side changes

Sold-out dishes show as sold out and can't be added (in a meal deal, sold-out choices are greyed out). A paused restaurant shows a notice and "Not taking orders" on its card. Checkout explains either case and the server refuses the order (`sold_out`, `restaurant_paused`). Deleting your account removes it with its addresses and favourites; past orders and reviews stay for the restaurants, shown as "Former customer".

Any other address shows a "page not found" view with a 404 status.

## Project layout

```
server/
  app.js            Express app: security headers, static files, page routes, API routes, errors
  config.js  db.js
  models/           User, Restaurant, Order, Review, Promo, Setting (Mongoose)
  routes/           auth, addresses, favorites, restaurants, promo, orders, partner, courier,
                    admin (photos), adminManage (the dashboard), credits
  middleware/       auth (JWT cookie, roles), validate (zod), rate limits, uploads (multer), errors
  lib/              orderFlow (steps, autopilot), pricing, hours, reviews, response shaping,
                    unsplash, photos, photoPick
public/
  index.html  admin.html  admin-photos.html  partner.html  courier.html
  css/              styles.css, admin.css, staff.css
  js/               main.js, router.js, api.js, state.js, ui.js, photos.js, progress.js, views/,
                    staff.js (shared by the staff pages), admin.js, partner.js, courier.js
scripts/            fetch-photos.js and photo-queries.js (npm run photos), make-admin.js, screenshots.js
seed/               seed.js, staff.js (demo accounts), history.js (past orders), catalog.js, options.js,
                    menus/ (one file per restaurant), reviews.js, images.json, photo-candidates.json
screenshots/        the latest npm run screenshots output
uploads/            admin uploads (not committed)
reference/          the original single-file app
```

### Screenshots

With the server running and the seed loaded, `npm run screenshots` saves home, a restaurant, the dish window, the basket (the order panel on desktop, the order sheet on phones), checkout, order tracking, the account page, the admin overview, the partner board, the courier page, `/admin/photos` and `/credits` at 375, 768 and 1440 px in light and dark mode to `screenshots/`. It uses the Microsoft Edge already installed (set `PW_CHANNEL=chrome` for Chrome), logs in as the demo customer, partner and courier, and creates a temporary admin user and order that it deletes again. Options: `--views=home,restaurant`, `--widths=375,1440`, `--themes=dark`, `--out=folder`.

## How the server keeps orders honest

- **Prices come from the database.** The browser sends only item slugs, quantities, chosen option ids, the ids of ingredients to leave out, and notes. The server rebuilds each line (base price plus options), then adds delivery, the service fee (5% of the subtotal, min €0.49, max €1.99), a small order fee (the gap to the minimum order), the promo and the tip. Any price fields the browser sends are ignored. If the browser also sends `expectedTotal` and it doesn't match, the order is refused, so the customer never pays an amount they weren't shown.
- **Requests are rejected** for unknown or sold-out items, paused restaurants, unknown options, a missing required option, ingredients a dish doesn't have or that can't be left out, too many extras, quantities outside 1 to 20, ASAP orders from a closed restaurant, scheduled times outside opening hours (or less than 30 minutes or more than 24 hours ahead), tips other than €0, €1, €2 or €3, invalid promo codes, and addresses that aren't the user's.
- **Promo codes** live in MongoDB and are managed in /admin. The seed adds `WELCOME20` (20% off food, up to €8, first order only) and `FREEDEL` (free delivery, refused where delivery is already free). A code can be a percentage with an optional cap, a fixed amount or free delivery, with a minimum food subtotal and a first-order-only rule; a code that's turned off says it has ended. Cancelled orders don't count as a first order or as a use.
- **Order status** is a real field moved on by the partner, the courier, an admin or the demo autopilot (see above). Each order also comes with an estimate (`track.remaining` minutes, and `track.frac` for the courier's position) worked out from its status, when that status began, the preparation time and `DEMO_SPEED`. The tracking page re-reads the order every 4 seconds and runs the same estimate in between.
- **Opening hours** are checked in the server's local time zone.
- **Ownership.** Users can only read and change their own addresses, favourites and orders. Other people's orders return 404.
- **Reviews.** One per order, only after delivery: food 1 to 5 stars, delivery thumbs up or down, and an optional comment. A restaurant's `rating` and `reviewCount` are recalculated from its reviews each time one is added (and by `npm run seed`).

## Menus

Each restaurant has 18 to 25 dishes in categories that fit its cuisine, plus 2 to 4 meal deals, and the restaurant page adds a "Popular" section first. Menus live in `seed/menus/<slug>.js` in a compact notation explained in `seed/menus/_build.js`; shared option groups (sizes, extras, spice level, dips...) are in `seed/options.js`. `seed/catalog.js` assembles them and refuses to load if a deal points at a missing dish, saves nothing, or a menu has too few or too many dishes.

Every dish has:

- `kind`: `main`, `starter`, `side`, `drink`, `dessert` or `deal`
- `ingredients`: `[{ id, name, removable }]`
- `tags`: any of `vegetarian`, `vegan`, `spicy`, `gluten-free`, `contains-nuts` (shown as small labels; search finds them too)
- `allergens`: from the 14 EU allergens (`gluten`, `milk`, `egg`, `fish`, `crustaceans`, `molluscs`, `nuts`, `peanuts`, `soy`, `sesame`, `mustard`, `celery`, `sulphites`, `lupin`), shown as "Contains: ..." in the dish window
- `optionGroups`, `price`, `popular` and the photo fields

**Meal deals** (`kind: 'deal'`) have `deal.parts`: for example Burger, Side and Drink, each with `choices: [{ itemSlug, delta }]` where `delta` is a surcharge in cents. The first part is the main dish, which keeps its own customisation (sauce, extras, ingredients to leave out); other parts come in their standard version. A deal costs its price plus the chosen parts' surcharges plus the main dish's paid options. The saving shown ("Save €2.50") is what the chosen dishes cost separately minus the deal price.

## Ordering

- **A basket per restaurant**, kept in the browser like Wolt. On wide screens the restaurant page has a sticky "Your order" panel; on phones and tablets a "View order" bar opens the same order as a bottom sheet. When there are baskets at other restaurants, a "Your baskets" button in the header lists them. Checkout is for one basket at a time (`/#checkout-smash-society`), and placing the order empties only that basket.
- **Customising a dish.** Each dish has ingredients in MongoDB (`seed/ingredients.js`), some marked removable. The dish window shows the photo, name, description, ingredients and price, then the main choice (size, base...), "Remove ingredients", extras, the other choices (spice level, sauce...) and a note for the kitchen. Required choices start empty and must be picked; the button shows the running price. Basket lines read like "Smoky BBQ, no pickles, crispy bacon", and clicking one reopens the dish window to change it.
- **Reviews** appear on each restaurant page with the average, the count, a 5-to-1 breakdown and a list sortable by newest, highest and lowest. `npm run seed` adds 20 to 40 generated reviews per restaurant (the same ones on every run) plus the demo account's.

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
| GET | `/auth/me` | | `{ user }` with `role`, `restaurant` (partners), `vehicle` (couriers) and `orderCount`, or `{ user: null }` when logged out |
| PATCH | `/auth/me` | `{ name }` | Edit your name |
| POST | `/auth/password` | `{ current, password }` | Change your password. Signs out your other sessions |
| DELETE | `/auth/me` | `{ password }` | Customers only. Deletes the account; orders and reviews stay as "Former customer" |

Signup ignores any `role` in the body. A disabled account gets 403 `account_disabled` from login and from any request with its old cookie. Staff routes return 401 when logged out and 403 `forbidden` for the wrong role.

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
| GET | `/restaurants/:slug` | | Full restaurant with `menu` (Meal deals first). Each dish has `kind`, `tags`, `allergens`, option groups and `ingredients`; deals add `deal.parts` with each choice's name, price and surcharge |
| GET | `/restaurants/:slug/reviews` | `?sort=newest|highest|lowest&page=1` | `{ summary: { average, count, breakdown, deliveryUpShare }, reviews, hasMore }`, 10 per page. Your own reviews have `mine: true` |
| GET | `/credits` | | Every Unsplash photo in use with its photographer |
| POST | `/promo/validate` | `{ code, restaurantSlug?, subtotal? }` | Login optional. Returns 200 `{ valid, code, type, value, maxDiscount, minSubtotal, firstOrderOnly, description }`, or 400 `invalid_promo` with the reason |

### Orders (logged in)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/orders` | see below | Returns 201 `{ order }` |
| GET | `/orders/mine` | | Newest first |
| GET | `/orders/:id` | | |
| POST | `/orders/:id/review` | `{ food: 1-5, delivery: 'up' | 'down', comment? }` | Only after delivery, one per order (409 `already_reviewed`). Updates the restaurant's rating |
| POST | `/orders/:id/cancel` | | Only while it's still `placed` (400 `not_cancellable` after that) |
| POST | `/orders/:id/skip` | | Demo only (`DEMO_SPEED` above 1): takes the order's next step at once |

```json
{
  "restaurantSlug": "smash-society",
  "items": [
    { "itemSlug": "classic", "qty": 2, "options": { "sauce": "bbq", "burgerExtras": ["bacon"] }, "remove": ["pickles", "onion"], "note": "Well done" }
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

A meal deal line adds `parts`, with `options` and `remove` applying to the main dish:

```json
{ "itemSlug": "smash-menu", "qty": 1, "parts": { "burger": "double", "side": "rings", "drink": "cola" }, "options": { "sauce": "bbq" }, "remove": ["pickles"] }
```

Orders store each deal's `parts: [{ group, itemSlug, name, price }]`. Missing or unknown parts return 400 `missing_part` or `unknown_part`.

For a scheduled order, use `"delivery": { "type": "scheduled", "at": "2026-10-27T19:30:00+01:00" }`. `at` can also be milliseconds since the epoch.

Each order in a response also includes `status` (`placed`, `accepted`, `preparing`, `ready`, `pickedup`, `delivered` or `cancelled`), `statusAt`, `timeline: [{ status, at, by, note }]`, `prepMinutes`, `travelMinutes`, `cancelReason`, `courier: { name, vehicle, assigned }`, `customerName`, `track: { remaining, frac, scheduled }`, `serverNow`, `simMinuteMs` and `demoSpeed`.

### Partner (partner role, own restaurant only)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/partner/orders` | | `{ restaurant, autopilot, active, done, today }`. Also marks the restaurant as online for the autopilot |
| POST | `/partner/orders/:id/accept` | `{ prepMinutes: 5-90 }` | placed → accepted |
| POST | `/partner/orders/:id/preparing` | | accepted → preparing |
| POST | `/partner/orders/:id/ready` | | accepted or preparing → ready |
| POST | `/partner/orders/:id/reject` | `{ reason }` | Cancels until the courier has picked it up |
| GET | `/partner/menu` | | Every dish with `soldOut` |
| PATCH | `/partner/menu/:itemSlug` | `{ soldOut }` | |
| PATCH | `/partner/restaurant` | `{ paused }` | Pause or resume new orders |
| GET | `/partner/reviews` | `?page=1&filter=all|unanswered` | Visible reviews, 20 per page |
| PUT | `/partner/reviews/:id/reply` | `{ text }` | Public reply; an empty text removes it |

Another restaurant's orders and reviews return 404.

### Courier (courier role)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/courier/deliveries` | | `{ available, current, today: { deliveries, pay, tips, earnings, list } }`. Available ones hide the street address |
| POST | `/courier/deliveries/:id/accept` | | 409 `delivery_taken` if someone was faster, 400 `courier_busy` with a delivery in progress |
| POST | `/courier/deliveries/:id/pickedup` | | Only once the restaurant marked it ready (400 `not_ready`) |
| POST | `/courier/deliveries/:id/delivered` | | Only after pickup |

### Admin (admin role only)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/admin/overview` | | Today's figures, yesterday by the same time, 14 days per day, top dishes and restaurants, live orders by status |
| GET, PUT | `/admin/settings` | `{ autopilot }` | The demo autopilot |
| GET | `/admin/restaurants` | | Every restaurant with its settings and today's order count |
| POST | `/admin/restaurants` | `{ name, deliveryFee, minOrder, eta, hours, ... }` | The slug comes from the name |
| PATCH | `/admin/restaurants/:slug` | any restaurant field, `paused` | Hours are `[{ open, close }]` in minutes after midnight; `close` past 1440 means after midnight |
| GET | `/admin/restaurants/:slug/menu` | | The full menu |
| POST | `/admin/restaurants/:slug/items` | `{ category, name, price, kind, description?, tags?, allergens?, ingredients?, optionGroups?, deal?, popular?, soldOut? }` | |
| PATCH | `/admin/restaurants/:slug/items/:itemSlug` | any of the above | Moving `category` moves the dish |
| DELETE | `/admin/restaurants/:slug/items/:itemSlug` | | 409 `in_deal` while a meal deal uses it |
| GET | `/admin/orders` | `?status=all|active|<status>&restaurant=&from=YYYY-MM-DD&to=&q=&page=` | 25 per page, with the total and revenue of the match |
| GET | `/admin/orders/:id` | | Adds the customer's and courier's email |
| POST | `/admin/orders/:id/status` | `{ status, reason? }` | Any status; cancelling needs a reason |
| GET | `/admin/users` | `?q=&role=all|staff|<role>&page=` | |
| POST | `/admin/users` | `{ name, email, password, role, restaurant?, vehicle? }` | Creates a staff account |
| PATCH | `/admin/users/:id` | `{ role?, restaurant?, vehicle?, disabled? }` | Partners need a restaurant |
| GET | `/admin/reviews` | `?restaurant=&show=all|visible|hidden|low&q=&page=` | |
| PATCH | `/admin/reviews/:id` | `{ hidden }` | Recalculates the rating |
| GET | `/admin/promos` | | With `uses`, `discountGiven` and `lastUsed` |
| POST | `/admin/promos` | `{ code, type: percent|fixed|delivery, value, maxDiscount?, minSubtotal?, firstOrderOnly?, active?, description? }` | |
| PATCH | `/admin/promos/:id` | any field but `code` | |
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

Only the baskets (one per restaurant, with any promo code waiting to be applied) and dismissed banners are kept in `localStorage`. Accounts, addresses, favourites, orders, reviews, promo codes and settings all live in MongoDB.
