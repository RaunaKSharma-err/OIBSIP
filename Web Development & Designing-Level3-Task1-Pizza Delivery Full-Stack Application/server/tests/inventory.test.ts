import request from 'supertest';
import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { InventoryItem } from '../src/models/InventoryItem';
import { InventoryTransaction } from '../src/models/InventoryTransaction';
import { Order } from '../src/models/Order';
import { evaluateLowStock } from '../src/services/alert.service';
import { releaseStock, reserveStock } from '../src/services/inventory.service';
import { createOrder } from '../src/services/order.service';
import { clearDb, startDb, stopDb } from './helpers/db';
import { createUser, delivery, orderBody, seedCatalog } from './helpers/factories';

vi.mock('../src/utils/email', () => ({ sendMail: vi.fn(async () => ({ delivered: true, mode: 'smtp' })) }));
import { sendMail } from '../src/utils/email';

const mail = vi.mocked(sendMail);
const app = createApp();
let admin: Awaited<ReturnType<typeof createUser>>;

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  mail.mockClear();
  mail.mockResolvedValue({ delivered: true, mode: 'smtp' });
  admin = await createUser({ role: 'admin' });
});

const newItem = (over: Record<string, unknown> = {}) =>
  request(app).post('/api/admin/inventory').set(admin.auth).send({ name: 'Flour', category: 'dough', unit: 'g', stock: 1000, lowStockThreshold: 200, ...over });

describe('admin inventory API', () => {
  it('creates, lists, filters and fetches items', async () => {
    const created = await newItem();
    expect(created.status).toBe(201);
    expect(created.body.data.item).toMatchObject({ stock: 1000, stockStatus: 'ok', unit: 'g' });
    await newItem({ name: 'Yeast', stock: 50, lowStockThreshold: 100 });
    const low = await request(app).get('/api/admin/inventory?status=low').set(admin.auth);
    expect(low.body.data.map((i: any) => i.name)).toEqual(['Yeast']);
    expect(low.body.pagination.total).toBe(1);
    expect((await request(app).get(`/api/admin/inventory/${created.body.data.item.id}`).set(admin.auth)).status).toBe(200);
  });
  it('blocks customers and anonymous users', async () => {
    const c = await createUser();
    expect((await request(app).post('/api/admin/inventory').set(c.auth).send({})).status).toBe(403);
    expect((await request(app).get('/api/admin/inventory')).status).toBe(401);
    const item = (await newItem()).body.data.item;
    expect((await request(app).post(`/api/admin/inventory/${item.id}/adjustments`).set(c.auth).send({ change: 5, reason: 'sneaky' })).status).toBe(403);
  });
  it('validates quantities: no floats, no zero, no negative stock, no direct stock edits', async () => {
    const item = (await newItem()).body.data.item;
    const adj = (body: object) => request(app).post(`/api/admin/inventory/${item.id}/adjustments`).set(admin.auth).send(body);
    expect((await adj({ change: 1.5, reason: 'float' })).status).toBe(400);
    expect((await adj({ change: 0, reason: 'zero' })).status).toBe(400);
    expect((await adj({ change: 5 })).status).toBe(400); // reason required
    const over = await adj({ change: -1001, reason: 'too much' });
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect((await newItem({ name: 'Bad', stock: -1 })).status).toBe(400);
    expect((await request(app).patch(`/api/admin/inventory/${item.id}`).set(admin.auth).send({ stock: 99999 })).status).toBe(400);
  });
  it('adjusts stock and records an auditable transaction history', async () => {
    const item = (await newItem()).body.data.item;
    const up = await request(app).post(`/api/admin/inventory/${item.id}/adjustments`).set(admin.auth).send({ change: 500, reason: 'Delivery received' });
    expect(up.body.data.item.stock).toBe(1500);
    const down = await request(app).post(`/api/admin/inventory/${item.id}/adjustments`).set(admin.auth).send({ change: -100, reason: 'Spoilage' });
    expect(down.body.data.item.stock).toBe(1400);
    const hist = await request(app).get(`/api/admin/inventory/${item.id}/transactions`).set(admin.auth);
    expect(hist.body.data.map((t: any) => [t.type, t.quantityChange])).toEqual([['adjustment', -100], ['restock', 500], ['initial', 1000]]);
    expect(hist.body.data[0].actor.user).toBe(String(admin.user._id));
  });
  it('never lets concurrent adjustments drive stock negative', async () => {
    const item = (await newItem({ stock: 10, lowStockThreshold: 0 })).body.data.item;
    const results = await Promise.all(
      Array.from({ length: 8 }, () => request(app).post(`/api/admin/inventory/${item.id}/adjustments`).set(admin.auth).send({ change: -3, reason: 'race test' })),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(3);
    expect((await InventoryItem.findById(item.id))!.stock).toBe(1);
  });
});

describe('stock reservation concurrency and idempotency', () => {
  it('cannot oversell: 10 parallel orders against 5 units yields exactly 5 successes', async () => {
    const cat = await seedCatalog(5);
    const users = await Promise.all(Array.from({ length: 10 }, () => createUser()));
    const body = orderBody(cat) as any;
    body.items[0].quantity = 1;
    const results = await Promise.allSettled(users.map((u) => createOrder(String(u.user._id), body)));
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(5);
    expect(failed.every((f) => f.reason.code === 'INSUFFICIENT_STOCK')).toBe(true);
    expect((await InventoryItem.findOne({ name: 'Dough' }))!.stock).toBe(0);
    expect(await Order.countDocuments()).toBe(5);
    // failed attempts must not leak partial reservations of other ingredients
    expect((await InventoryItem.findOne({ name: 'Cheese' }))!.stock).toBe(10000 - 5 * 80);
    expect((await InventoryItem.findOne({ name: 'Box' }))!.stock).toBe(500 - 5);
  });
  it('rolls back every ingredient when one is short', async () => {
    const cat = await seedCatalog(100);
    await InventoryItem.updateOne({ name: 'Cheese' }, { $set: { stock: 10 } }); // needs 80
    const u = await createUser();
    await expect(createOrder(String(u.user._id), orderBody(cat) as any)).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect((await InventoryItem.findOne({ name: 'Dough' }))!.stock).toBe(100);
    expect((await InventoryItem.findOne({ name: 'Box' }))!.stock).toBe(500);
    expect(await InventoryTransaction.countDocuments()).toBe(0);
  });
  it('release is idempotent: repeating it restores stock only once', async () => {
    const cat = await seedCatalog(100);
    const orderId = new Types.ObjectId();
    const reqs = [{ item: cat.dough._id, quantity: 4 }];
    await reserveStock(orderId, reqs, 0);
    expect((await InventoryItem.findById(cat.dough._id))!.stock).toBe(96);
    await releaseStock(orderId, reqs, 0);
    await releaseStock(orderId, reqs, 0);
    expect((await InventoryItem.findById(cat.dough._id))!.stock).toBe(100);
  });
});

describe('low-stock alerts', () => {
  const make = (stock: number, threshold = 100) => InventoryItem.create({ name: 'Cheese', category: 'cheese', unit: 'g', stock, lowStockThreshold: threshold });

  it('does nothing while stock is healthy', async () => {
    await make(500);
    expect(await evaluateLowStock()).toMatchObject({ sent: 0 });
    expect(mail).not.toHaveBeenCalled();
  });
  it('alerts once when crossing the threshold and not on every scheduled run', async () => {
    const item = await make(50);
    const first = await evaluateLowStock();
    expect(first).toMatchObject({ sent: 1, delivered: true });
    expect(mail).toHaveBeenCalledTimes(1);
    expect(mail.mock.calls[0][0]).toMatchObject({ to: 'admin@example.test' });
    expect(mail.mock.calls[0][0].text).toContain('Cheese: 50 g left');
    await evaluateLowStock();
    await evaluateLowStock();
    expect(mail).toHaveBeenCalledTimes(1);
    expect((await InventoryItem.findById(item._id))!.lowStockNotified).toBe(true);
  });
  it('re-arms after restock and alerts again on the next drop', async () => {
    const item = await make(50);
    await evaluateLowStock();
    await InventoryItem.updateOne({ _id: item._id }, { $set: { stock: 500 } });
    await evaluateLowStock(); // resets state, no email
    expect((await InventoryItem.findById(item._id))!.lowStockNotified).toBe(false);
    expect(mail).toHaveBeenCalledTimes(1);
    await InventoryItem.updateOne({ _id: item._id }, { $set: { stock: 20 } });
    await evaluateLowStock();
    expect(mail).toHaveBeenCalledTimes(2);
  });
  it('concurrent evaluations send a single email (atomic claim)', async () => {
    await make(10);
    await Promise.all([evaluateLowStock(), evaluateLowStock(), evaluateLowStock()]);
    expect(mail).toHaveBeenCalledTimes(1);
  });
  it('does not mark an undelivered alert as sent and retries on the next run', async () => {
    const item = await make(10);
    mail.mockResolvedValueOnce({ delivered: false, mode: 'preview' });
    expect(await evaluateLowStock()).toMatchObject({ sent: 0, delivered: false });
    expect((await InventoryItem.findById(item._id))!.lowStockNotified).toBe(false);
    expect(await evaluateLowStock()).toMatchObject({ sent: 1, delivered: true });
  });
  it('survives an SMTP failure without throwing and retries later', async () => {
    const item = await make(10);
    mail.mockRejectedValueOnce(new Error('SMTP down'));
    await expect(evaluateLowStock()).resolves.toMatchObject({ sent: 0 });
    expect((await InventoryItem.findById(item._id))!.lowStockNotified).toBe(false);
    expect(await evaluateLowStock()).toMatchObject({ sent: 1 });
  });
  it('triggers immediately after an admin adjustment', async () => {
    const item = await make(500);
    await request(app).post(`/api/admin/inventory/${item._id}/adjustments`).set(admin.auth).send({ change: -450, reason: 'Waste' });
    expect(mail).toHaveBeenCalledTimes(1);
  });
  it('ignores inactive items', async () => {
    await InventoryItem.create({ name: 'Old', category: 'other', unit: 'unit', stock: 0, lowStockThreshold: 5, active: false });
    await evaluateLowStock();
    expect(mail).not.toHaveBeenCalled();
  });
});

describe('dashboard', () => {
  it('aggregates orders, revenue (paid, non-cancelled only) and low stock', async () => {
    const cat = await seedCatalog();
    const u = await createUser();
    const mk = async (status: string, pay: string, total: number) => {
      const r = await createOrder(String(u.user._id), { ...(orderBody(cat) as any), delivery });
      await Order.updateOne({ _id: r.order.id }, { $set: { orderStatus: status, paymentStatus: pay, total, paidAt: pay === 'paid' ? new Date() : undefined } });
    };
    await mk('received', 'paid', 10000);
    await mk('kitchen', 'paid', 20000);
    await mk('cancelled', 'paid', 99999); // refund pending: excluded from revenue
    await mk('pending_payment', 'pending', 55555); // unpaid: excluded
    await InventoryItem.updateOne({ name: 'Box' }, { $set: { stock: 5 } }); // below threshold 20
    const res = await request(app).get('/api/admin/dashboard?days=7').set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.orders).toMatchObject({ total: 3, awaitingProcessing: 1, inKitchen: 1, cancelledPaid: 1, pendingPayment: 1 });
    expect(res.body.data.revenue).toMatchObject({ periodAmount: 30000, periodOrders: 2, periodDays: 7, currency: 'INR' });
    expect(res.body.data.inventory.lowStockCount).toBeGreaterThanOrEqual(1);
  });
});
