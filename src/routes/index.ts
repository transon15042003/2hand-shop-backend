import { Router } from 'express';
import authRoutes from './auth.route.js';
import itemRoutes from './item.route.js';
import orderRoutes from './order.route.js';
import settingRoutes from './setting.route.js';
import adminRoutes from './admin.route.js';
import { pool } from '../configs/database.js';

const router = Router();

// Liveness — no DB (Render platform healthCheckPath; fast while spinning up).
router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness — SELECT 1 so keep-alive also warms Neon compute.
router.get('/ready', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

// V1 Routes
const v1Router = Router();
v1Router.use('/auth', authRoutes);
v1Router.use('/items', itemRoutes);
v1Router.use('/orders', orderRoutes);
v1Router.use('/settings', settingRoutes);
v1Router.use('/admin', adminRoutes);

// Mount both /api/v1 and direct /api for compatibility
router.use('/v1', v1Router);
router.use('/auth', authRoutes);
router.use('/items', itemRoutes);
router.use('/orders', orderRoutes);
router.use('/settings', settingRoutes);
router.use('/admin', adminRoutes);

export default router;
