'use strict';

/* npm run photos [-- --max=N]
   Finds an Unsplash photo for every restaurant cover and for the mains, starters and desserts
   (drinks and sides use text-only cards, and meal deals show their main dish's photo), in this
   order: covers, popular dishes, then the rest. For each item it runs one search (the best 8 results are kept in
   seed/photo-candidates.json), picks a default, triggers that photo's download event and saves
   it to MongoDB and seed/images.json.

   Resumable: items that already have a photo are skipped, and saved search results are reused.
   Change a query in scripts/photo-queries.js and that item is searched again on the next run,
   unless you searched for it yourself at /admin/photos. Photos removed there are left empty.

   Rate limits: at most PHOTOS_PER_HOUR requests (default 40) in any rolling hour, and it pauses
   whenever Unsplash reports 10 or fewer requests left, so /admin/photos keeps some. It never
   retries in a loop: a rate-limit error waits for the next hour once, anything else stops the run. */

const fs = require('fs');
const path = require('path');
const config = require('../server/config');
const db = require('../server/db');
const Restaurant = require('../server/models/Restaurant');
const unsplash = require('../server/lib/unsplash');
const photos = require('../server/lib/photos');
const { rank, pickBest } = require('../server/lib/photoPick');
const QUERIES = require('./photo-queries');

const HOUR = 3600000;
const PER_HOUR = Number(process.env.PHOTOS_PER_HOUR || 40);
const KEEP_FREE = 10;
const SAVE = 8;
const SEARCH_SIZE = 15;
const USAGE_FILE = path.join(config.root, 'seed', '.unsplash-usage.json');
const maxArg = process.argv.find(a => a.startsWith('--max='));
const MAX_ITEMS = maxArg ? Number(maxArg.split('=')[1]) : Infinity;

const stamp = () => new Date().toLocaleTimeString('en-GB');
const log = msg => console.log(`[${stamp()}] ${msg}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Request budget (kept in a file so a restart within the hour still counts) ---------- */
const recent = () => photos.readJson(USAGE_FILE, []).filter(t => Date.now() - t < HOUR).sort((a, b) => a - b);
function nextHour() { const d = new Date(); d.setMinutes(61, 0, 0); return d.getTime(); }

async function waitUntil(at, why) {
  log(`Pausing until ${new Date(at).toLocaleTimeString('en-GB')}: ${why}`);
  await sleep(Math.max(0, at - Date.now()));
}
async function spend() {
  for (;;) {
    const times = recent();
    if (times.length >= PER_HOUR) { await waitUntil(times[0] + HOUR + 5000, `${PER_HOUR} requests used in the last hour`); continue; }
    if (unsplash.lowOnRequests(KEEP_FREE)) {
      await waitUntil(nextHour(), `Unsplash reports ${unsplash.quota.remaining} requests left, keeping ${KEEP_FREE} for the review page`);
      unsplash.quota.seenAt = 0;
      continue;
    }
    break;
  }
  photos.writeJson(USAGE_FILE, [...recent(), Date.now()]);
}

/* One Unsplash call, with a single wait for the next hour if the limit is hit. Never loops on errors. */
async function request(fn, label) {
  await spend();
  try {
    return await fn();
  } catch (err) {
    if (err.code !== 'rate_limited') throw err;
    await waitUntil(nextHour(), `rate limit reached during ${label}`);
    unsplash.quota.seenAt = 0;
    await spend();
    return fn();
  }
}

/* ---------- Work list ---------- */
const PHOTO_KINDS = ['main', 'starter', 'dessert'];

async function workList() {
  const list = await Restaurant.find().sort({ sortOrder: 1 });
  const covers = [], popular = [], rest = [];
  for (const r of list) {
    covers.push({ slug: r.slug, itemSlug: null, name: `${r.name} cover`, kind: 'cover', entity: r });
    for (const s of r.menu) for (const it of s.items) {
      if (!PHOTO_KINDS.includes(it.kind || 'main')) continue;
      (it.popular ? popular : rest).push({ slug: r.slug, itemSlug: it.slug, name: `${it.name} (${r.name})`, kind: 'dish', entity: it });
    }
  }
  return [...covers, ...popular, ...rest];
}

(async () => {
  if (!config.unsplashKey) { console.error('UNSPLASH_ACCESS_KEY is missing from .env.'); process.exit(1); }
  await db.connect();
  const items = await workList();
  const used = await photos.usedPhotoIds();
  const counts = { chosen: 0, skipped: 0, noMatch: 0 };
  let processed = 0;
  log(`${items.length} items, ${items.filter(i => i.entity.image).length} already have a photo. Budget ${PER_HOUR} requests per hour.`);

  try {
    for (const item of items) {
      const key = photos.keyOf(item.slug, item.itemSlug);
      const query = QUERIES[key];
      if (item.entity.image) { counts.skipped++; continue; }
      if (!query) { log(`No query for ${key} in scripts/photo-queries.js, skipped`); continue; }
      if (processed >= MAX_ITEMS) break;
      processed++;
      const ctx = { query, kind: item.kind };

      let saved = photos.readCandidates()[key];
      /* Removed at /admin/photos: leave it without a photo. */
      if (saved && saved.removed) { counts.skipped++; continue; }
      /* A search typed at /admin/photos (custom) wins over the query in photo-queries.js. */
      if (!saved || (saved.query !== query && !saved.custom)) {
        const orientation = item.kind === 'cover' ? 'landscape' : undefined;
        const found = await request(() => unsplash.searchPhotos(query, { orientation, perPage: SEARCH_SIZE, floor: KEEP_FREE }), `search for ${key}`);
        saved = { query, orientation: orientation || null, fetchedAt: new Date().toISOString(), total: found.total, candidates: rank(found.results, ctx).slice(0, SAVE) };
        photos.saveCandidates(key, saved);
        log(`Searched “${query}” for ${item.name}: ${found.total} results, kept ${saved.candidates.length}. ${unsplash.quota.remaining} requests left this hour.`);
      }

      const best = pickBest(saved.candidates, used, ctx);
      if (!best) { counts.noMatch++; log(`No suitable unused photo for ${item.name}. Pick one by hand at /admin/photos.`); continue; }

      await request(() => unsplash.trackDownload(best.download_location, { floor: KEEP_FREE }), `download event for ${key}`);
      await photos.applyPhoto(item.slug, item.itemSlug, photos.fieldsFromCandidate(best));
      used.set(best.id, key);
      counts.chosen++;
      log(`Chose ${best.id} by ${best.user.name} for ${item.name} (“${best.alt_description || 'no description'}”).`);
    }
  } catch (err) {
    log(`Stopped: ${err.message}`);
    log('Nothing was retried. Fix the problem if needed, then run npm run photos to continue where it stopped.');
    process.exitCode = 1;
  } finally {
    const all = await workList();
    const missing = all.filter(i => !i.entity.image).length;
    log(`Chose ${counts.chosen}, skipped ${counts.skipped} that had photos, ${counts.noMatch} without a suitable match. ${all.length - missing} of ${all.length} items now have a photo.`);
    if (missing && !process.exitCode) log(missing > counts.noMatch ? 'Run npm run photos again to continue.' : 'The rest need a photo chosen by hand at /admin/photos.');
    await db.disconnect();
  }
})();
