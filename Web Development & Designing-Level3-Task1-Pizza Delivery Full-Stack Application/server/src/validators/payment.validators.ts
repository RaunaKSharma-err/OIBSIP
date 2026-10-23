import { z } from 'zod';
import { objectId } from './common';

export const createPaymentOrderBody = z.object({ orderId: objectId }).strict();
export const verifyPaymentBody = z
  .object({
    orderId: objectId.optional(),
    razorpay_order_id: z.string().min(5).max(64),
    razorpay_payment_id: z.string().min(5).max(64),
    razorpay_signature: z.string().min(10).max(200),
  })
  .strict();

/** Minimal shape of Razorpay webhook payloads that we rely on. */
export const webhookPayload = z.object({
  event: z.string(),
  payload: z
    .object({
      payment: z
        .object({
          entity: z.object({
            id: z.string(),
            order_id: z.string().nullable().optional(),
            amount: z.number(),
            currency: z.string(),
            status: z.string().optional(),
            error_code: z.string().nullable().optional(),
            error_description: z.string().nullable().optional(),
          }),
        })
        .optional(),
    })
    .passthrough(),
});
