import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const flag = (def: boolean) =>
  z.enum(['true', 'false']).default(def ? 'true' : 'false').transform((v) => v === 'true');
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    MONGO_TRANSACTIONS: z.enum(['auto', 'off']).default('auto'),
    FRONTEND_URL: z.string().url().default('http://localhost:5173'),
    CORS_ORIGINS: z.string().default(''),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
    COOKIE_SECURE: flag(false),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

    RAZORPAY_KEY_ID: optional,
    RAZORPAY_KEY_SECRET: optional,
    RAZORPAY_WEBHOOK_SECRET: optional,

    SMTP_HOST: optional,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: optional,
    SMTP_PASS: optional,
    EMAIL_FROM: z.string().default('Pizza Delivery <no-reply@example.com>'),

    ADMIN_EMAIL: optional,
    LOW_STOCK_ALERT_ENABLED: flag(true),
    LOW_STOCK_CHECK_SCHEDULE: z.string().default('*/15 * * * *'),
    ENABLE_SCHEDULER: flag(true),

    RESERVATION_MINUTES: z.coerce.number().int().min(1).max(240).default(15),
    DELIVERY_FEE_PAISE: z.coerce.number().int().min(0).default(4000),
    FREE_DELIVERY_ABOVE_PAISE: z.coerce.number().int().min(0).default(0),

    RATE_LIMIT_ENABLED: flag(true),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV !== 'production') return;
    const need: Array<[keyof typeof e, string]> = [
      ['RAZORPAY_KEY_ID', 'required in production'],
      ['RAZORPAY_KEY_SECRET', 'required in production'],
      ['RAZORPAY_WEBHOOK_SECRET', 'required in production'],
      ['SMTP_HOST', 'required in production'],
      ['SMTP_USER', 'required in production'],
      ['SMTP_PASS', 'required in production'],
      ['ADMIN_EMAIL', 'required in production (low-stock alert recipient)'],
    ];
    for (const [key, msg] of need) {
      if (!e[key]) ctx.addIssue({ code: 'custom', path: [key], message: msg });
    }
    if (!e.COOKIE_SECURE) {
      ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'must be true in production' });
    }
  });

function load() {
  const parsed = schema.safeParse(process.env);
  if (parsed.success) return parsed.data;
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  const message = `Invalid environment configuration:\n${lines.join('\n')}\nSee backend/.env.example`;
  if (process.env.NODE_ENV === 'test') throw new Error(message);
  console.error(message);
  process.exit(1);
}

export const env = load();
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const corsOrigins: string[] = Array.from(
  new Set(
    [env.FRONTEND_URL, ...env.CORS_ORIGINS.split(',')]
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean),
  ),
);
export const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
