import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const TEST_SECRET = '8gBm/:&EnhH.1/q'; // public eSewa UAT secret, only used to refuse it in production
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

    PAYMENT_PROVIDER: z.enum(['esewa']).default('esewa'),
    ESEWA_ENVIRONMENT: z.enum(['test', 'production']).default('test'),
    ESEWA_PRODUCT_CODE: optional,
    ESEWA_SECRET_KEY: optional,
    ESEWA_PAYMENT_URL: optional,
    ESEWA_STATUS_URL: optional,
    ESEWA_SUCCESS_URL: optional,
    ESEWA_FAILURE_URL: optional,
    ESEWA_STATUS_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),

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
      ['ESEWA_SECRET_KEY', 'required in production'],
      ['SMTP_HOST', 'required in production'],
      ['SMTP_USER', 'required in production'],
      ['SMTP_PASS', 'required in production'],
      ['ADMIN_EMAIL', 'required in production (low-stock alert recipient)'],
    ];
    for (const [key, msg] of need) {
      if (!e[key]) ctx.addIssue({ code: 'custom', path: [key], message: msg });
    }
    if (e.ESEWA_ENVIRONMENT === 'production') {
      if (!e.ESEWA_PRODUCT_CODE || e.ESEWA_PRODUCT_CODE === 'EPAYTEST') {
        ctx.addIssue({ code: 'custom', path: ['ESEWA_PRODUCT_CODE'], message: 'a real merchant code is required for ESEWA_ENVIRONMENT=production' });
      }
      if (e.ESEWA_SECRET_KEY === TEST_SECRET) {
        ctx.addIssue({ code: 'custom', path: ['ESEWA_SECRET_KEY'], message: 'the public test secret must not be used with ESEWA_ENVIRONMENT=production' });
      }
      for (const k of ['ESEWA_SUCCESS_URL', 'ESEWA_FAILURE_URL'] as const) {
        if (!e[k]?.startsWith('https://')) ctx.addIssue({ code: 'custom', path: [k], message: 'must be a public https URL in production' });
      }
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

const isEsewaTest = env.ESEWA_ENVIRONMENT === 'test';
const trimSlash = (u: string) => u.replace(/\/+$/, '');
/** eSewa ePay V2 settings (derived). Success/failure URLs are bases: the backend appends `/<orderId>`. */
export const esewa = {
  environment: env.ESEWA_ENVIRONMENT,
  productCode: env.ESEWA_PRODUCT_CODE ?? (isEsewaTest ? 'EPAYTEST' : undefined),
  secretKey: env.ESEWA_SECRET_KEY,
  paymentUrl:
    env.ESEWA_PAYMENT_URL ??
    (isEsewaTest ? 'https://rc-epay.esewa.com.np/api/epay/main/v2/form' : 'https://epay.esewa.com.np/api/epay/main/v2/form'),
  statusUrl:
    env.ESEWA_STATUS_URL ??
    (isEsewaTest ? 'https://rc.esewa.com.np/api/epay/transaction/status/' : 'https://epay.esewa.com.np/api/epay/transaction/status/'),
  successUrl: trimSlash(env.ESEWA_SUCCESS_URL ?? `${env.FRONTEND_URL}/payment/esewa/success`),
  failureUrl: trimSlash(env.ESEWA_FAILURE_URL ?? `${env.FRONTEND_URL}/payment/esewa/failure`),
  timeoutMs: env.ESEWA_STATUS_TIMEOUT_MS,
  get configured() {
    return Boolean(this.productCode && this.secretKey);
  },
};
