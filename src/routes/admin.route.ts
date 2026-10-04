import { Router } from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { adminLoginSchema } from '../dtos/auth.dto.js';
import { createItemSchema, updateItemSchema } from '../dtos/item.dto.js';
import { updateSettingsSchema } from '../dtos/setting.dto.js';

const router = Router();

// Admin auth
router.post('/auth/login', validate({ body: adminLoginSchema }), adminController.login);
router.post('/auth/logout', adminController.logout);

// Protected admin routes
router.use(requireAdminAuth);

// Items
router.get('/items', adminController.getItems);
router.post('/items', validate({ body: createItemSchema }), adminController.createItem);
router.put('/items/:id', validate({ body: updateItemSchema }), adminController.updateItem);

// Orders
router.get('/orders', adminController.getOrders);
router.get('/orders/:id', adminController.getOrderDetail);
router.post('/orders/:id/confirm', adminController.confirmOrder);
router.post('/orders/:id/confirm-deposit', adminController.confirmDeposit);
router.post('/orders/:id/ship', adminController.shipOrder);
router.post('/orders/:id/complete', adminController.completeOrder);
router.post('/orders/:id/return', adminController.returnOrder);
router.post('/orders/:id/cancel', adminController.cancelOrder);

// Cash flow
router.get('/cash-flow/summary', adminController.getCashFlowSummary);

// Batches
router.get('/batches', adminController.getBatches);
router.post('/batches', adminController.createBatch);

// Settings
router.get('/settings', adminController.getSettings);
router.put('/settings', validate({ body: updateSettingsSchema }), adminController.updateSettings);

export default router;
