import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { InventoryItem } from '../src/models/InventoryItem';
import { InventoryTransaction } from '../src/models/InventoryTransaction';
import { Order } from '../src/models/Order';
import { Payment } from '../src/models/Payment';
import { expireStaleReservations } from '../src/services/order.service';
import { reconcilePendingPayments } from '../src/services/payment.service';
import { signRequest } from '../src/utils/esewa';
import { clearDb, startDb, stopDb } from './helpers/db';
import { redirectData } from './helpers/esewa';
import { EXPECTED, createUser, orderBody, seedCatalog } from './helpers/factories';

vi.mock('../src/utils/email', () => ({ sendMail: vi.fn(async () => ({ delivered: true, mode: 'smtp' })) }));
vi.mock('../src/utils/esewa', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/esewa')>();
  return { ...actual, esewaGateway: { checkStatus: vi.fn() } };
});
import { EsewaUnavailableError, esewaGateway } from '../src/utils/esewa';

const gw = vi.mocked(esewaGateway.checkStatus);
const SECRET = '8gBm/:&EnhH.1/q';
const app = createApp();
let cat: Awaited<ReturnType<typeof seedCatalog>>;

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  cat = await seedCatalog();
  gw.mockReset();
});

const stock = async (name: string) => (await InventoryItem.findOne({ name }))!.stock;
const remote = (uuid: string, status: string, over: Record<string, unknown> = {}) => ({
  status, transactionUuid: uuid, productCode: 'EPAYTEST', totalAmountPaisa: EXPECTED.total, refId: status === 'COMPLETE' ? '0004T5I' : null, ...over,
});

async function checkout(userArg?: Awaited<ReturnType<typeof createUser>>) {
  const u = userArg ?? (await createUser());
  const created = await request(app).post('/api/orders').set(u.auth).send(orderBody(cat));
  const orderId = created.body.data.order.id as string;
  const init = await request(app).post('/api/payments/esewa/initiate').set(u.auth).send({ orderId });
  return { u, orderId, init, uuid: init.body.data?.transactionUuid as string };
}
const verify = (u: { auth: Record<string, string> }, data: string) => request(app).post('/api/payments/esewa/verify').set(u.auth).send({ data });
const statusOf = (u: { auth: Record<string, string> }, orderId: string) => request(app).get(`/api/payments/esewa/status?orderId=${orderId}`).set(u.auth);

describe('initiate: request construction', () => {
  it('returns a correctly signed ePay V2 form built from the server-side total, and no secret', async () => {
    const { init, orderId, uuid } = await checkout();
    expect(init.status).toBe(200);
    const d = init.body.data;
    expect(d).toMatchObject({ provider: 'esewa', method: 'POST', paymentUrl: 'https://rc-epay.esewa.com.np/api/epay/main/v2/form', amount: EXPECTED.total, currency: 'NPR', orderId });
    expect(d.fields).toMatchObject({
      amount: '580', tax_amount: '0', product_service_charge: '0', product_delivery_charge: '40', total_amount: '620',
      product_code: 'EPAYTEST', signed_field_names: 'total_amount,transaction_uuid,product_code',
      success_url: `http://localhost:5173/payment/esewa/success/${orderId}`, failure_url: `http://localhost:5173/payment/esewa/failure/${orderId}`,
    });
    expect(Number(d.fields.amount) + Number(d.fields.tax_amount) + Number(d.fields.product_service_charge) + Number(d.fields.product_delivery_charge)).toBe(Number(d.fields.total_amount));
    expect(d.fields.transaction_uuid).toBe(uuid);
    expect(uuid).toMatch(/^[A-Za-z0-9-]+$/);
    expect(d.fields.signature).toBe(signRequest({ totalAmount: '620', transactionUuid: uuid, productCode: 'EPAYTEST' }, SECRET));
    expect(JSON.stringify(init.body)).not.toContain(SECRET);
    expect(Object.values(d.fields).every((v) => typeof v === 'string' && v !== '')).toBe(true);
    expect(await Payment.findOne({ transactionUuid: uuid })).toMatchObject({ amount: EXPECTED.total, status: 'created', currency: 'NPR' });
  });
  it('ignores any client-supplied amount (strict schema) and issues a unique uuid per attempt without new orders', async () => {
    const { u, orderId, uuid } = await checkout();
    const bad = await request(app).post('/api/payments/esewa/initiate').set(u.auth).send({ orderId, amount: 1 });
    expect(bad.status).toBe(400);
    const again = await request(app).post('/api/payments/esewa/initiate').set(u.auth).send({ orderId });
    expect(again.body.data.transactionUuid).not.toBe(uuid);
    expect(await Order.countDocuments()).toBe(1);
    expect(await stock('Dough')).toBe(98); // initiating never touches stock
  });
  it('requires authentication and ownership', async () => {
    const { orderId } = await checkout();
    expect((await request(app).post('/api/payments/esewa/initiate').send({ orderId })).status).toBe(401);
    const other = await createUser();
    expect((await request(app).post('/api/payments/esewa/initiate').set(other.auth).send({ orderId })).status).toBe(404);
  });
  it('refuses expired, cancelled and already-paid orders', async () => {
    const { u, orderId } = await checkout();
    await Order.updateOne({ _id: orderId }, { $set: { 'inventory.reservedUntil': new Date(Date.now() - 1000) } });
    expect((await request(app).post('/api/payments/esewa/initiate').set(u.auth).send({ orderId })).body.error.code).toBe('ORDER_EXPIRED');
    expect(await stock('Dough')).toBe(100);
    const second = await checkout();
    gw.mockResolvedValue(remote(second.uuid, 'COMPLETE'));
    await verify(second.u, redirectData({ uuid: second.uuid }));
    expect((await request(app).post('/api/payments/esewa/initiate').set(second.u.auth).send({ orderId: second.orderId })).body.error.code).toBe('ORDER_ALREADY_PAID');
  });
});

describe('verify: redirect data is untrusted', () => {
  it('rejects garbage, tampered and wrongly-signed data without calling eSewa', async () => {
    const { u, uuid } = await checkout();
    expect((await verify(u, 'not-base64-json-at-all!!!')).body.error.code).toBe('INVALID_PAYMENT_RESPONSE');
    const tampered = Buffer.from(Buffer.from(redirectData({ uuid }), 'base64').toString().replace('"total_amount":620', '"total_amount":1')).toString('base64');
    expect((await verify(u, tampered)).body.error.code).toBe('INVALID_SIGNATURE');
    expect((await verify(u, redirectData({ uuid, secret: 'attacker' }))).body.error.code).toBe('INVALID_SIGNATURE');
    expect((await verify(u, redirectData({ uuid, names: 'transaction_uuid,signed_field_names' }))).body.error.code).toBe('INVALID_SIGNATURE');
    expect(gw).not.toHaveBeenCalled();
    expect((await Payment.findOne({ transactionUuid: uuid }))!.status).toBe('created');
  });
  it('rejects unknown / foreign transaction uuids', async () => {
    const { u } = await checkout();
    expect((await verify(u, redirectData({ uuid: 'PZ00000000-UNKNOWN-deadbeef' }))).status).toBe(404);
    const theirs = await checkout();
    expect((await verify(u, redirectData({ uuid: theirs.uuid }))).status).toBe(404); // someone else's payment
    expect(gw).not.toHaveBeenCalled();
  });
  it('rejects product-code and amount mismatches in the signed response', async () => {
    const { u, uuid, orderId } = await checkout();
    expect((await verify(u, redirectData({ uuid, product: 'OTHER' }))).body.error.code).toBe('PRODUCT_CODE_MISMATCH');
    expect((await verify(u, redirectData({ uuid, rawTotal: '100' }))).body.error.code).toBe('PAYMENT_AMOUNT_MISMATCH');
    expect(gw).not.toHaveBeenCalled();
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: 'pending', orderStatus: 'pending_payment' });
  });
  it('requires authentication', async () => {
    const { uuid } = await checkout();
    expect((await request(app).post('/api/payments/esewa/verify').send({ data: redirectData({ uuid }) })).status).toBe(401);
  });
});

describe('verify: confirmation with the eSewa status API', () => {
  it('marks paid only after the status API says COMPLETE with the right amount; commits stock once', async () => {
    const { u, orderId, uuid } = await checkout();
    gw.mockResolvedValue(remote(uuid, 'COMPLETE'));
    const res = await verify(u, redirectData({ uuid }));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ paymentStatus: 'paid', gatewayStatus: 'COMPLETE', order: { paymentStatus: 'paid', orderStatus: 'received' } });
    expect(gw).toHaveBeenCalledWith({ productCode: 'EPAYTEST', totalAmount: '620', transactionUuid: uuid });
    expect(await Payment.findOne({ transactionUuid: uuid })).toMatchObject({ status: 'paid', verificationStatus: 'verified', transactionCode: '0004T5I', confirmedVia: 'redirect' });
    expect(await Order.findById(orderId)).toMatchObject({ inventory: expect.objectContaining({ state: 'committed' }) });
    expect(await stock('Dough')).toBe(98);
  });
  it('never trusts the redirect: a signed COMPLETE is not enough if eSewa says NOT_FOUND / PENDING', async () => {
    const { u, orderId, uuid } = await checkout();
    gw.mockResolvedValue(remote(uuid, 'NOT_FOUND', { totalAmountPaisa: null }));
    const a = await verify(u, redirectData({ uuid }));
    expect(a.status).toBe(202);
    expect(a.body.data.paymentStatus).toBe('not_found');
    gw.mockResolvedValue(remote(uuid, 'PENDING'));
    const b = await verify(u, redirectData({ uuid }));
    expect(b.status).toBe(202);
    expect(b.body.data.paymentStatus).toBe('pending');
    gw.mockResolvedValue(remote(uuid, 'AMBIGUOUS'));
    expect((await verify(u, redirectData({ uuid }))).body.data.paymentStatus).toBe('pending');
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: 'pending', orderStatus: 'pending_payment' });
    expect((await Payment.findOne({ transactionUuid: uuid }))!.status).toBe('pending');
  });
  it('treats a status API timeout/failure as verification_required, never as paid, and succeeds on retry', async () => {
    const { u, orderId, uuid } = await checkout();
    gw.mockRejectedValueOnce(new EsewaUnavailableError('eSewa status API timed out'));
    const first = await verify(u, redirectData({ uuid }));
    expect(first.status).toBe(202);
    expect(first.body.data).toMatchObject({ paymentStatus: 'verification_required', gatewayStatus: 'VERIFICATION_UNAVAILABLE' });
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: 'pending', orderStatus: 'pending_payment' });
    gw.mockResolvedValue(remote(uuid, 'COMPLETE'));
    expect((await verify(u, redirectData({ uuid }))).body.data.paymentStatus).toBe('paid');
    expect(await stock('Dough')).toBe(98);
  });
  it('rejects a COMPLETE whose amount differs from the server total, or has no amount', async () => {
    const { u, orderId, uuid } = await checkout();
    gw.mockResolvedValue(remote(uuid, 'COMPLETE', { totalAmountPaisa: 100 }));
    expect((await verify(u, redirectData({ uuid }))).body.error.code).toBe('PAYMENT_AMOUNT_MISMATCH');
    gw.mockResolvedValue(remote(uuid, 'COMPLETE', { totalAmountPaisa: null }));
    expect((await verify(u, redirectData({ uuid }))).status).toBe(503);
    gw.mockResolvedValue(remote('SOMEONE-ELSES-UUID', 'COMPLETE'));
    expect((await verify(u, redirectData({ uuid }))).body.error.code).toBe('PAYMENT_MISMATCH');
    gw.mockResolvedValue(remote(uuid, 'COMPLETE', { productCode: 'OTHER' }));
    expect((await verify(u, redirectData({ uuid }))).body.error.code).toBe('PAYMENT_MISMATCH');
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: 'pending', orderStatus: 'pending_payment' });
  });
  it('records a canceled payment as failed, keeps the stock reserved, and allows a safe retry', async () => {
    const { u, orderId, uuid } = await checkout();
    gw.mockResolvedValue(remote(uuid, 'CANCELED'));
    const res = await verify(u, redirectData({ uuid, status: 'CANCELED' }));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ paymentStatus: 'failed', gatewayStatus: 'CANCELED' });
    expect(await Payment.findOne({ transactionUuid: uuid })).toMatchObject({ status: 'failed', failedAttempts: 1 });
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: 'failed', orderStatus: 'pending_payment' });
    expect(await stock('Dough')).toBe(98);

    const retry = await request(app).post('/api/payments/esewa/initiate').set(u.auth).send({ orderId });
    expect(retry.status).toBe(200);
    expect(retry.body.data.transactionUuid).not.toBe(uuid);
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: 'pending' });
    gw.mockResolvedValue(remote(retry.body.data.transactionUuid, 'COMPLETE'));
    expect((await verify(u, redirectData({ uuid: retry.body.data.transactionUuid }))).body.data.paymentStatus).toBe('paid');
  });
});

describe('idempotency and concurrency', () => {
  it('repeated verification (refresh) yields one completion and one stock deduction', async () => {
    const { u, orderId, uuid } = await checkout();
    gw.mockResolvedValue(remote(uuid, 'COMPLETE'));
    const data = redirectData({ uuid });
    expect((await verify(u, data)).status).toBe(200);
    expect((await verify(u, data)).status).toBe(200);
    expect((await statusOf(u, orderId)).body.data.paymentStatus).toBe('paid');
    expect((await Order.findById(orderId))!.statusHistory.filter((h) => h.status === 'received')).toHaveLength(1);
    expect(await stock('Dough')).toBe(98);
    expect(await InventoryTransaction.countDocuments({ order: orderId })).toBe(3);
  });
  it('concurrent verifications do not double-complete or double-deduct', async () => {
    const { u, orderId, uuid } = await checkout();
    gw.mockResolvedValue(remote(uuid, 'COMPLETE'));
    const data = redirectData({ uuid });
    const results = await Promise.all(Array.from({ length: 6 }, () => verify(u, data)));
    expect(results.every((r) => r.status === 200 && r.body.data.paymentStatus === 'paid')).toBe(true);
    expect((await Order.findById(orderId))!.statusHistory.filter((h) => h.status === 'received')).toHaveLength(1);
    expect(await stock('Dough')).toBe(98);
    expect(await Payment.countDocuments({ order: orderId, status: 'paid' })).toBe(1);
  });
  it('a different eSewa transaction code for an already-paid attempt is rejected', async () => {
    const { u, uuid } = await checkout();
    gw.mockResolvedValue(remote(uuid, 'COMPLETE'));
    await verify(u, redirectData({ uuid }));
    gw.mockResolvedValue(remote(uuid, 'COMPLETE', { refId: 'DIFFERENT' }));
    expect((await verify(u, redirectData({ uuid }))).body.error.code).toBe('PAYMENT_ALREADY_RECORDED');
  });
  it('flags a refund (without touching the order or stock) when a second attempt is also paid', async () => {
    const { u, orderId, uuid } = await checkout();
    const second = (await request(app).post('/api/payments/esewa/initiate').set(u.auth).send({ orderId })).body.data.transactionUuid;
    gw.mockResolvedValue(remote(uuid, 'COMPLETE', { refId: 'CODE-1' }));
    await verify(u, redirectData({ uuid }));
    gw.mockResolvedValue(remote(second, 'COMPLETE', { refId: 'CODE-2' }));
    const res = await verify(u, redirectData({ uuid: second }));
    expect(res.status).toBe(200);
    expect(await Payment.findOne({ transactionUuid: second })).toMatchObject({ status: 'paid', duplicatePayment: true });
    expect(await Order.findById(orderId)).toMatchObject({ needsRefund: true, paymentStatus: 'paid', orderStatus: 'received' });
    expect(await stock('Dough')).toBe(98);
  });
});

describe('status endpoint (failure/cancel/pending route)', () => {
  it('asks eSewa about the latest attempt and reports the real result', async () => {
    const { u, orderId, uuid } = await checkout();
    gw.mockResolvedValue(remote(uuid, 'CANCELED'));
    expect((await statusOf(u, orderId)).body.data).toMatchObject({ paymentStatus: 'failed' });
    gw.mockResolvedValue(remote(uuid, 'PENDING'));
    const r = await statusOf(u, orderId);
    expect(r.status).toBe(202);
  });
  it('can confirm a payment when the success redirect never reached the browser', async () => {
    const { u, orderId, uuid } = await checkout();
    gw.mockResolvedValue(remote(uuid, 'COMPLETE'));
    const r = await statusOf(u, orderId);
    expect(r.body.data).toMatchObject({ paymentStatus: 'paid', order: { orderStatus: 'received' } });
    expect((await Payment.findOne({ transactionUuid: uuid }))!.confirmedVia).toBe('status_check');
  });
  it('does not call eSewa for an already-paid order, and hides other users\' orders', async () => {
    const { u, orderId, uuid } = await checkout();
    gw.mockResolvedValue(remote(uuid, 'COMPLETE'));
    await statusOf(u, orderId);
    gw.mockClear();
    expect((await statusOf(u, orderId)).body.data.paymentStatus).toBe('paid');
    expect(gw).not.toHaveBeenCalled();
    const other = await createUser();
    expect((await statusOf(other, orderId)).status).toBe(404);
    expect((await request(app).get(`/api/payments/esewa/status?orderId=${orderId}`)).status).toBe(401);
  });
});

describe('reconciliation and late payments', () => {
  // createdAt is immutable in Mongoose, so back-date through the raw driver.
  const age = (uuid: string, ms: number) =>
    Payment.collection.updateOne({ transactionUuid: uuid }, { $set: { createdAt: new Date(Date.now() - ms) } });

  it('completes payments whose browser never came back, and ignores very fresh attempts', async () => {
    const { orderId, uuid } = await checkout();
    gw.mockResolvedValue(remote(uuid, 'COMPLETE'));
    expect((await reconcilePendingPayments()).checked).toBe(0); // < 1 min old
    await age(uuid, 5 * 60_000);
    expect((await reconcilePendingPayments()).checked).toBe(1);
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: 'paid', orderStatus: 'received' });
    expect((await Payment.findOne({ transactionUuid: uuid }))!.confirmedVia).toBe('reconciliation');
    await reconcilePendingPayments();
    expect(await stock('Dough')).toBe(98);
  });
  it('survives eSewa outages during reconciliation', async () => {
    const { orderId, uuid } = await checkout();
    await age(uuid, 5 * 60_000);
    gw.mockRejectedValue(new EsewaUnavailableError('down'));
    await expect(reconcilePendingPayments()).resolves.toBeTruthy();
    expect((await Order.findById(orderId))!.paymentStatus).toBe('pending');
  });
  async function expired() {
    const c = await checkout();
    await Order.updateOne({ _id: c.orderId }, { $set: { 'inventory.reservedUntil': new Date(Date.now() - 1000) } });
    await expireStaleReservations();
    expect(await stock('Dough')).toBe(100);
    return c;
  }
  it('re-reserves stock when money arrives after the window expired and stock is still there', async () => {
    const { u, orderId, uuid } = await expired();
    gw.mockResolvedValue(remote(uuid, 'COMPLETE'));
    expect((await verify(u, redirectData({ uuid }))).body.data.paymentStatus).toBe('paid');
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: 'paid', orderStatus: 'received', needsRefund: false });
    expect(await stock('Dough')).toBe(98);
  });
  it('flags a refund and never oversells when stock is gone', async () => {
    const { u, orderId, uuid } = await expired();
    await InventoryItem.updateOne({ name: 'Dough' }, { $set: { stock: 0 } });
    gw.mockResolvedValue(remote(uuid, 'COMPLETE'));
    await verify(u, redirectData({ uuid }));
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: 'paid', orderStatus: 'cancelled', needsRefund: true });
    expect(await stock('Dough')).toBe(0);
  });
});