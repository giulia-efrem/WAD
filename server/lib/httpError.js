'use strict';

/* Every API error leaves the server as { error: { code, message } } with this status. */
class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const badRequest = (message, code = 'invalid_request') => new HttpError(400, code, message);
const unauthorized = (message = 'Your session has ended. Log in again.') => new HttpError(401, 'unauthorized', message);
const forbidden = (message = 'You don’t have access to this.') => new HttpError(403, 'forbidden', message);
const notFound = (message = 'Not found.') => new HttpError(404, 'not_found', message);
const conflict = (message, code = 'conflict') => new HttpError(409, code, message);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict };
