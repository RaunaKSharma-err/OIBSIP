import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { InventoryItem } from '../src/models/InventoryItem';
import { Order } from '../src/models/Order';
import { expireStaleReservations } from '../src/services/order.service';
import { clearDb, startDb, stopDb } from './helpers/db';
import { EXPECTED, createUser, orderBody, seedCatalog } from './helpers/factories';

vi.mock('../src/utils/email', () => ({ sendMail: vi.fn(async () => ({ delivered: true, mode: 'smtp' })) }));

const app = createApp();
let cat: Awaited<ReturnType<typeof seedCatalog>>;

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  cat = await seedCatalog();
});
const stock = async (name: string) => (await InventoryItem.findOne({ name }))!.stock;

describe('catalog', () => {
  it('lists pizzas with the documented pagination envelope', async () => {
    const res = await request(app).get('/api/pizzas?limit=1&page=2&sort=price_asc');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, pagination: { page: 2, limit: 1, total: 2, totalPages: 2 } });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].options.bases.length).toBeGreaterThan(0);
  });
  it('filters by search and rejects invalid query values', async () => {
    expect((await request(app).get('/api/pizzas?search=spicy')).body.data).toHaveLength(1);
    expect((await request(app).get('/api/pizzas?limit=1000')).status).toBe(400);
    expect((await request(app).get('/api/pizzas?category=bogus')).status).toBe(400);
  });
  it('handles malformed and unknown ids', async () => {
    expect((await request(app).get('/api/pizzas/not-an-id')).status).toBe(400);
    const missing = await request(app).get('/api/pizzas/aaaaaaaaaaaaaaaaaaaaaaaa');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('PIZZA_NOT_FOUND');
  });
  it('lists options by type', async () => {
    const res = await request(app).get('/api/pizza-options?type=base');
    expect(res.body.data.map((o: any) => o.name).sort()).toEqual(['Classic', 'Thin']);
  });
});

describe('order creation and pricing', () => {
  it('prices on the server and reserves stock', async () => {
    const u = await createUser();
    const res = await request(app).post('/api/orders').set(u.auth).send(orderBody(cat));
    expect(res.status).toBe(201);
    const o = res.body.data.order;
    expect(o).toMatchObject({ ...EXPECTED, orderStatus: 'pending_payment', paymentStatus: 'pending' });
    expect(o.items[0].unitPrice).toBe(29000);
    expect(await stock('Dough')).toBe(98);
    expect(await stock('Cheese')).toBe(10000 - 160);
    expect(await stock('Box')).toBe(498);
  });
  it('rejects client-supplied totals / prices / status (mass assignment)', async () => {
    const u = await createUser();
    const res = await request(app).post('/api/orders').set(u.auth).send(orderBody(cat, { total: 1, orderStatus: 'received' }));
    expect(res.status).toBe(400);
  });
  it('requires authentication', async () => {
    const res = await request(app).post('/api/orders').send(orderBody(cat));
    expect(res.status).toBe(401);
  });
  it('rejects options that are not offered for the chosen pizza', async () => {
    const u = await createUser();
    const body = orderBody(cat);
    (body.items[0] as any).toppingIds = [String(cat.jalapeno._id)];
    const res = await request(app).post('/api/orders').set(u.auth).send(body);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_CUSTOMIZATION');
    expect(await stock('Dough')).toBe(100);
  });
  it('rejects unavailable pizzas and unknown pizza ids', async () => {
    const u = await createUser();
    await cat.pizza.updateOne({ available: false });
    expect((await request(app).post('/api/orders').set(u.auth).send(orderBody(cat))).body.error.code).toBe('PIZZA_UNAVAILABLE');
    const b = orderBody(cat);
    (b.items[0] as any).pizzaId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    expect((await request(app).post('/api/orders').set(u.auth).send(b)).status).toBe(404);
  });
  it('honours Idempotency-Key: replays return the same order and reserve stock once', async () => {
    const u = await createUser();
    const send = () => request(app).post('/api/orders').set(u.auth).set('Idempotency-Key', 'key-abcdef123').send(orderBody(cat));
    const a = await send();
    const b = await send();
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.body.data.order.id).toBe(a.body.data.order.id);
    expect(b.body.data.idempotentReplay).toBe(true);
    expect(await stock('Dough')).toBe(98);
  });
  it('keeps historical snapshots when menu prices change', async () => {
    const u = await createUser();
    const res = await request(app).post('/api/orders').set(u.auth).send(orderBody(cat));
    await cat.pizza.updateOne({ basePrice: 99999 });
    const again = await request(app).get(`/api/orders/${res.body.data.order.id}`).set(u.auth);
    expect(again.body.data.order.items[0].pizzaBasePrice).toBe(20000);
    expect(again.body.data.order.total).toBe(EXPECTED.total);
  });
});

describe('ownership and lifecycle', () => {
  it("never exposes another customer's order", async () => {
    const a = await createUser();
    const b = await createUser();
    const created = await request(app).post('/api/orders').set(a.auth).send(orderBody(cat));
    const id = created.body.data.order.id;
    expect((await request(app).get(`/api/orders/${id}`).set(b.auth)).status).toBe(404);
    expect((await request(app).post(`/api/orders/${id}/cancel`).set(b.auth).send({})).status).toBe(404);
    expect((await request(app).get('/api/orders/my').set(b.auth)).body.pagination.total).toBe(0);
    expect((await request(app).get('/api/orders/my').set(a.auth)).body.pagination.total).toBe(1);
  });
  it('lets the customer cancel an unpaid order and returns the stock', async () => {
    const u = await createUser();
    const created = await request(app).post('/api/orders').set(u.auth).send(orderBody(cat));
    const res = await request(app).post(`/api/orders/${created.body.data.order.id}/cancel`).set(u.auth).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.order.orderStatus).toBe('cancelled');
    expect(await stock('Dough')).toBe(100);
    expect((await request(app).post(`/api/orders/${created.body.data.order.id}/cancel`).set(u.auth).send({})).status).toBe(409);
    expect(await stock('Dough')).toBe(100); // released exactly once
  });
  it('expires unpaid reservations and releases stock', async () => {
    const u = await createUser();
    const created = await request(app).post('/api/orders').set(u.auth).send(orderBody(cat));
    await Order.updateOne({ _id: created.body.data.order.id }, { $set: { 'inventory.reservedUntil': new Date(Date.now() - 1000) } });
    expect(await expireStaleReservations()).toMatchObject({ expired: 1 });
    expect(await expireStaleReservations()).toMatchObject({ expired: 0 });
    expect(await stock('Dough')).toBe(100);
    expect((await Order.findById(created.body.data.order.id))!.cancellation!.reason).toBe('PAYMENT_WINDOW_EXPIRED');
  });
});

describe('admin order status', () => {
  it('rejects invalid transitions and unpaid fulfilment, allows valid ones', async () => {
    const admin = await createUser({ role: 'admin' });
    const u = await createUser();
    const created = await request(app).post('/api/orders').set(u.auth).send(orderBody(cat));
    const id = created.body.data.order.id;
    const patch = (status: string) => request(app).patch(`/api/admin/orders/${id}/status`).set(admin.auth).send({ status });

    expect((await patch('received')).body.error.code).toBe('INVALID_STATUS_TRANSITION'); // payment-only
    expect((await patch('kitchen')).body.error.code).toBe('INVALID_STATUS_TRANSITION');

    await Order.updateOne({ _id: id }, { $set: { orderStatus: 'received', paymentStatus: 'paid', paidAt: new Date(), 'inventory.state': 'committed' } });
    expect((await patch('delivery')).status).toBe(409); // cannot skip kitchen
    expect((await patch('kitchen')).status).toBe(200);
    expect((await patch('delivery')).status).toBe(200);
    const done = await patch('delivered');
    expect(done.body.data.order.statusHistory.map((h: any) => h.status)).toEqual(['pending_payment', 'kitchen', 'delivery', 'delivered']);
    expect((await patch('cancelled')).status).toBe(409);

    const mine = await request(app).get(`/api/orders/${id}`).set(u.auth);
    expect(mine.body.data.order.orderStatus).toBe('delivered'); // customer sees latest persisted status
  });
  it('filters and paginates the admin order list', async () => {
    const admin = await createUser({ role: 'admin' });
    const u = await createUser();
    await request(app).post('/api/orders').set(u.auth).send(orderBody(cat));
    const res = await request(app).get('/api/admin/orders?status=pending_payment&paymentStatus=pending').set(admin.auth);
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.data[0].customer.email).toBe(u.user.email);
    expect((await request(app).get('/api/admin/orders?status=bogus').set(admin.auth)).status).toBe(400);
  });
});
