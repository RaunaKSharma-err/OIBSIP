import * as dashboard from '../services/dashboard.service';
import * as inventory from '../services/inventory.service';
import * as orders from '../services/order.service';
import { asyncHandler } from '../utils/asyncHandler';
import { sendOk, sendPaginated } from '../utils/response';

export const getDashboard = asyncHandler(async (req, res) => {
  sendOk(res, await dashboard.getDashboard(req.validated.query.days));
});

export const listOrders = asyncHandler(async (req, res) => {
  const r = await orders.adminListOrders(req.validated.query);
  sendPaginated(res, r.data, r.pagination);
});
export const getOrder = asyncHandler(async (req, res) => {
  sendOk(res, { order: await orders.adminGetOrder(req.validated.params.id) });
});
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.validated.body;
  sendOk(res, { order: await orders.adminUpdateStatus(req.validated.params.id, status, note, req.user!.id) });
});

export const listInventory = asyncHandler(async (req, res) => {
  const r = await inventory.listInventory(req.validated.query);
  sendPaginated(res, r.data, r.pagination);
});
export const getInventory = asyncHandler(async (req, res) => {
  sendOk(res, { item: await inventory.getInventoryItem(req.validated.params.id) });
});
export const createInventory = asyncHandler(async (req, res) => {
  sendOk(res, { item: await inventory.createInventoryItem(req.validated.body, req.user!.id) }, 201);
});
export const updateInventory = asyncHandler(async (req, res) => {
  sendOk(res, { item: await inventory.updateInventoryItem(req.validated.params.id, req.validated.body) });
});
export const adjustInventory = asyncHandler(async (req, res) => {
  const { change, reason } = req.validated.body;
  sendOk(res, { item: await inventory.adjustStock(req.validated.params.id, change, reason, req.user!.id) });
});
export const inventoryHistory = asyncHandler(async (req, res) => {
  const r = await inventory.listTransactions(req.validated.params.id, req.validated.query);
  sendPaginated(res, r.data, r.pagination);
});
