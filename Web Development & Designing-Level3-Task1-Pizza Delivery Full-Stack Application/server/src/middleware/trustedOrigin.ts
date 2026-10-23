import type { RequestHandler } from 'express';
import { corsOrigins } from '../config/env';
import { ApiError } from '../utils/apiError';

/**
 * CSRF defence for cookie-authenticated endpoints (refresh/logout): browsers always send `Origin` on
 * cross-site POSTs, so reject any Origin outside the allowlist. Requests without Origin (curl, server-to-server)
 * pass, but they cannot ride a victim's cookie.
 */
export const requireTrustedOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.headers.origin;
  if (origin && !corsOrigins.includes(origin.replace(/\/$/, ''))) {
    return next(ApiError.forbidden('Origin not allowed', 'ORIGIN_NOT_ALLOWED'));
  }
  next();
};
