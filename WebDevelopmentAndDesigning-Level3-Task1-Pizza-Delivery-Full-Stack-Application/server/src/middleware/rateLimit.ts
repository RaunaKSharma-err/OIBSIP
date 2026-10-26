import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { ApiError } from '../utils/apiError';

const make = (windowMinutes: number, max: number) =>
  rateLimit({
    windowMs: windowMinutes * 60_000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => !env.RATE_LIMIT_ENABLED,
    handler: (_req, _res, next) => next(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.')),
  });

export const apiLimiter = make(15, 600);
export const loginLimiter = make(15, 20);
export const registerLimiter = make(60, 20);
export const passwordLimiter = make(60, 10); // forgot/reset/resend
export const paymentLimiter = make(15, 60);
