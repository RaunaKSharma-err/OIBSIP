import Razorpay from 'razorpay';
import { env } from '../config/env';
import { ApiError } from './apiError';

let client: Razorpay | null = null;
function getClient(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new ApiError(503, 'PAYMENT_NOT_CONFIGURED', 'The payment gateway is not configured');
  }
  if (!client) client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return client;
}

export interface GatewayOrder {
  id: string;
  amount: number | string;
  currency: string;
}
export interface GatewayPayment {
  id: string;
  order_id: string;
  amount: number | string;
  currency: string;
  status: string;
}

/** Thin wrapper so tests can mock the network boundary. */
export const razorpayGateway = {
  async createOrder(params: {
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<GatewayOrder> {
    return (await getClient().orders.create(params)) as unknown as GatewayOrder;
  },
  async fetchPayment(paymentId: string): Promise<GatewayPayment> {
    return (await getClient().payments.fetch(paymentId)) as unknown as GatewayPayment;
  },
};
