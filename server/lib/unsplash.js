'use strict';

/* Server-side Unsplash client. The access key never reaches the browser.
   Follows https://unsplash.com/documentation and the API guidelines:
   - photos are hotlinked from photo.urls (we store urls.raw and add size parameters later)
   - choosing a photo triggers photo.links.download_location once
   - X-Ratelimit-Remaining is read on every response; nothing is ever retried automatically */

const config = require('../config');

const API = 'https://api.unsplash.com';
const HOUR = 3600000;
const UTM = 'utm_source=morsel&utm_medium=referral';

class UnsplashError extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status; }
}

/* Last values Unsplash reported. The limit is shared by every process using the key. */
const quota = { limit: null, remaining: null, seenAt: 0 };

function readQuota(res) {
  const limit = Number(res.headers.get('x-ratelimit-limit'));
  const remaining = Number(res.headers.get('x-ratelimit-remaining'));
  if (Number.isFinite(remaining) && res.headers.has('x-ratelimit-remaining')) {
    quota.limit = Number.isFinite(limit) ? limit : quota.limit;
    quota.remaining = remaining;
    quota.seenAt = Date.now();
  }
}

/* True when the last known remaining count (from this hour) is at or below `floor`. */
const lowOnRequests = (floor = 3) => quota.remaining != null && Date.now() - quota.seenAt < HOUR && quota.remaining <= floor;

async function call(url, { floor = 3 } = {}) {
  if (!config.unsplashKey) throw new UnsplashError('no_key', 'UNSPLASH_ACCESS_KEY is not set in .env.', 503);
  if (lowOnRequests(floor)) {
    throw new UnsplashError('rate_limited', `Only ${quota.remaining} Unsplash requests are left this hour. Try again later.`, 429);
  }
  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Client-ID ${config.unsplashKey}`, 'Accept-Version': 'v1' },
      signal: AbortSignal.timeout(15000)
    });
  } catch (err) {
    throw new UnsplashError('network', `Couldn’t reach Unsplash: ${err.message}`, 502);
  }
  readQuota(res);
  if (res.ok) return res.json();
  let detail = '';
  try { const body = await res.json(); detail = (body.errors || []).join(' '); } catch (e) { /* not JSON, e.g. “Rate Limit Exceeded” */ }
  if (res.status === 403 && (quota.remaining === 0 || /rate limit/i.test(detail))) {
    quota.remaining = 0; quota.seenAt = Date.now();
    throw new UnsplashError('rate_limited', 'The Unsplash hourly limit has been reached. Try again later.', 429);
  }
  if (res.status === 401) throw new UnsplashError('bad_key', 'Unsplash rejected the access key (401). Check UNSPLASH_ACCESS_KEY.', 502);
  throw new UnsplashError('http_error', `Unsplash returned ${res.status}${detail ? `: ${detail}` : ''}.`, 502);
}

/* The fields we keep for each photo. Enough to show it, credit it and trigger its download later. */
function toCandidate(p) {
  return {
    id: p.id,
    urls: { raw: p.urls.raw, regular: p.urls.regular, small: p.urls.small, thumb: p.urls.thumb },
    color: p.color || null,
    blur_hash: p.blur_hash || null,
    alt_description: p.alt_description || '',
    description: p.description || '',
    tags: (p.tags || []).map(t => t.title).filter(Boolean),
    width: p.width,
    height: p.height,
    user: { name: p.user.name, username: p.user.username, profile: p.user.links.html },
    page: p.links.html,
    download_location: p.links.download_location
  };
}

async function searchPhotos(query, { orientation, perPage = 15, floor } = {}) {
  const params = new URLSearchParams({ query, per_page: String(perPage), content_filter: 'high' });
  if (orientation) params.set('orientation', orientation);
  const data = await call(`${API}/search/photos?${params}`, { floor });
  return { total: data.total, results: (data.results || []).map(toCandidate) };
}

/* Only ever calls Unsplash's own download endpoint, whatever is stored in a file. */
function checkDownloadLocation(url) {
  let u;
  try { u = new URL(url); } catch (e) { return false; }
  return u.protocol === 'https:' && u.hostname === 'api.unsplash.com' && /^\/photos\/[\w-]+\/download$/.test(u.pathname);
}

/* The “download” event the guidelines require when a photo is chosen. */
async function trackDownload(downloadLocation, { floor } = {}) {
  if (!checkDownloadLocation(downloadLocation)) throw new UnsplashError('invalid_download_location', 'That photo has no valid Unsplash download link.', 400);
  await call(downloadLocation, { floor });
}

const withUtm = url => url + (url.includes('?') ? '&' : '?') + UTM;

module.exports = { UnsplashError, quota, lowOnRequests, searchPhotos, trackDownload, toCandidate, withUtm, UTM };
