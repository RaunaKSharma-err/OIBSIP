import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { InventoryItem } from '../src/models/InventoryItem';
import { InventoryTransaction } from '../src/models/InventoryTransaction';
import { Order } from '../src/models/Order';
import { Payment } from '../src/models/Payment';
import { expireStaleReservations } from '../src/services/order.service';
import { hmacSha256Hex } from '../src/utils/crypto';
import { clearDb, startDb, stopDb } from './helpers/db';
import { EXPECTED, createUser, orderBody, seedCatalog } from './helpers/factories';

vi.mock('../src/utils/email', () => ({ sendMail: vi.fn(async () => ({ delivered: true, mode: 'smtp' })) }));
let seq = 0;
vi.mock('../src/utils/razorpay', () => ({
  razorpayGateway: { createOrder: vi.fn(), fetchPayment: vi.fn() },
}));
import { razorpayGateway } from '../src/utils/razorpay';

const gw = vi.mocked(razorpayGateway);
const KEY_SECRET = 'test_key_secret';
const WH_SECRET = 'test_webhook_secret';
const app = createApp();
let cat: Awaited<ReturnType<typeof seedCatalog>>;

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  cat = await seedCatalog();
  gw.createOrder.mockReset().mockImplementation(async (p) => ({ id: `order_T${++seq}`, amount: p.amount, currency: p.currency }));
  gw.fetchPayment.mockReset();
});

const stock = async (name: string) => (await InventoryItem.findOne({ name }))!.stock;

async function checkout() {
  const u = await createUser();
  const created = await request(app).post('/api/orders').set(u.auth).send(orderBody(cat));
  const orderId = created.body.data.order.id as string;
  const pay = await request(app).post('/api/payments/create-order').set(u.auth).send({ orderId });
  return { u, orderId, rpOrderId: pay.body.data.razorpayOrderId as string, pay };
}
const sign = (o: string, p: string) => hmacSha256Hex(KEY_SECRET, `${o}|${p}`);
const verifyBody = (orderId: string, o: string, p: string, signature = sign(o, p)) => ({
  orderId, razorpay_order_id: o, razorpay_payment_id: p, razorpay_signature: signature,
});
const captured = (o: string, p: string, amount = EXPECTED.total) => ({ id: p, order_id: o, amount, currency: 'INR', status: 'captured' });

function webhook(event: string, o: string, p: string, opts: { eventId?: string; amount?: number; secret?: string; error?: string } = {}) {
  const payload = JSON.stringify({
    event,
    payload: { payment: { entity: { id: p, order_id: o, amount: opts.amount ?? EXPECTED.total, currency: 'INR', status: event === 'payment.failed' ? 'failed' : 'captured', error_description: opts.error } } },
  });
  return request(app)
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', hmacSha256Hex(opts.secret ?? WH_SECRET, payload))
    .set('X-Razorpay-Event-Id', opts.eventId ?? `evt_${++seq}`)
    .send(payload);
}

describe('create payment order', () => {
  it('creates a Razorpay order for the authoritative server amount and exposes no secrets', async () => {
    const { pay, orderId } = await checkout();
    expect(pay.status).toBe(200);
    expect(gw.createOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: EXPECTED.total, currency: 'INR' }));
    expect(pay.body.data).toMatchObject({ amount: EXPECTED.total, currency: 'INR', orderId, keyId: 'rzp_test_dummy' });
    expect(JSON.stringify(pay.body)).not.toContain(KEY_SECRET);
  });
  it('reuses the same Razorpay order on refresh/retry', async () => {
    const { u, orderId, rpOrderId } = await checkout();
    const again = await request(app).post('/api/payments/create-order').set(u.auth).send({ orderId });
    expect(again.body.data.razorpayOrderId).toBe(rpOrderId);
    expect(gw.createOrder).toHaveBeenCalledTimes(1);
  });
  it("refuses to create a payment for someone else's order", async () => {
    const { orderId } = await checkout();
    const other = await createUser();
    expect((await request(app).post('/api/payments/create-order').set(other.auth).send({ orderId })).status).toBe(404);
  });
  it('refuses an expired order', async () => {
    const { u, orderId } = await checkout();
    await Order.updateOne({ _id: orderId }, { $set: { 'inventory.reservedUntil': new Date(Date.now() - 1000) } });
    const res = await request(app).post('/api/payments/create-order').set(u.auth).send({ orderId });
    expect(res.body.error.code).toBe('ORDER_EXPIRED');
    expect(await stock('Dough')).toBe(100);
  });
});

describe('verify payment', () => {
  it('rejects an invalid signature and leaves the order unpaid', async () => {
    const { u, orderId, rpOrderId } = await checkout();
    const res = await request(app).post('/api/payments/verify').set(u.auth).send(verifyBody(orderId, rpOrderId, 'pay_1', 'f'.repeat(64)));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    expect(gw.fetchPayment).not.toHaveBeenCalled();
    const o = await Order.findById(orderId);
    expect(o).toMatchObject({ paymentStatus: 'pending', orderStatus: 'pending_payment' });
  });
  it('accepts a valid payment: order becomes paid + received, stock committed', async () => {
    const { u, orderId, rpOrderId } = await checkout();
    gw.fetchPayment.mockResolvedValue(captured(rpOrderId, 'pay_ok'));
    const res = await request(app).post('/api/payments/verify').set(u.auth).send(verifyBody(orderId, rpOrderId, 'pay_ok'));
    expect(res.status).toBe(200);
    expect(res.body.data.order).toMatchObject({ paymentStatus: 'paid', orderStatus: 'received' });
    expect(await Order.findById(orderId)).toMatchObject({ inventory: expect.objectContaining({ state: 'committed' }) });
    expect(await Payment.findOne({ razorpayOrderId: rpOrderId })).toMatchObject({ status: 'paid', verificationStatus: 'verified', razorpayPaymentId: 'pay_ok' });
    expect(await stock('Dough')).toBe(98);
  });
  it('rejects an amount mismatch', async () => {
    const { u, orderId, rpOrderId } = await checkout();
    gw.fetchPayment.mockResolvedValue(captured(rpOrderId, 'pay_low', 100));
    const res = await request(app).post('/api/payments/verify').set(u.auth).send(verifyBody(orderId, rpOrderId, 'pay_low'));
    expect(res.body.error.code).toBe('PAYMENT_AMOUNT_MISMATCH');
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: 'pending', orderStatus: 'pending_payment' });
  });
  it('rejects an unknown or foreign provider order id', async () => {
    const { u, orderId } = await checkout();
    expect((await request(app).post('/api/payments/verify').set(u.auth).send(verifyBody(orderId, 'order_unknown', 'pay_1'))).status).toBe(404);
    const { rpOrderId: theirs } = await checkout(); // another customer's payment
    expect((await request(app).post('/api/payments/verify').set(u.auth).send(verifyBody(orderId, theirs, 'pay_1'))).status).toBe(404);
  });
  it('rejects a payment that Razorpay says belongs to a different provider order', async () => {
    const { u, orderId, rpOrderId } = await checkout();
    gw.fetchPayment.mockResolvedValue(captured('order_somethingElse', 'pay_x'));
    const res = await request(app).post('/api/payments/verify').set(u.auth).send(verifyBody(orderId, rpOrderId, 'pay_x'));
    expect(res.body.error.code).toBe('PAYMENT_ORDER_MISMATCH');
  });
  it('is idempotent for repeated verification: no second history entry, no extra stock movement', async () => {
    const { u, orderId, rpOrderId } = await checkout();
    gw.fetchPayment.mockResolvedValue(captured(rpOrderId, 'pay_dup'));
    const body = verifyBody(orderId, rpOrderId, 'pay_dup');
    expect((await request(app).post('/api/payments/verify').set(u.auth).send(body)).status).toBe(200);
    expect((await request(app).post('/api/payments/verify').set(u.auth).send(body)).status).toBe(200);
    const o = await Order.findById(orderId);
    expect(o!.statusHistory.filter((h) => h.status === 'received')).toHaveLength(1);
    expect(await stock('Dough')).toBe(98);
    expect(await InventoryTransaction.countDocuments({ order: orderId })).toBe(3); // dough, cheese, box reserved once
  });
  it('does not mark paid while the gateway reports the payment as merely authorized', async () => {
    const { u, orderId, rpOrderId } = await checkout();
    gw.fetchPayment.mockResolvedValue({ ...captured(rpOrderId, 'pay_auth'), status: 'authorized' });
    const res = await request(app).post('/api/payments/verify').set(u.auth).send(verifyBody(orderId, rpOrderId, 'pay_auth'));
    expect(res.status).toBe(202);
    expect((await Order.findById(orderId))!.paymentStatus).toBe('pending');
  });
});

describe('webhooks', () => {
  it('rejects a bad signature', async () => {
    const { rpOrderId } = await checkout();
    expect((await webhook('payment.captured', rpOrderId, 'pay_w', { secret: 'wrong' })).status).toBe(400);
  });
  it('processes payment.captured once even when delivered repeatedly', async () => {
    const { orderId, rpOrderId } = await checkout();
    const first = await webhook('payment.captured', rpOrderId, 'pay_w1', { eventId: 'evt_same' });
    const second = await webhook('payment.captured', rpOrderId, 'pay_w1', { eventId: 'evt_same' });
    const thirdNewEventId = await webhook('payment.captured', rpOrderId, 'pay_w1', { eventId: 'evt_other' });
    expect([first.status, second.status, thirdNewEventId.status]).toEqual([200, 200, 200]);
    expect(second.body.data.duplicate).toBe(true);
    const o = await Order.findById(orderId);
    expect(o).toMatchObject({ paymentStatus: 'paid', orderStatus: 'received' });
    expect(o!.statusHistory.filter((h) => h.status === 'received')).toHaveLength(1);
    expect(await stock('Dough')).toBe(98); // no duplicate deduction
  });
  it('is idempotent across webhook + browser verification', async () => {
    const { u, orderId, rpOrderId } = await checkout();
    await webhook('payment.captured', rpOrderId, 'pay_both');
    gw.fetchPayment.mockResolvedValue(captured(rpOrderId, 'pay_both'));
    expect((await request(app).post('/api/payments/verify').set(u.auth).send(verifyBody(orderId, rpOrderId, 'pay_both'))).status).toBe(200);
    expect(await stock('Dough')).toBe(98);
    expect((await Order.findById(orderId))!.statusHistory.filter((h) => h.status === 'received')).toHaveLength(1);
  });
  it('does not mark paid on an amount mismatch (acknowledged with 200 so Razorpay stops retrying)', async () => {
    const { orderId, rpOrderId } = await checkout();
    const res = await webhook('payment.captured', rpOrderId, 'pay_bad', { amount: 1 });
    expect(res.status).toBe(200);
    expect((await Order.findById(orderId))!.paymentStatus).toBe('pending');
  });
  it('records payment.failed, keeps the order retryable, and reuses the Razorpay order on retry', async () => {
    const { u, orderId, rpOrderId } = await checkout();
    expect((await webhook('payment.failed', rpOrderId, 'pay_f', { error: 'Card declined <script>' })).status).toBe(200);
    const p = await Payment.findOne({ razorpayOrderId: rpOrderId });
    expect(p).toMatchObject({ status: 'failed', failedAttempts: 1 });
    expect(p!.failureReason).not.toContain('<');
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: 'failed', orderStatus: 'pending_payment' });
    expect(await stock('Dough')).toBe(98); // still reserved

    const retry = await request(app).post('/api/payments/create-order').set(u.auth).send({ orderId });
    expect(retry.body.data.razorpayOrderId).toBe(rpOrderId);
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: 'pending' });
    await webhook('payment.captured', rpOrderId, 'pay_f2');
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: 'paid', orderStatus: 'received' });
  });
});

describe('late payment after the reservation expired', () => {
  async function expired() {
    const c = await checkout();
    await Order.updateOne({ _id: c.orderId }, { $set: { 'inventory.reservedUntil': new Date(Date.now() - 1000) } });
    await expireStaleReservations();
    expect(await stock('Dough')).toBe(100);
    return c;
  }
  it('re-reserves stock and fulfils the order when stock is still available', async () => {
    const { orderId, rpOrderId } = await expired();
    await webhook('payment.captured', rpOrderId, 'pay_late');
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: 'paid', orderStatus: 'received', needsRefund: false });
    expect(await stock('Dough')).toBe(98);
  });
  it('flags a refund (and does not oversell) when stock is gone', async () => {
    const { orderId, rpOrderId } = await expired();
    await InventoryItem.updateOne({ name: 'Dough' }, { $set: { stock: 0 } });
    await webhook('payment.captured', rpOrderId, 'pay_late2');
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: 'paid', orderStatus: 'cancelled', needsRefund: true });
    expect(await stock('Dough')).toBe(0);
  });
});
