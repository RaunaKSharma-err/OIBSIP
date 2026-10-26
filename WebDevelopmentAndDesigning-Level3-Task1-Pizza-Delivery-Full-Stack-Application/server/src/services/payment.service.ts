import { esewa } from '../config/env';
import { Order, orderDto } from '../models/Order';
import { Payment, type IPayment } from '../models/Payment';
import type { AuthUser } from '../types';
import { ApiError } from '../utils/apiError';
import { randomToken } from '../utils/crypto';
import {
  EsewaUnavailableError,
  decodeRedirectData,
  esewaGateway,
  formatNpr,
  parseNprToPaisa,
  signRequest,
  verifyRedirectSignature,
  type EsewaStatus,
} from '../utils/esewa';
import { logger } from '../utils/logger';
import { afterStockChange, releaseStock, reserveStock, withOptionalTransaction } from './inventory.service';
import { cancelUnpaidOrder } from './order.service';
import type { IOrder } from '../models/Order';

type Via = 'redirect' | 'status_check' | 'reconciliation';
export type PaymentOutcome = 'paid' | 'pending' | 'failed' | 'not_found' | 'verification_required';

const requireConfigured = () => {
  if (!esewa.configured) throw new ApiError(503, 'PAYMENT_NOT_CONFIGURED', 'The payment gateway is not configured');
};
const safeReason = (s: string) => s.replace(/[^\w\s.,:;()'-]/g, '').slice(0, 200);

/**
 * Step 1: issue a signed ePay V2 form for an unpaid order owned by the caller.
 * Every call creates a NEW attempt (fresh transaction_uuid, as eSewa requires uniqueness per request),
 * but never a new order, and never touches stock (reserved at order creation).
 */
export async function initiatePayment(user: AuthUser, orderId: string) {
  requireConfigured();
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

  const transactionUuid = `${order.orderNumber}-${randomToken(4)}`; // alphanumeric + hyphen only
  await Payment.create({
    order: order._id,
    user: user.id,
    transactionUuid,
    productCode: esewa.productCode!,
    amount: order.total, // trusted server-side total, never client input
    currency: 'NPR',
  });
  await Order.updateOne({ _id: order._id, paymentStatus: 'failed', orderStatus: 'pending_payment' }, { $set: { paymentStatus: 'pending' } });

  const totalAmount = formatNpr(order.total);
  const fields = {
    amount: formatNpr(order.subtotal - order.discount),
    tax_amount: '0',
    total_amount: totalAmount, // = amount + tax_amount + product_service_charge + product_delivery_charge
    transaction_uuid: transactionUuid,
    product_code: esewa.productCode!,
    product_service_charge: '0',
    product_delivery_charge: formatNpr(order.deliveryFee),
    success_url: `${esewa.successUrl}/${order._id}`,
    failure_url: `${esewa.failureUrl}/${order._id}`,
    signed_field_names: 'total_amount,transaction_uuid,product_code',
    signature: signRequest({ totalAmount, transactionUuid, productCode: esewa.productCode! }, esewa.secretKey!),
  };
  logger.info('eSewa payment attempt created', { orderId: String(order._id), transactionUuid });
  return {
    provider: 'esewa' as const,
    environment: esewa.environment,
    paymentUrl: esewa.paymentUrl,
    method: 'POST' as const,
    fields, // the browser must POST exactly these as application/x-www-form-urlencoded
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    transactionUuid,
    amount: order.total,
    currency: 'NPR' as const,
  };
}

/**
 * Step 2 (success route): the browser hands over the untrusted `data` eSewa appended to the success URL.
 * We verify its signature and identity, then ALWAYS confirm with eSewa's status API before marking anything paid.
 */
export async function verifyRedirect(user: AuthUser, data: string) {
  requireConfigured();
  let text: string;
  try {
    text = decodeRedirectData(data);
  } catch {
    throw ApiError.badRequest('INVALID_PAYMENT_RESPONSE', 'The payment response could not be read');
  }
  const sig = verifyRedirectSignature(text, esewa.secretKey!);
  if (!sig.ok) {
    logger.warn('eSewa response signature rejected', { reason: sig.reason, userId: user.id });
    throw new ApiError(400, 'INVALID_SIGNATURE', 'The payment response could not be verified');
  }
  const v = sig.values; // exactly what was signed: use only these from here on
  const payment = await Payment.findOne({ transactionUuid: v.transaction_uuid });
  if (!payment || String(payment.user) !== user.id) throw ApiError.notFound('Payment not found', 'PAYMENT_NOT_FOUND');

  if (v.product_code !== payment.productCode) {
    await markVerificationFailed(payment);
    throw ApiError.badRequest('PRODUCT_CODE_MISMATCH', 'The payment response does not match this payment');
  }
  if (parseNprToPaisa(Number(v.total_amount.replace(/,/g, ''))) !== payment.amount) {
    await markVerificationFailed(payment);
    logger.error('eSewa redirect amount mismatch', { paymentId: String(payment._id), expected: payment.amount });
    throw ApiError.badRequest('PAYMENT_AMOUNT_MISMATCH', 'The payment amount does not match the order total');
  }
  // The redirect's own `status` is deliberately ignored: only the status API decides.
  return confirmWithGateway(payment, 'redirect');
}

/** Failure/cancel/pending route and manual retry: ask eSewa about the latest unpaid attempt of an owned order. */
export async function getPaymentStatus(user: AuthUser, orderId: string) {
  requireConfigured();
  const order = await Order.findOne({ _id: orderId, user: user.id });
  if (!order) throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
  if (order.paymentStatus === 'paid') return result('paid', order);
  const payment = await Payment.findOne({ order: order._id, status: { $in: ['created', 'pending', 'failed'] } }).sort({ createdAt: -1 });
  if (!payment) return result(order.paymentStatus === 'failed' ? 'failed' : 'pending', order);
  return confirmWithGateway(payment, 'status_check');
}

const result = (paymentStatus: PaymentOutcome, order: IOrder | null, gatewayStatus?: string) => ({
  paymentStatus,
  gatewayStatus: gatewayStatus ?? null,
  order: order ? orderDto(order) : null,
});

async function markVerificationFailed(p: IPayment) {
  await Payment.updateOne({ _id: p._id, status: { $ne: 'paid' } }, { $set: { verificationStatus: 'failed' } });
}

async function confirmWithGateway(payment: IPayment & { _id: any }, via: Via) {
  let remote: EsewaStatus;
  try {
    remote = await esewaGateway.checkStatus({
      productCode: payment.productCode,
      totalAmount: formatNpr(payment.amount),
      transactionUuid: payment.transactionUuid,
    });
  } catch (err) {
    if (!(err instanceof EsewaUnavailableError)) throw err;
    // Unknown is never "paid": keep it open and let the caller / reconciler retry.
    logger.warn('eSewa status check unavailable', { paymentId: String(payment._id), reason: err.message });
    await Payment.updateOne(
      { _id: payment._id, status: { $in: ['created', 'pending'] } },
      { $set: { status: 'pending', gatewayStatus: 'VERIFICATION_UNAVAILABLE', lastCheckedAt: new Date() } },
    );
    return result('verification_required', await Order.findById(payment.order), 'VERIFICATION_UNAVAILABLE');
  }
  const outcome = await applyGatewayStatus(payment, remote, via);
  return result(outcome, await Order.findById(payment.order), remote.status);
}

async function applyGatewayStatus(payment: IPayment & { _id: any }, remote: EsewaStatus, via: Via): Promise<PaymentOutcome> {
  const now = new Date();
  if (
    (remote.transactionUuid && remote.transactionUuid !== payment.transactionUuid) ||
    (remote.productCode && remote.productCode !== payment.productCode)
  ) {
    throw ApiError.badRequest('PAYMENT_MISMATCH', 'eSewa reported a different transaction than expected');
  }

  switch (remote.status) {
    case 'COMPLETE': {
      // Amount must be present AND equal to our server-side total, or we refuse to call it paid.
      if (remote.totalAmountPaisa === null) {
        throw new ApiError(503, 'VERIFICATION_INCOMPLETE', 'eSewa did not confirm the amount; please retry');
      }
      if (remote.totalAmountPaisa !== payment.amount) {
        await markVerificationFailed(payment);
        logger.error('eSewa status amount mismatch', { paymentId: String(payment._id), expected: payment.amount, got: remote.totalAmountPaisa });
        throw ApiError.badRequest('PAYMENT_AMOUNT_MISMATCH', 'The payment amount does not match the order total');
      }
      await finalizePayment(payment, remote.refId, via);
      return 'paid';
    }
    case 'CANCELED':
    case 'FULL_REFUND':
    case 'PARTIAL_REFUND':
      await recordFailure(payment, remote.status);
      return 'failed';
    case 'NOT_FOUND': // nothing happened at eSewa (yet): session never started, or expired
      await Payment.updateOne({ _id: payment._id, status: { $ne: 'paid' } }, { $set: { gatewayStatus: 'NOT_FOUND', lastCheckedAt: now } });
      return 'not_found';
    default: // PENDING, AMBIGUOUS and anything unknown: never treated as success
      await Payment.updateOne(
        { _id: payment._id, status: { $in: ['created', 'pending'] } },
        { $set: { status: 'pending', gatewayStatus: remote.status, lastCheckedAt: now } },
      );
      return 'pending';
  }
}

/** Idempotent: callable any number of times, concurrently, from redirect / retry / reconciliation. */
async function finalizePayment(payment: IPayment & { _id: any }, transactionCode: string | null, via: Via) {
  const otherPaid = await Payment.exists({ order: payment.order, status: 'paid', _id: { $ne: payment._id } });
  let claimed;
  try {
    claimed = await Payment.findOneAndUpdate(
      { _id: payment._id, status: { $ne: 'paid' } },
      {
        $set: {
          status: 'paid',
          gatewayStatus: 'COMPLETE',
          verificationStatus: 'verified',
          paidAt: new Date(),
          lastCheckedAt: new Date(),
          confirmedVia: via,
          duplicatePayment: Boolean(otherPaid),
          ...(transactionCode ? { transactionCode } : {}),
        },
        $unset: { failureReason: 1 },
      },
      { new: true },
    );
  } catch (err: any) {
    if (err?.code === 11000) throw ApiError.conflict('PAYMENT_ALREADY_RECORDED', 'This eSewa transaction was already recorded');
    throw err;
  }
  if (!claimed) {
    // Already paid (earlier call). Same transaction => fine; different one => conflict.
    const current = await Payment.findById(payment._id);
    if (current?.transactionCode && transactionCode && current.transactionCode !== transactionCode) {
      throw ApiError.conflict('PAYMENT_ALREADY_RECORDED', 'A different eSewa transaction was already recorded for this payment');
    }
  } else if (otherPaid) {
    // The customer completed a second attempt for an order that is already paid: do not touch the order lifecycle.
    await Order.updateOne({ _id: payment.order }, { $set: { needsRefund: true } });
    logger.error('Duplicate eSewa payment for an already-paid order: manual refund required', { orderId: String(payment.order), paymentId: String(payment._id) });
    return;
  }
  // Always (re)apply: every step is conditional, so a crash between the two writes self-heals on retry.
  await applyPaidToOrder(payment.order);
  logger.info('eSewa payment confirmed', { paymentId: String(payment._id), orderId: String(payment.order), via });
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

async function recordFailure(payment: IPayment & { _id: any }, gatewayStatus: string) {
  const failed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: 'paid' } },
    {
      $set: { status: 'failed', gatewayStatus, failedAt: new Date(), lastCheckedAt: new Date(), failureReason: safeReason(`Payment ${gatewayStatus.toLowerCase().replace(/_/g, ' ')} at eSewa`) },
      $inc: { failedAttempts: 1 },
    },
    { new: true },
  );
  if (!failed) return;
  const stillOpen = await Payment.exists({ order: failed.order, status: { $in: ['created', 'pending'] } });
  if (!stillOpen) {
    await Order.updateOne({ _id: failed.order, orderStatus: 'pending_payment', paymentStatus: { $ne: 'paid' } }, { $set: { paymentStatus: 'failed' } });
  }
  logger.warn('eSewa payment not completed', { paymentId: String(failed._id), gatewayStatus });
}

/**
 * Safety net for browsers that closed before the success page ran: re-check recent unfinished attempts.
 * Run by the scheduler; safe to run concurrently (all transitions are conditional).
 */
export async function reconcilePendingPayments(limit = 50) {
  if (!esewa.configured) return { checked: 0 };
  const now = Date.now();
  const due = await Payment.find({
    status: { $in: ['created', 'pending'] },
    createdAt: { $lt: new Date(now - 60_000), $gt: new Date(now - 24 * 3_600_000) },
    $or: [{ lastCheckedAt: { $exists: false } }, { lastCheckedAt: { $lt: new Date(now - 10 * 60_000) } }],
  })
    .sort({ createdAt: 1 })
    .limit(limit);
  let checked = 0;
  for (const p of due) {
    try {
      await confirmWithGateway(p, 'reconciliation');
      checked += 1;
    } catch (err) {
      logger.error('Payment reconciliation failed for one attempt', { err, paymentId: String(p._id) });
    }
  }
  if (checked) logger.info('Payment reconciliation run', { checked });
  return { checked };
}
