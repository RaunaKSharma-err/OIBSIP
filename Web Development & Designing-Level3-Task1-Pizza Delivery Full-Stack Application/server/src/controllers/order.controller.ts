import * as orders from '../services/order.service';
import { ApiError } from '../utils/apiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendOk, sendPaginated } from '../utils/response';
import { idempotencyHeader } from '../validators/order.validators';

export const create = asyncHandler(async (req, res) => {
  const raw = req.header('Idempotency-Key');
  let key: string | undefined;
  if (raw !== undefined) {
    const p = idempotencyHeader.safeParse(raw);
    if (!p.success) throw ApiError.badRequest('INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key must be 8-100 URL-safe characters');
    key = p.data;
  }
  const { order, created } = await orders.createOrder(req.user!.id, req.validated.body, key);
  sendOk(res, { order, idempotentReplay: !created }, created ? 201 : 200);
});

export const listMine = asyncHandler(async (req, res) => {
  const r = await orders.listMyOrders(req.user!.id, req.validated.query);
  sendPaginated(res, r.data, r.pagination);
});
export const getMine = asyncHandler(async (req, res) => {
  sendOk(res, { order: await orders.getMyOrder(req.user!.id, req.validated.params.id) });
});
export const cancelMine = asyncHandler(async (req, res) => {
  sendOk(res, { order: await orders.customerCancelOrder(req.user!.id, req.validated.params.id, req.validated.body?.reason) });
});
