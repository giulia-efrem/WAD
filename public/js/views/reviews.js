import { $, esc, initials, plural } from '../util.js';
import { ic } from '../art.js';
import { api } from '../api.js';
import { state, R } from '../state.js';

/* The Reviews section of a restaurant page: summary, 5-to-1 breakdown, sortable list. */

const starsHTML = (n, cls = '') => `<span class="stars-row ${cls}" aria-label="${n} out of 5 stars">${[1, 2, 3, 4, 5].map(i => `<span class="${i <= n ? 'on' : ''}">${ic('star', 'fill')}</span>`).join('')}</span>`;
const dateText = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function summaryHTML(s) {
  if (!s.count) return `<p class="muted">No reviews yet. Be the first after your order arrives.</p>`;
  const max = Math.max(...Object.values(s.breakdown), 1);
  return `<div class="rv-summary">
    <div class="rv-score"><strong>${s.average.toFixed(1)}</strong>${starsHTML(Math.round(s.average), 'lg')}<span class="muted">${plural(s.count, 'rating', 'ratings')}</span>
      ${s.deliveryUpShare != null ? `<span class="rv-delivery">${ic('thumb')} ${s.deliveryUpShare}% liked the delivery</span>` : ''}</div>
    <ul class="rv-bars" aria-label="Ratings breakdown">${[5, 4, 3, 2, 1].map(n => `
      <li><span class="rv-bar-label">${n} ${ic('star', 'fill')}</span><span class="rv-bar"><i style="width:${Math.round(s.breakdown[n] / max * 100)}%"></i></span><span class="rv-bar-count">${s.breakdown[n]}</span></li>`).join('')}
    </ul>
  </div>`;
}

const reviewHTML = r => `<li class="review">
  <span class="avatar rv-avatar" aria-hidden="true">${esc(initials(r.author))}</span>
  <div class="review-body">
    <div class="review-top"><strong>${esc(r.author)}${r.mine ? ' <span class="default-tag">You</span>' : ''}</strong><span class="muted">${dateText(r.createdAt)}</span></div>
    <div class="review-rating">${starsHTML(r.food)}<span class="rv-thumb ${r.delivery}">${ic('thumb', r.delivery === 'down' ? 'flip' : '')}<span>Delivery</span></span></div>
    ${r.ordered ? `<p class="review-ordered">Ordered ${esc(r.ordered)}</p>` : ''}
    ${r.comment ? `<p class="review-comment">${esc(r.comment)}</p>` : ''}
    ${r.reply ? `<div class="review-reply"><p class="reply-head"><strong>Reply from ${esc((R(state.params.id) || {}).name || 'the restaurant')}</strong><span class="muted">${dateText(r.reply.at)}</span></p><p>${esc(r.reply.text)}</p></div>` : ''}
  </div>
</li>`;

/* The summary is always fresh, so it also corrects the rating shown in the header and on cards. */
function syncRating(slug, s) {
  const r = R(slug);
  if (r) { r.rating = s.average; r.reviewCount = s.count; }
  const head = document.querySelector('.r-facts li:first-child');
  if (head) {
    const a = head.querySelector('.rating');
    if (a) a.innerHTML = `${ic('star', 'fill')}${s.average.toFixed(1)}`;
    const small = head.querySelector('small');
    if (small) small.textContent = `(${s.count.toLocaleString('en-GB')} ${s.count === 1 ? 'rating' : 'ratings'})`;
  }
}

export async function renderReviews(slug, box, sort = 'newest') {
  if (!box) return;
  let page = 1;
  box.innerHTML = '<div class="sk sk-item" aria-hidden="true"></div>';
  let data;
  try { data = await api.reviews(slug, sort, page); }
  catch (err) { box.innerHTML = `<p class="muted">${esc(err.message)}</p>`; return; }
  if (!box.isConnected || state.view !== 'restaurant' || state.params.id !== slug) return;
  syncRating(slug, data.summary);
  box.innerHTML = `${summaryHTML(data.summary)}
    ${data.summary.count ? `<div class="rv-tools"><label class="select-wrap"><span class="visually-hidden">Sort reviews</span>
      <select id="rv-sort">
        <option value="newest" ${sort === 'newest' ? 'selected' : ''}>Newest first</option>
        <option value="highest" ${sort === 'highest' ? 'selected' : ''}>Highest rated</option>
        <option value="lowest" ${sort === 'lowest' ? 'selected' : ''}>Lowest rated</option>
      </select>${ic('chevron')}</label></div>` : ''}
    <ul class="review-list" id="review-list">${data.reviews.map(reviewHTML).join('')}</ul>
    ${data.hasMore ? '<button class="btn btn-secondary" type="button" id="rv-more">Show more reviews</button>' : ''}`;
  const select = $('#rv-sort', box);
  if (select) select.addEventListener('change', () => renderReviews(slug, box, select.value));
  const more = $('#rv-more', box);
  if (more) more.addEventListener('click', async () => {
    more.disabled = true;
    try {
      page += 1;
      const next = await api.reviews(slug, sort, page);
      $('#review-list', box).insertAdjacentHTML('beforeend', next.reviews.map(reviewHTML).join(''));
      if (next.hasMore) more.disabled = false; else more.remove();
    } catch (err) { more.disabled = false; }
  });
}

export { starsHTML };
