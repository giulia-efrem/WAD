# Morning report: design polish

Started at 07:48 and finished at 08:27, well inside the 3-hour limit. I got through every page on the list, then did a second round on loading states, focus rings, dialogs, toasts and the staff screens.

- **Undoing changes.** There is one commit before the work starts (`699a914`, the before screenshots) and one after each page, so any change can be undone with `git revert`.
- **Unchanged.** No data, layout or features changed. The name, logo, colours and font are the same. I didn't run the photo script and made no Unsplash requests.
- **Screenshots.**
  - `screenshots/before` and `screenshots/after` hold 375px and 1440px shots in light mode for every page, plus dark mode for home and the restaurant page, as you asked. The file names match, so you can compare them in pairs.
  - The main `screenshots/` folder is regenerated too, with all widths and both themes.
- **Tests.** All suites still pass:
  - API: 222/222
  - Customer browser test: 51/51
  - Roles browser test: 73/73
  - Demo-login browser test: 18/18
- **Demo data.** The demo data was reseeded at the end, so the database is back to clean demo data.

## Bugs found along the way

- **Courier's name.** The home page's live-order banner turned the courier's name into lower case ("Smash Society: dan is picking up your order").
- **Partner order cards.** The partner and admin order cards wrote "No american cheese". They now share the customer side's helper, which keeps proper names.
- **404 page.** The "404" label sat off-centre, about 150px to the left.
- **Dish window.** Option groups had no dividers and their spacing was upside down: less space above a group's title than below it. A fieldset's legend was hiding its top border.
- **Admin side menu.** It jumped 15px between long and short sections (Orders compared with Promo codes).
- **Photo credits page.** An extra line break left a blank line under every "Also used…" note.
- **First load.** The restaurant, account and checkout pages showed a blank screen while the app loaded. The home hero photo's loading placeholder was invisible.

## Improvements by page

**Everywhere**
- The header is now borderless at the top of the page and gains a soft edge and shadow once content scrolls under it. This works on the staff pages too, through one shared `public/js/topbar.js`.
- Long pages have a "back to top" button. It sits above the order bar when that is showing, and the footer leaves room for the bar only when it's there.
- All small controls share one short colour, border and shadow transition. Buttons, chips, hearts and cards now dip slightly when pressed. Hover effects that would get stuck on phones are limited to devices with a mouse. Reduced motion is still respected through the existing global rule.
- Paragraphs avoid single-word last lines, and short intro lines are balanced.
- Time ranges use an en dash (20–30 min).
- Panels, tiles and board columns now use the same 18px corner radius as cards. Before, they used a mix of 18px and 20px.
- Toasts have a soft shadow.

**Home**
- The "Closed now" overlay has a clear hierarchy: bold "Closed now", lighter "Opens at 10:00".
- Dark mode:
  - Photos are dimmed slightly. The white Healthy and Desserts circles and the pizza hero were glaring.
  - The pastel restaurant badges are toned down.
- On phones the header shows "Home" instead of "Home, 14 Linden …" cut off mid-word, and "Add address" instead of "Add delivery add…". The full address is still read out to screen readers.
- The loading skeleton now includes the hero photo and the cuisine circles.

**Restaurant page**
- Menu tabs now line up with the page's left edge; they were indented 14px.
- On phones the tab row fades at the right edge to show that it scrolls.
- The sticky tab bar carries the shadow, so it doesn't stack under the header's.
- When "Popular", "Save €2.50" or "Sold out" wraps to a new line, it starts at the left edge instead of 8px in.
- Dark mode: the pastel backgrounds behind dishes without a photo are toned down.
- A restaurant skeleton shows on first load.

**Dish window**
- Visible dividers between option groups, with more space above each group title than below it.

**Basket and checkout**
- Panel padding is even. The last option card no longer leaves an extra gap at the bottom of its panel, which was most visible under "Delivery address".
- The promo field placeholder reads "Enter code" instead of "ENTER CODE".
- Option cards show a focus ring when you move through them with the keyboard.
- Panels are slightly tighter on phones, and there's less empty space before the footer.

**Order tracking**
- On desktop the map stays in view while you scroll the order details.
- "Deliver to" no longer breaks onto two lines on phones.
- The browser tab now says "Your order from Bao & Broth · Morsel".

**Login**
- The fields have helpful placeholders.
- An invalid field gets a red focus ring instead of a red border with a purple glow.
- Disabled inputs look disabled.

**Account**
- The first tab lines up with the name and the list.
- "1×" stays on the same line as its dish name.

**Admin**
- On phones the four figure tiles sit two by two instead of in one tall column.
- Search placeholders fit their fields: "Search orders" and "Search reviews". The longer hint moved into a tooltip.
- The side menu no longer jumps between sections.
- "4.8 ★ (35)" no longer splits across lines in the restaurant list.

**Partner**
- Board column titles line up with the text under them.
- On phones the two counts sit side by side, with sales across the full width.
- The menu availability list is narrower on wide screens, so each dish sits close to its switch.

**Courier**
- Empty lists ("No deliveries waiting…") are a calm dashed placeholder instead of loose text.

**Footer pages**
- Headings sit closer to their own paragraph.
- The About page's tab title no longer reads "About Morsel · Morsel".

## Things I wasn't sure about (I picked the safer option)

- **Tabular numbers.** I tried them on option prices, but Schibsted Grotesk's tabular figures look letter-spaced ("+€2 . 50"). I left prices with normal figures. Prices are right-aligned, so they still line up.
- **Courier page order.** On a phone the earnings tiles come before the live delivery. Putting the current delivery first would be better for a courier on the move, but that's a layout change, so I left it.
- **Bottom sheets.** Phone bottom sheets have no drag handle. Adding one would suggest you can drag the sheet down when you can't, so I left it out.
- **Paused notice.** The "not taking orders" notice uses the same soft red as "closed". A neutral colour might feel less alarming, but I kept them consistent.
- **Admin tab row on phones.** A fade at the edge would also fade its blurred background, so I didn't add one.
- **Back-to-top button on phones.** It can briefly cover the right edge of a line, such as a review date, while you scroll. That's normal for a floating button, but you might prefer it only on desktop.

## Please check yourself

1. Dark mode on home and a restaurant page on your own screen: are the photos dimmed just enough, or too much?
2. Scroll the home and restaurant pages on a real phone: the header edge, the back-to-top button, and the tab fade.
3. Open a dish with options (Classic smash) and check the dividers and spacing between groups.
4. On /admin, switch between Orders and Promo codes and check that the side menu no longer moves.
5. Place an order and let it reach "ready" with a courier: the home banner should say "Dan is picking up your order" with a capital D.
6. 768px (tablet) wasn't part of the screenshots. I looked at home and checkout at that width and saw nothing wrong, but it's worth a glance.
