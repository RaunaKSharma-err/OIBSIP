import crypto from 'crypto';

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
export const sha256 = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex');
export const hmacSha256Hex = (secret: string, payload: string | Buffer) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Razorpay Checkout: HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret) */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  return safeEqual(hmacSha256Hex(secret, `${orderId}|${paymentId}`), signature);
}

/** Razorpay webhooks: HMAC_SHA256(raw request body, webhook_secret) in X-Razorpay-Signature */
export function verifyWebhookSignature(rawBody: Buffer, signature: string, secret: string): boolean {
  return safeEqual(hmacSha256Hex(secret, rawBody), signature);
}
