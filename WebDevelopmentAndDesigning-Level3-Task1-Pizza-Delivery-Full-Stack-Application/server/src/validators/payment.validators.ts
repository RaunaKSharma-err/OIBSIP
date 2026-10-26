import { z } from 'zod';
import { objectId } from './common';

export const initiatePaymentBody = z.object({ orderId: objectId }).strict();
/** `data` = the Base64 value eSewa appended to the success URL. It is untrusted until its signature is verified. */
export const verifyPaymentBody = z.object({ data: z.string().min(20).max(4000) }).strict();
export const paymentStatusQuery = z.object({ orderId: objectId });
