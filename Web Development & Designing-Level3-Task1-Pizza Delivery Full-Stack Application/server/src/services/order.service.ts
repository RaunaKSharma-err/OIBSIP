import crypto from 'crypto';
import mongoose, { type FilterQuery } from 'mongoose';
import { env } from '../config/env';
import { Order, orderDto, type IOrder } from '../models/Order';
import { Payment } from '../models/Payment';
import { ApiError } from '../utils/apiError';
import { logger } from '../utils/logger';
import { escapeRegex, pageMeta, skipFor } from '../utils/pagination';
import { canTransition, type OrderStatus, type PaymentStatus } from '../types';
import { afterStockChange, releaseStock, reserveStock, undoReserve, withOptionalTransaction } from './inventory.service';
import { priceCart, type CartItemInput } from './pricing.service';

const newOrderNumber = () => {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `PZ${d}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

export async function createOrder(
  userId: string,
  input: { items: CartItemInput[]; delivery: IOrder['delivery'] },
  idempotencyKey?: string,
) {
  if (idempotencyKey) {
    const existing = await Order.findOne({ user: userId, idempotencyKey });
    if (existing) return { order: orderDto(existing), created: false };
  }
  const priced = await priceCart(input.items);
  const now = new Date();
  const order = new Order({
    orderNumber: newOrderNumber(),
    user: userId,
    items: priced.lines,
    subtotal: priced.subtotal,
    deliveryFee: priced.deliveryFee,
    discount: priced.discount,
    total: priced.total,
    delivery: input.delivery,
    paymentStatus: 'pending',
    orderStatus: 'pending_payment',
    statusHistory: [{ status: 'pending_payment', at: now, by: { kind: 'customer', user: userId }, note: 'Order created' }],
    idempotencyKey,
    inventory: {
      state: 'reserved',
      reservedUntil: new Date(now.getTime() + env.RESERVATION_MINUTES * 60_000),
      cycle: 0,
      requirements: priced.requirements,
    },
  });

  try {
    await withOptionalTransaction(async (session) => {
      const applied = await reserveStock(order._id, priced.requirements, 0, session);
      try {
        await order.save({ session });
      } catch (err) {
        if (!session) await undoReserve(order._id, applied, 0);
        throw err;
      }
    });
  } catch (err: any) {
    if (err?.code === 11000 && idempotencyKey) {
      const existing = await Order.findOne({ user: userId, idempotencyKey });
      if (existing) return { order: orderDto(existing), created: false };
    }
    throw err;
  }
  await afterStockChange(priced.requirements.map((r) => r.item));
  logger.info('Order created', { orderId: String(order._id), orderNumber: order.orderNumber, userId, total: order.total });
  return { order: orderDto(order), created: true };
}

export async function listMyOrders(userId: string, q: { page: number; limit: number; status?: OrderStatus }) {
  const filter: FilterQuery<IOrder> = { user: userId as any };
  if (q.status) filter.orderStatus = q.status;
  const [docs, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skipFor(q.page, q.limit)).limit(q.limit).lean(),
    Order.countDocuments(filter),
  ]);
  return { data: docs.map(orderDto), pagination: pageMeta(q.page, q.limit, total) };
}

/** Ownership is enforced in the query; other users' orders look like 404 (no existence leak). */
export async function getMyOrder(userId: string, orderId: string) {
  const order = await Order.findOne({ _id: orderId, user: userId }).lean();
  if (!order) throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
  return orderDto(order);
}

export type Actor = { kind: 'customer' | 'admin' | 'system'; user?: string };

/** Cancels an UNPAID order and returns its reserved stock. Safe to call repeatedly / concurrently. */
export async function cancelUnpaidOrder(orderId: string, reason: string, actor: Actor, extra: FilterQuery<IOrder> = {}) {
  const now = new Date();
  const claimed = await Order.findOneAndUpdate(
    { _id: orderId, orderStatus: 'pending_payment', paymentStatus: { $ne: 'paid' }, ...extra },
    {
      $set: {
        orderStatus: 'cancelled',
        'inventory.state': 'releasing',
        cancellation: { reason, at: now, by: actor.kind },
      },
      $push: { statusHistory: { status: 'cancelled', at: now, by: actor, note: reason } },
    },
    { new: true },
  );
  if (!claimed) return null;
  await completeRelease(claimed);
  logger.info('Unpaid order cancelled; stock released', { orderId, reason });
  return claimed;
}

async function completeRelease(order: IOrder & { _id: mongoose.Types.ObjectId }) {
  await withOptionalTransaction((s) => releaseStock(order._id, order.inventory.requirements, order.inventory.cycle, s));
  await Order.updateOne({ _id: order._id, 'inventory.state': 'releasing' }, { $set: { 'inventory.state': 'released' } });
  await afterStockChange(order.inventory.requirements.map((r) => r.item));
}

export async function customerCancelOrder(userId: string, orderId: string, reason?: string) {
  const own = await Order.findOne({ _id: orderId, user: userId }).lean();
  if (!own) throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
  const cancelled = await cancelUnpaidOrder(orderId, reason || 'Cancelled by customer', { kind: 'customer', user: userId });
  if (!cancelled) {
    throw ApiError.conflict('ORDER_NOT_CANCELLABLE', 'Only orders awaiting payment can be cancelled by the customer');
  }
  return orderDto(cancelled);
}

/** Housekeeping used by the scheduler: expire unpaid reservations and finish interrupted releases. */
export async function expireStaleReservations(limit = 100) {
  const expired = await Order.find({ orderStatus: 'pending_payment', 'inventory.reservedUntil': { $lt: new Date() } })
    .select('_id')
    .limit(limit)
    .lean();
  let expiredCount = 0;
  for (const o of expired) {
    const done = await cancelUnpaidOrder(String(o._id), 'PAYMENT_WINDOW_EXPIRED', { kind: 'system' });
    if (done) expiredCount += 1;
  }
  const stuck = await Order.find({
    orderStatus: 'cancelled',
    'inventory.state': 'releasing',
    updatedAt: { $lt: new Date(Date.now() - 2 * 60_000) },
  }).limit(limit);
  for (const o of stuck) await completeRelease(o);
  if (expiredCount || stuck.length) logger.info('Reservation cleanup', { expired: expiredCount, recovered: stuck.length });
  return { expired: expiredCount, recovered: stuck.length };
}

// ------------------------------------- admin ---------------------------------------------------

export async function adminListOrders(q: {
  page: number;
  limit: number;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  search?: string;
}) {
  const filter: FilterQuery<IOrder> = {};
  if (q.status) filter.orderStatus = q.status;
  if (q.paymentStatus) filter.paymentStatus = q.paymentStatus;
  if (q.search) filter.orderNumber = { $regex: escapeRegex(q.search), $options: 'i' };
  const [docs, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skipFor(q.page, q.limit)).limit(q.limit).populate('user', 'name email').lean(),
    Order.countDocuments(filter),
  ]);
  return { data: docs.map(orderDto), pagination: pageMeta(q.page, q.limit, total) };
}

export async function adminGetOrder(orderId: string) {
  const order = await Order.findById(orderId).populate('user', 'name email').lean();
  if (!order) throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
  const payments = await Payment.find({ order: orderId }).sort({ createdAt: -1 }).lean();
  return {
    ...orderDto(order),
    payments: payments.map((p) => ({
      id: String(p._id),
      razorpayOrderId: p.razorpayOrderId,
      razorpayPaymentId: p.razorpayPaymentId ?? null,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      verificationStatus: p.verificationStatus,
      failureReason: p.failureReason ?? null,
      paidAt: p.paidAt ?? null,
    })),
  };
}

export async function adminUpdateStatus(orderId: string, next: OrderStatus, note: string | undefined, adminId: string) {
  const order = await Order.findById(orderId);
  if (!order) throw ApiError.notFound('Order not found', 'ORDER_NOT_FOUND');
  const current = order.orderStatus;
  if (!canTransition(current, next)) {
    throw ApiError.conflict('INVALID_STATUS_TRANSITION', `Cannot change order status from "${current}" to "${next}"`, {
      from: current,
      to: next,
    });
  }
  if (next === 'cancelled' && current === 'pending_payment') {
    const cancelled = await cancelUnpaidOrder(orderId, note || 'Cancelled by admin', { kind: 'admin', user: adminId });
    if (!cancelled) throw ApiError.conflict('ORDER_STATUS_CONFLICT', 'Order was updated by someone else. Reload and retry.');
    return orderDto(cancelled);
  }
  if (order.paymentStatus !== 'paid' && next !== 'cancelled') {
    throw ApiError.conflict('ORDER_NOT_PAID', 'Only paid orders can progress through fulfilment');
  }
  const now = new Date();
  const set: Record<string, unknown> = { orderStatus: next };
  if (next === 'cancelled') {
    set.cancellation = { reason: note || 'Cancelled by admin', at: now, by: 'admin' };
    set.needsRefund = order.paymentStatus === 'paid';
  }
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, orderStatus: current }, // optimistic concurrency
    { $set: set, $push: { statusHistory: { status: next, at: now, by: { kind: 'admin', user: adminId }, note } } },
    { new: true },
  );
  if (!updated) throw ApiError.conflict('ORDER_STATUS_CONFLICT', 'Order was updated by someone else. Reload and retry.');
  logger.info('Order status changed', { orderId, from: current, to: next, adminId });
  return orderDto(updated);
}
