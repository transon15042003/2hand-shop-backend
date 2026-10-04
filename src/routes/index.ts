import { Router } from 'express';
import authRoutes from './auth.route.js';
import itemRoutes from './item.route.js';
import orderRoutes from './order.route.js';
import settingRoutes from './setting.route.js';
import adminRoutes from './admin.route.js';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
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
