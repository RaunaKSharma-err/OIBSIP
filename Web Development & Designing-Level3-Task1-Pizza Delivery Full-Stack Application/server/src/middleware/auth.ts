import type { RequestHandler } from 'express';
import { User } from '../models/User';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyAccessToken } from '../utils/jwt';
import type { Role } from '../types';

/** Requires `Authorization: Bearer <access token>` and re-checks the user in the database. */
export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) throw ApiError.unauthorized();
  let payload;
  try {
    payload = verifyAccessToken(header.slice(7).trim());
  } catch {
    throw ApiError.unauthorized('Invalid or expired access token', 'TOKEN_INVALID');
  }
  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active' || user.tokenVersion !== payload.tv) {
    throw ApiError.unauthorized('Invalid or expired access token', 'TOKEN_INVALID');
  }
  req.user = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
  };
  next();
});

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };

export const requireVerifiedEmail: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!req.user.emailVerified) {
    return next(new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email address to continue'));
  }
  next();
};
