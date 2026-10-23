import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { ApiError } from '../utils/apiError';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    const out: Record<string, unknown> = {};
    const details: Array<{ location: string; path: string; message: string }> = [];
    for (const key of ['body', 'query', 'params'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(key === 'body' ? (req.body ?? {}) : req[key]);
      if (result.success) out[key] = result.data;
      else
        for (const issue of result.error.issues) {
          details.push({ location: key, path: issue.path.join('.'), message: issue.message });
        }
    }
    if (details.length) return next(ApiError.validation(details));
    req.validated = { ...(req.validated ?? {}), ...out };
    next();
  };
