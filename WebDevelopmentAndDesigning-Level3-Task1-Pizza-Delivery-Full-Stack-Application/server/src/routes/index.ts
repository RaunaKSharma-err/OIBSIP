import { Router } from 'express';
import * as health from '../controllers/health.controller';
import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import { optionRoutes, pizzaRoutes } from './catalog.routes';
import orderRoutes from './order.routes';
import paymentRoutes from './payment.routes';

const r = Router();
r.get('/health', health.live);
r.get('/health/ready', health.ready);
r.use('/auth', authRoutes);
r.use('/pizzas', pizzaRoutes);
r.use('/pizza-options', optionRoutes);
r.use('/orders', orderRoutes);
r.use('/payments', paymentRoutes);
r.use('/admin', adminRoutes);
export default r;
