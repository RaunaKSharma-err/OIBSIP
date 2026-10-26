const env = import.meta.env;

export const config = {
  apiBaseUrl: env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  useMock: env.VITE_USE_MOCK === 'true',
  razorpayKeyId: env.VITE_RAZORPAY_KEY_ID || '',
  isDev: env.DEV ?? false,
} as const;
