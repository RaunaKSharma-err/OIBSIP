import { apiClient } from '@/lib/api-client';
import { config } from '@/lib/config';
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  RazorpayOptions,
} from '@/types';

const MOCK_DELAY = 800;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(script);
  });
}

export const paymentService = {
  async createPayment(data: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      return {
        razorpayOrderId: `rzp_order_mock_${Date.now()}`,
        amount: data.amount,
        currency: 'INR',
        keyId: 'rzp_test_mock_key',
      };
    }
    return apiClient.post<CreatePaymentResponse>('/payments/create', data);
  },

  async verifyPayment(data: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    if (config.useMock) {
      await delay(MOCK_DELAY);
      return {
        verified: true,
        orderId: data.orderId,
        paymentStatus: 'paid',
      };
    }
    return apiClient.post<VerifyPaymentResponse>('/payments/verify', data);
  },

  async openCheckout(options: {
    razorpayOrderId: string;
    amount: number;
    keyId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
  }): Promise<{ razorpayPaymentId: string; razorpaySignature: string }> {
    await loadRazorpayScript();

    return new Promise((resolve, reject) => {
      const handlerOptions: RazorpayOptions = {
        key: options.keyId,
        amount: options.amount,
        currency: 'INR',
        name: 'Pizza Delivery',
        description: 'Order Payment',
        order_id: options.razorpayOrderId,
        prefill: {
          name: options.customerName,
          email: options.customerEmail,
          contact: options.customerPhone,
        },
        handler: (response) => {
          resolve({
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
        },
        modal: {
          ondismiss: () => {
            reject(new Error('Payment cancelled by user'));
          },
        },
        theme: {
          color: '#C62828',
        },
      };

      if (!window.Razorpay) {
        reject(new Error('Razorpay SDK not loaded'));
        return;
      }

      const rzp = new window.Razorpay(handlerOptions);
      rzp.open();
    });
  },
};
