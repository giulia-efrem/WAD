'use strict';

const { HttpError } = require('../lib/httpError');

function notFoundApi(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: `No API route for ${req.method} ${req.originalUrl}.` } });
}

/* Single error format for the whole API: { error: { code, message } }. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500, code = 'server_error', message = 'Something went wrong on our side. Try again in a moment.';
  if (err instanceof HttpError) ({ status, code, message } = err);
  else if (err.type === 'entity.parse.failed') { status = 400; code = 'invalid_json'; message = 'The request body isn’t valid JSON.'; }
  else if (err.type === 'entity.too.large') { status = 413; code = 'too_large'; message = 'The request is too large.'; }
  else if (err.name === 'CastError') { status = 404; code = 'not_found'; message = 'Not found.'; }
  else if (err.code === 11000) { status = 409; code = 'conflict'; message = 'That already exists.'; }
  else if (err.name === 'ValidationError') { status = 400; code = 'validation_failed'; message = Object.values(err.errors)[0].message; }
  if (status >= 500) console.error(err);
  if (res.headersSent) return;
  res.status(status).json({ error: { code, message } });
}

module.exports = { notFoundApi, errorHandler };
