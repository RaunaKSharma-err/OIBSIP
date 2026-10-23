import { Router } from 'express';
import * as c from '../controllers/payment.controller';
import { authenticate, requireVerifiedEmail } from '../middleware/auth';
import { paymentLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { createPaymentOrderBody, verifyPaymentBody } from '../validators/payment.validators';

const r = Router();
r.use(authenticate, requireVerifiedEmail, paymentLimiter);
r.post('/create-order', validate({ body: createPaymentOrderBody }), c.createOrder);
r.post('/verify', validate({ body: verifyPaymentBody }), c.verify);
export default r;
