import { Router } from 'express';
import * as c from '../controllers/admin.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import * as iv from '../validators/inventory.validators';
import { adminOrdersQuery, updateStatusBody } from '../validators/order.validators';

const r = Router();
r.use(authenticate, requireRole('admin'));

r.get('/dashboard', validate({ query: iv.dashboardQuery }), c.getDashboard);

r.get('/orders', validate({ query: adminOrdersQuery }), c.listOrders);
r.get('/orders/:id', validate({ params: idParam }), c.getOrder);
r.patch('/orders/:id/status', validate({ params: idParam, body: updateStatusBody }), c.updateOrderStatus);

r.get('/inventory', validate({ query: iv.listInventoryQuery }), c.listInventory);
r.post('/inventory', validate({ body: iv.createInventoryBody }), c.createInventory);
r.get('/inventory/:id', validate({ params: idParam }), c.getInventory);
r.patch('/inventory/:id', validate({ params: idParam, body: iv.updateInventoryBody }), c.updateInventory);
r.post('/inventory/:id/adjustments', validate({ params: idParam, body: iv.adjustmentBody }), c.adjustInventory);
r.get('/inventory/:id/transactions', validate({ params: idParam, query: iv.transactionsQuery }), c.inventoryHistory);
export default r;
