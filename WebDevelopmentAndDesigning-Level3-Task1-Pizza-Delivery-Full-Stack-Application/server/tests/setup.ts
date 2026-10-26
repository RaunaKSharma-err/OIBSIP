// Runs before every test file: deterministic, isolated configuration (never uses a real .env secret).
Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/unused-in-tests',
  MONGO_TRANSACTIONS: 'off', // memory server is standalone; exercises the conditional-update fallback
  JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-123456',
  BCRYPT_ROUNDS: '4',
  RATE_LIMIT_ENABLED: 'false',
  ESEWA_ENVIRONMENT: 'test',
  ESEWA_PRODUCT_CODE: 'EPAYTEST',
  ESEWA_SECRET_KEY: '8gBm/:&EnhH.1/q',
  ESEWA_SUCCESS_URL: 'http://localhost:5173/payment/esewa/success',
  ESEWA_FAILURE_URL: 'http://localhost:5173/payment/esewa/failure',
  ADMIN_EMAIL: 'admin@example.test',
  SMTP_HOST: 'smtp.invalid',
  SMTP_USER: 'u',
  SMTP_PASS: 'p',
  FRONTEND_URL: 'http://localhost:5173',
  DELIVERY_FEE_PAISE: '4000',
  FREE_DELIVERY_ABOVE_PAISE: '0',
  RESERVATION_MINUTES: '15',
  LOW_STOCK_ALERT_ENABLED: 'true',
});
