'use strict';

const { badRequest } = require('../lib/httpError');

/* Parses req[part] with a zod schema and replaces it with the clean result.
   The first problem becomes a 400 with a readable message. */
const validate = (schema, part = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[part] == null ? {} : req[part]);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue.path.length ? ` (${issue.path.join('.')})` : '';
    const message = issue.message && !issue.message.startsWith('Invalid input') ? issue.message : `Invalid value${where}.`;
    return next(badRequest(message, 'validation_failed'));
  }
  if (part === 'body') req.body = result.data;
  else req.valid = Object.assign(req.valid || {}, { [part]: result.data });
  next();
};

module.exports = validate;
