'use strict';

const { z } = require('zod');

const objectId = (what = 'id') => z.string().regex(/^[a-f0-9]{24}$/i, `That ${what} isn’t valid.`);
const slug = z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, 'That isn’t a valid slug.');

module.exports = { objectId, slug };
