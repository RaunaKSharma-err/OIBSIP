import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { corsOrigins, env } from './config/env';
import { webhook } from './controllers/payment.controller';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimit';
import routes from './routes';
import { logger } from './utils/logger';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use((req, res, next) => {
    req.requestId = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    const started = Date.now();
    res.on('finish', () => {
      if (req.path !== '/api/health') {
        logger.info('request', { requestId: req.requestId, method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - started });
      }
    });
    next();
  });

  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // No Origin header = non-browser client (curl, Razorpay webhook): CORS does not apply.
        if (!origin || corsOrigins.includes(origin.replace(/\/$/, ''))) return cb(null, true);
        cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
      maxAge: 600,
    }),
  );

  // Razorpay signs the RAW body, so the webhook must be registered before any JSON parser.
  app.post('/api/payments/webhook', express.raw({ type: '*/*', limit: '256kb' }), webhook);

  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());
  app.use('/api', apiLimiter, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
