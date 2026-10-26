'use strict';

const express = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { requireUser } = require('../middleware/auth');
const { publicMe } = require('./auth');
const { objectId } = require('../lib/schemas');
const { badRequest, notFound } = require('../lib/httpError');

const router = express.Router();
router.use(requireUser);

const MAX_ADDRESSES = 20;

const addressSchema = z.object({
  label: z.enum(['Home', 'Work', 'Other'], { error: 'Choose Home, Work or Other.' }),
  street: z.string({ error: 'Enter a street and number.' }).trim().min(3, 'Enter a street and number.').max(120, 'Use a shorter street.'),
  details: z.string().trim().max(120, 'Use shorter details.').optional().default(''),
  city: z.string({ error: 'Enter a city or district.' }).trim().min(2, 'Enter a city or district.').max(80, 'Use a shorter city.'),
  makeDefault: z.boolean().optional().default(false)
});
const idParams = z.object({ id: objectId('address') });

router.post('/', validate(addressSchema), async (req, res) => {
  const u = req.user;
  if (u.addresses.length >= MAX_ADDRESSES) throw badRequest(`You can save up to ${MAX_ADDRESSES} addresses. Delete one first.`, 'too_many_addresses');
  const { makeDefault, ...fields } = req.body;
  const isDefault = !u.addresses.length || makeDefault;
  if (isDefault) u.addresses.forEach(a => { a.isDefault = false; });
  u.addresses.push({ ...fields, isDefault });
  await u.save();
  const added = u.addresses[u.addresses.length - 1];
  res.status(201).json({ user: await publicMe(u), addressId: String(added._id) });
});

router.patch('/:id/default', validate(idParams, 'params'), async (req, res) => {
  const u = req.user;
  const { id } = req.valid.params;
  if (!u.addresses.id(id)) throw notFound('We couldn’t find that address.');
  u.addresses.forEach(a => { a.isDefault = String(a._id) === id; });
  await u.save();
  res.json({ user: await publicMe(u) });
});

router.delete('/:id', validate(idParams, 'params'), async (req, res) => {
  const u = req.user;
  const { id } = req.valid.params;
  const addr = u.addresses.id(id);
  if (!addr) throw notFound('We couldn’t find that address.');
  const wasDefault = addr.isDefault;
  addr.deleteOne();
  if (wasDefault && u.addresses[0]) u.addresses[0].isDefault = true;
  await u.save();
  res.json({ user: await publicMe(u) });
});

module.exports = router;
