# Where the "finalize Morsel" work stopped

Stopped on 27 October at 11:37, at your request, so the site can be presented. Everything below
"Done" is committed and tested. Nothing half-finished is switched on in the app.

## How to run it

- `npm run dev`, then open http://localhost:3000. Demo mode is on, so the login window has one-click demo accounts.
- `npm test` runs the 35 API tests. `npm run test:e2e` runs the browser tests in Microsoft Edge.
  `npm run test:all` runs both. All tests use their own `morsel_test` database, copies of the
  photo files and their own uploads folder, so they never touch your data.
- Last full run: 68 of 68 passed. The browser tests also include the older suites' inner checks:
  18 demo-login, 51 ordering and 73 roles checks.

## Done

**Before Part 1**
- Removed the old test data from your database: Test Kitchen, 3 test accounts, their 14 orders, 1 review and 2 TEST promo codes.
- `npm run remove-test-data` does it again; add `-- --dry-run` to preview.

**Part 1 (login bug): done**
- The cause: after logging out on /partner or /courier, the 4-second refresh kept running. Each refresh found the session gone and redrew the login form, emptying the fields every few seconds.
- Staff logout now reloads the page. Refresh loops stop when a session ends.
- A regression test, `test/e2e/login-logout.test.js`, also covers every way in and out.
- Every page now has a real address: /r/forno-sette, /checkout/…, /order/…, /orders, /account, /search?q=…. Old `/#r-…` links still work.

**Part 2 (everything works): mostly done**
- **Search:** accents and capitals ignored, small typos allowed, dietary words understood ("veggie", "gf", "plant based").
- **Suggestions:** they appear as you type and work with the keyboard.
- **Results page:** /search shows restaurants and dishes, with a friendly empty state. A dish result opens its restaurant with the dish window open (`?dish=`).
- **Menu search:** each restaurant's menu has its own search field.
- **Home filters:** Vegetarian, Vegan and Gluten-free filters; cards show "12 vegan dishes".
- **Tests:** `test/e2e/customer-flows.test.js` covers search, filters, favourites, addresses, promo codes and reorder.

**Part 4 (design): partly done**
- The home page layout from earlier is in place.
- Phones have a bottom bar with Home, Search, Orders and Account. It's hidden at checkout and on receipts.

**Part 5 (complete): done**
- **Forgot password:** a link that works once, for 30 minutes. It's shown on screen in demo mode only.
- **Restaurant info:** an "Info and allergens" window with the address, the week's hours (today marked), delivery terms and the allergens the kitchen handles.
- **Receipt:** at /receipt/ID with a print button, linked from each order.
- **Help centre:** an FAQ and a contact form. Messages appear in a new **Messages** section of the admin dashboard, with an unread count.
- **Cookie notice:** essential cookies only. The Privacy page has a Cookies section.
- **`npm test`:** API tests for the main flows.

## Not finished: continue here

1. **Part 2, the click-everything sweep** (`npm run test:sweep`, file `test/slow/sweep.test.js`).
   - Every page and button passed for guests and customers, at 1440px and for guests at 375px.
   - The staff pages at 1440px failed. I stopped before reading why: the reason prints at the end of the run.
   - It takes about 25 minutes, so it isn't part of `test:e2e`.
2. **Part 3, photos.**
   - **Script:** `npm run photos` was stopped while paused for the rate limit and picks up where it left off. 78 of 157 items have photos: all 9 covers and 69 dishes. Drinks and simple sides use text cards by design. About 70 dishes are left, roughly 3.5 hours at 40 requests an hour.
   - **Review:** I checked all 78 current photos. None is used twice.
   - **Swaps:** none have been made yet. Each one triggers one Unsplash download event, as the API guidelines require. My picks from the saved candidates:
     - **Cannoli** (bottle label in shot): candidate 3, `RXlvf9wR60U`.
     - **Chicken tenders** (Coca-Cola can): candidate 5, `iGQRdE2WSVI`.
     - **Skillet cookie** (looks like a tart): candidate 1, `zDRjMwIX8jk`.
     - **Fried chicken bao** (Red Bull can): candidate 5, `KXUiorQdIkI`.
     - **Still to decide:** Teriyaki chicken (a hand in shot), Ginger shot (raw ginger, not a drink), Al pastor tacos (bottle label), Birria tacos (sticker with a face) and Matcha cheesecake (cluttered).
     - **Can't fix without a new search:** Mushroom melt has only one saved candidate.
   - **Also left:** the consistency check of crops, sizes and text cards.
3. **Part 4:** the consistency pass across every page at 375, 768 and 1440px in light and dark mode.
4. **Part 6:** final screenshots, README.md and FINAL-REPORT.md.
   - `npm run screenshots` should first move onto its own test server: today it creates a temporary order in your real database.
5. **Known flakiness:** in earlier runs three browser tests each failed once and then passed: reorder, the admin demo button and logging in after logging out. Worth a look.
