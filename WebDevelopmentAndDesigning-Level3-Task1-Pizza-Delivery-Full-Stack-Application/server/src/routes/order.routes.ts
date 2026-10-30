import { Router } from 'express';
import * as c from '../controllers/order.controller';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import { cancelBody, createOrderBody, myOrdersQuery } from '../validators/order.validators';

const r = Router();
r.use(authenticate);
r.post('/', validate({ body: createOrderBody }), c.create);
r.get('/my', validate({ query: myOrdersQuery }), c.listMine);
r.get('/:id', validate({ params: idParam }), c.getMine);
r.post('/:id/cancel', validate({ params: idParam, body: cancelBody }), c.cancelMine);
export default r;
