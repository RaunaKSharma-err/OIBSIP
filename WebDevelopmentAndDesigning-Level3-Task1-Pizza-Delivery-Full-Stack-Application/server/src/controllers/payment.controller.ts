import type { Response } from 'express';
import * as payments from '../services/payment.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendOk } from '../utils/response';

/** paid / failed are final answers (200); anything unresolved is 202 so clients know to retry or poll. */
const sendResult = (res: Response, r: Awaited<ReturnType<typeof payments.verifyRedirect>>) =>
  res.status(r.paymentStatus === 'paid' || r.paymentStatus === 'failed' ? 200 : 202).json({ success: true, data: r });

export const initiate = asyncHandler(async (req, res) => {
  sendOk(res, await payments.initiatePayment(req.user!, req.validated.body.orderId));
});
export const verify = asyncHandler(async (req, res) => {
  sendResult(res, await payments.verifyRedirect(req.user!, req.validated.body.data));
});
export const status = asyncHandler(async (req, res) => {
  sendResult(res, await payments.getPaymentStatus(req.user!, req.validated.query.orderId));
});
