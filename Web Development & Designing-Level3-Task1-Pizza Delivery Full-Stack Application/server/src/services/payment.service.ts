import { env } from '../config/env';
import { Order, orderDto, type IOrder } from '../models/Order';
import { Payment } from '../models/Payment';
import { WebhookEvent } from '../models/WebhookEvent';
import type { AuthUser } from '../types';
import { ApiError } from '../utils/apiError';
import { sha256, verifyCheckoutSignature, verifyWebhookSignature } from '../utils/crypto';
import { logger } from '../utils/logger';
import { razorpayGateway } from '../utils/razorpay';
import { webhookPayload } from '../validators/payment.validators';
import { afterStockChange, releaseStock, reserveStock, withOptionalTransaction } from './inventory.service';
import { cancelUnpaidOrder } from './order.service';

const safeReason = (s?: string | null) => (s ? s.replace(/[^\w\s.,:;()'-]/g, '').slice(0, 200) : 'Payment failed');

/** Step 1 of checkout: create (or reuse) the Razorpay order for an unpaid order owned by the caller. */
export async function createPaymentOrder(user: AuthUser, orderId: string) {
  if (!env.RAZORPAY_KEY_ID) throw new ApiError(503, 'PAYMENT_NOT_CONFIGURED', 'The payment gateway is not configured');
  const order = await Order.findOne({ _id: orderId, user: user.id });
  if (!order) throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
  if (order.paymentStatus === 'paid') throw ApiError.conflict('ORDER_ALREADY_PAID', 'This order has already been paid');
  if (order.orderStatus !== 'pending_payment') {
    throw ApiError.conflict('ORDER_NOT_PAYABLE', `This order is ${order.orderStatus} and cannot be paid`);
  }
  if (order.inventory.reservedUntil.getTime() < Date.now()) {
    await cancelUnpaidOrder(orderId, 'PAYMENT_WINDOW_EXPIRED', { kind: 'system' });
    throw ApiError.conflict('ORDER_EXPIRED', 'The payment window for this order has expired. Please place the order again.');
  }

  // Browser refresh / retry after failure: reuse the same Razorpay order instead of creating a new one.
  let payment = await Payment.findOne({ order: order._id, status: { $in: ['created', 'failed'] } }).sort({ createdAt: -1 });
  if (!payment) {
    const rp = await razorpayGateway.createOrder({
      amount: order.total,
      currency: order.currency,
      receipt: order.orderNumber,
      notes: { orderId: String(order._id), orderNumber: order.orderNumber },
    });
    payment = await Payment.create({
      order: order._id,
      user: user.id,
      razorpayOrderId: rp.id,
      amount: order.total,
      currency: order.currency,
    });
    logger.info('Razorpay order created', { orderId: String(order._id), razorpayOrderId: rp.id });
  } else if (payment.status === 'failed') {
    await Payment.updateOne({ _id: payment._id, status: 'failed' }, { $set: { status: 'created' } });
    await Order.updateOne({ _id: order._id, paymentStatus: 'failed' }, { $set: { paymentStatus: 'pending' } });
  }
  return {
    keyId: env.RAZORPAY_KEY_ID,
    razorpayOrderId: payment.razorpayOrderId,
    amount: payment.amount,
    currency: payment.currency,
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    prefill: { name: user.name, email: user.email, contact: order.delivery.phone },
  };
}

/** Step 2: the browser reports Razorpay's result; we trust only the signature + gateway lookup. */
export async function verifyPayment(
  user: AuthUser,
  input: { orderId?: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
) {
  const secret = env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new ApiError(503, 'PAYMENT_NOT_CONFIGURED', 'The payment gateway is not configured');

  const payment = await Payment.findOne({ razorpayOrderId: input.razorpay_order_id });
  if (!payment || String(payment.user) !== user.id) throw ApiError.notFound('Payment not found', 'PAYMENT_NOT_FOUND');
  if (input.orderId && String(payment.order) !== input.orderId) {
    throw ApiError.badRequest('ORDER_MISMATCH', 'The payment does not belong to this order');
  }

  if (!verifyCheckoutSignature(input.razorpay_order_id, input.razorpay_payment_id, input.razorpay_signature, secret)) {
    await Payment.updateOne({ _id: payment._id, status: { $ne: 'paid' } }, { $set: { verificationStatus: 'failed' } });
    logger.warn('Payment signature verification failed', { paymentId: String(payment._id), userId: user.id });
    throw new ApiError(400, 'INVALID_SIGNATURE', 'Payment verification failed');
  }

  // Signature only proves the ids belong together; confirm amount/currency/status with Razorpay itself.
  const rp = await razorpayGateway.fetchPayment(input.razorpay_payment_id);
  if (rp.order_id !== payment.razorpayOrderId) {
    throw ApiError.badRequest('PAYMENT_ORDER_MISMATCH', 'The payment does not belong to this order');
  }
  if (rp.status === 'failed') {
    await recordFailure(payment.razorpayOrderId, 'Payment failed at the gateway');
    throw new ApiError(402, 'PAYMENT_FAILED', 'The payment failed. You can retry.');
  }
  if (rp.status !== 'captured') {
    return { status: 'pending' as const }; // authorized/created: the webhook (payment.captured) will finalise
  }
  const result = await finalizePayment({
    razorpayOrderId: payment.razorpayOrderId,
    razorpayPaymentId: input.razorpay_payment_id,
    amount: Number(rp.amount),
    currency: rp.currency,
    via: 'verify',
  });
  return { status: 'paid' as const, order: orderDto(result!.order) };
}

interface FinalizeArgs {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amount: number;
  currency: string;
  via: 'verify' | 'webhook';
}

/** Idempotent: safe to call any number of times, from verify and webhooks, in any order. */
export async function finalizePayment(a: FinalizeArgs) {
  const payment = await Payment.findOne({ razorpayOrderId: a.razorpayOrderId });
  if (!payment) return null;

  if (a.amount !== payment.amount || a.currency !== payment.currency) {
    await Payment.updateOne({ _id: payment._id, status: { $ne: 'paid' } }, { $set: { verificationStatus: 'failed', failureReason: 'AMOUNT_MISMATCH' } });
    logger.error('Payment amount/currency mismatch', { paymentId: String(payment._id), expected: payment.amount, got: a.amount });
    throw new ApiError(400, 'PAYMENT_AMOUNT_MISMATCH', 'Payment amount does not match the order total');
  }

  if (payment.status === 'paid') {
    if (payment.razorpayPaymentId && payment.razorpayPaymentId !== a.razorpayPaymentId) {
      throw ApiError.conflict('PAYMENT_ALREADY_RECORDED', 'A different payment has already been recorded for this order');
    }
  } else {
    try {
      await Payment.findOneAndUpdate(
        { _id: payment._id, status: { $ne: 'paid' } },
        {
          $set: {
            status: 'paid',
            razorpayPaymentId: a.razorpayPaymentId,
            verificationStatus: 'verified',
            paidAt: new Date(),
            confirmedVia: a.via,
          },
          $unset: { failureReason: 1 },
        },
      );
    } catch (err: any) {
      if (err?.code === 11000) throw ApiError.conflict('PAYMENT_ID_IN_USE', 'This payment id was already used');
      throw err;
    }
  }
  // Always (re)apply to the order: each step is conditional, so a crash between the two writes self-heals on retry.
  const order = await applyPaidToOrder(payment.order);
  logger.info('Payment confirmed', { paymentId: String(payment._id), orderId: String(payment.order), via: a.via });
  return { payment, order };
}

async function applyPaidToOrder(orderId: unknown): Promise<IOrder & { _id: any }> {
  const order = await Order.findById(orderId as any);
  if (!order) throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
  const now = new Date();

  if (order.orderStatus === 'pending_payment') {
    if (order.inventory.state !== 'reserved') {
      throw ApiError.conflict('PAYMENT_PROCESSING', 'The order is being updated; retry shortly'); // webhooks get 5xx => retried
    }
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, orderStatus: 'pending_payment', 'inventory.state': 'reserved' },
      {
        $set: { paymentStatus: 'paid', orderStatus: 'received', paidAt: now, 'inventory.state': 'committed' },
        $push: { statusHistory: { status: 'received', at: now, by: { kind: 'system' }, note: 'Payment confirmed' } },
      },
      { new: true },
    );
    return updated ?? (await applyPaidToOrder(orderId)); // lost a race (e.g. expiry): re-evaluate on fresh state
  }

  if (order.orderStatus === 'cancelled' && order.paymentStatus !== 'paid') {
    if (order.inventory.state === 'releasing') throw ApiError.conflict('PAYMENT_PROCESSING', 'The order is being updated; retry shortly');
    // Money arrived for an order we cancelled/expired. Try to honour it; otherwise flag a refund.
    if (order.inventory.state === 'released' && order.cancellation?.reason === 'PAYMENT_WINDOW_EXPIRED') {
      const cycle = order.inventory.cycle + 1;
      try {
        await withOptionalTransaction((s) => reserveStock(order._id, order.inventory.requirements, cycle, s));
        const revived = await Order.findOneAndUpdate(
          { _id: order._id, orderStatus: 'cancelled', 'inventory.state': 'released', 'inventory.cycle': order.inventory.cycle },
          {
            $set: { paymentStatus: 'paid', orderStatus: 'received', paidAt: now, 'inventory.state': 'committed', 'inventory.cycle': cycle },
            $unset: { cancellation: 1 },
            $push: { statusHistory: { status: 'received', at: now, by: { kind: 'system' }, note: 'Payment confirmed after reservation expiry; stock re-reserved' } },
          },
          { new: true },
        );
        if (revived) {
          await afterStockChange(order.inventory.requirements.map((r) => r.item));
          return revived;
        }
        await withOptionalTransaction((s) => releaseStock(order._id, order.inventory.requirements, cycle, s)); // raced; undo
        return applyPaidToOrder(orderId);
      } catch (err) {
        if (!(err instanceof ApiError) || err.code !== 'INSUFFICIENT_STOCK') throw err;
      }
    }
    const flagged = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: { $ne: 'paid' } },
      {
        $set: { paymentStatus: 'paid', paidAt: now, needsRefund: true },
        $push: { statusHistory: { status: 'cancelled', at: now, by: { kind: 'system' }, note: 'Payment received for a cancelled order; refund required' } },
      },
      { new: true },
    );
    logger.error('Payment received for cancelled order: manual refund required', { orderId: String(order._id) });
    return flagged ?? (await Order.findById(orderId as any))!;
  }
  return order; // already paid / progressed: idempotent no-op
}

async function recordFailure(razorpayOrderId: string, reason?: string | null) {
  const payment = await Payment.findOneAndUpdate(
    { razorpayOrderId, status: { $ne: 'paid' } },
    { $set: { status: 'failed', failedAt: new Date(), failureReason: safeReason(reason) }, $inc: { failedAttempts: 1 } },
    { new: true },
  );
  if (payment) {
    await Order.updateOne(
      { _id: payment.order, orderStatus: 'pending_payment', paymentStatus: { $ne: 'paid' } },
      { $set: { paymentStatus: 'failed' } },
    );
    logger.warn('Payment failed', { paymentId: String(payment._id), orderId: String(payment.order) });
  }
}

/**
 * Razorpay webhook. `rawBody` MUST be the unparsed request bytes (signature is computed over them).
 * Idempotent by (a) processing being idempotent and (b) recording the event id.
 */
export async function handleWebhook(rawBody: Buffer, signature: string | undefined, eventId: string | undefined) {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new ApiError(503, 'WEBHOOK_NOT_CONFIGURED', 'Webhook secret is not configured');
  if (!signature || !verifyWebhookSignature(rawBody, signature, secret)) {
    logger.warn('Webhook signature verification failed');
    throw new ApiError(400, 'INVALID_SIGNATURE', 'Invalid webhook signature');
  }
  let json: unknown;
  try {
    json = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw ApiError.badRequest('INVALID_JSON', 'Webhook body is not valid JSON');
  }
  const parsed = webhookPayload.safeParse(json);
  if (!parsed.success) return { processed: false, duplicate: false };
  const { event, payload } = parsed.data;
  const id = eventId || sha256(rawBody);

  if (await WebhookEvent.exists({ eventId: id })) return { processed: false, duplicate: true };

  const entity = payload.payment?.entity;
  if (entity?.order_id && (event === 'payment.captured' || event === 'order.paid')) {
    try {
      await finalizePayment({
        razorpayOrderId: entity.order_id,
        razorpayPaymentId: entity.id,
        amount: entity.amount,
        currency: entity.currency,
        via: 'webhook',
      });
    } catch (err) {
      // A permanent data problem must not trigger endless retries; transient errors (5xx) must.
      if (!(err instanceof ApiError) || err.status >= 500 || err.code === 'PAYMENT_PROCESSING') throw err;
      logger.error('Webhook rejected permanently', { err, event });
    }
  } else if (entity?.order_id && event === 'payment.failed') {
    await recordFailure(entity.order_id, entity.error_description);
  } else {
    logger.debug('Webhook event ignored', { event });
  }

  try {
    await WebhookEvent.create({ eventId: id, event });
  } catch (err: any) {
    if (err?.code !== 11000) throw err;
  }
  logger.info('Webhook processed', { event, eventId: id });
  return { processed: true, duplicate: false };
}
