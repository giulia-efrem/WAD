'use strict';

/* Opening hours are [{ open, close }] in minutes after midnight, server local time.
   `close` may go past 1440 when a restaurant stays open after midnight. */

const minuteOfDay = (d = new Date()) => d.getHours() * 60 + d.getMinutes();

function isOpenAt(hours, m) {
  return (hours || []).some(({ open, close }) => (m >= open && m < close) || (close > 1440 && m < close - 1440));
}

const isOpenNow = (hours, now = new Date()) => isOpenAt(hours, minuteOfDay(now));

module.exports = { minuteOfDay, isOpenAt, isOpenNow };
