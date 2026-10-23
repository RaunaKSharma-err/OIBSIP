import * as payments from '../services/payment.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendOk } from '../utils/response';

export const createOrder = asyncHandler(async (req, res) => {
  sendOk(res, await payments.createPaymentOrder(req.user!, req.validated.body.orderId));
});

export const verify = asyncHandler(async (req, res) => {
  const result = await payments.verifyPayment(req.user!, req.validated.body);
  if (result.status === 'pending') {
    return void res.status(202).json({ success: true, data: { paymentStatus: 'pending', message: 'Payment is still being confirmed' } });
  }
  sendOk(res, { paymentStatus: 'paid', order: result.order });
});

/** `req.body` is a raw Buffer here (see app.ts); never mounted behind express.json. */
export const webhook = asyncHandler(async (req, res) => {
  const result = await payments.handleWebhook(
    Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
    req.header('X-Razorpay-Signature'),
    req.header('X-Razorpay-Event-Id'),
  );
  sendOk(res, { received: true, duplicate: result.duplicate });
});
