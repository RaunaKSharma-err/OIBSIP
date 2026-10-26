import { Router } from 'express';
import * as c from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { loginLimiter, passwordLimiter, registerLimiter } from '../middleware/rateLimit';
import { requireTrustedOrigin } from '../middleware/trustedOrigin';
import { validate } from '../middleware/validate';
import * as v from '../validators/auth.validators';

const r = Router();
r.post('/register', registerLimiter, validate({ body: v.registerBody }), c.register);
r.post('/verify-email', passwordLimiter, validate({ body: v.tokenBody }), c.verifyEmail);
r.post('/resend-verification', passwordLimiter, validate({ body: v.emailBody }), c.resendVerification);
r.post('/login', loginLimiter, validate({ body: v.loginBody }), c.login);
r.post('/refresh', loginLimiter, requireTrustedOrigin, c.refresh);
r.post('/logout', requireTrustedOrigin, c.logout);
r.get('/me', authenticate, c.me);
r.post('/forgot-password', passwordLimiter, validate({ body: v.emailBody }), c.forgotPassword);
r.post('/reset-password', passwordLimiter, validate({ body: v.resetPasswordBody }), c.resetPassword);
export default r;
