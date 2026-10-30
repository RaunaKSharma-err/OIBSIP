import { Router } from 'express';
import * as c from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';
import { paymentLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { initiatePaymentBody, paymentStatusQuery, verifyPaymentBody } from '../validators/payment.validators';

const r = Router();
r.use(authenticate, paymentLimiter);
r.post('/esewa/initiate', validate({ body: initiatePaymentBody }), c.initiate);
r.post('/esewa/verify', validate({ body: verifyPaymentBody }), c.verify);
r.get('/esewa/status', validate({ query: paymentStatusQuery }), c.status);
export default r;
