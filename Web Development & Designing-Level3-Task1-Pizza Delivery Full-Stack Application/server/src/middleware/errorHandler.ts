import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { isProd } from '../config/env';
import { ApiError } from '../utils/apiError';
import { logger } from '../utils/logger';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.path} not found`, 'ROUTE_NOT_FOUND'));
};

function toApiError(err: any): ApiError | null {
  if (err instanceof ApiError) return err;
  if (err instanceof ZodError) {
    return ApiError.validation(err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return ApiError.validation(Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })));
  }
  if (err instanceof mongoose.Error.CastError) return ApiError.badRequest('INVALID_ID', `Invalid value for ${err.path}`);
  if (err?.code === 11000) {
    return ApiError.conflict('DUPLICATE_KEY', 'A record with the same unique value already exists');
  }
  if (err?.type === 'entity.too.large') return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  if (err?.type === 'entity.parse.failed') return ApiError.badRequest('INVALID_JSON', 'Request body is not valid JSON');
  return null;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const known = toApiError(err);
  if (known) {
    if (known.status >= 500) logger.error('Request failed', { err, path: req.path, requestId: req.requestId });
    res.status(known.status).json({
      success: false,
      error: { code: known.code, message: known.message, ...(known.details ? { details: known.details } : {}) },
    });
    return;
  }
  logger.error('Unhandled error', { err, method: req.method, path: req.path, requestId: req.requestId });
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side',
      ...(isProd ? {} : { details: { message: err?.message } }),
    },
  });
};
