import { Router } from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { adminLoginSchema } from '../dtos/auth.dto.js';
import { itemUpsertSchema, queryAdminItemsSchema, updateItemStatusSchema } from '../dtos/item.dto.js';
import { updateSettingsSchema } from '../dtos/setting.dto.js';

const router = Router();

router.post('/auth/login', validate({ body: adminLoginSchema }), (req, res, next) =>
  adminController.login(req, res, next)
);
router.post('/auth/logout', (req, res, next) => adminController.logout(req, res, next));

router.use(requireAdminAuth);

router.get('/items', validate({ query: queryAdminItemsSchema }), (req, res, next) =>
  adminController.getItems(req, res, next)
);
router.post('/items', validate({ body: itemUpsertSchema }), (req, res, next) =>
  adminController.createItem(req, res, next)
);
router.get('/items/:id', (req, res, next) => adminController.getItem(req, res, next));
router.put('/items/:id', validate({ body: itemUpsertSchema }), (req, res, next) =>
  adminController.updateItem(req, res, next)
);
router.patch('/items/:id/status', validate({ body: updateItemStatusSchema }), (req, res, next) =>
  adminController.updateItemStatus(req, res, next)
);

router.get('/orders', (req, res, next) => adminController.getOrders(req, res, next));
router.get('/orders/:id', (req, res, next) => adminController.getOrderDetail(req, res, next));
router.post('/orders/:id/confirm', (req, res, next) => adminController.confirmOrder(req, res, next));
router.post('/orders/:id/confirm-deposit', (req, res, next) =>
  adminController.confirmDeposit(req, res, next)
);
router.post('/orders/:id/ship', (req, res, next) => adminController.shipOrder(req, res, next));
router.post('/orders/:id/complete', (req, res, next) => adminController.completeOrder(req, res, next));
router.post('/orders/:id/return', (req, res, next) => adminController.returnOrder(req, res, next));
router.post('/orders/:id/cancel', (req, res, next) => adminController.cancelOrder(req, res, next));

router.get('/cash-flow/summary', (req, res, next) => adminController.getCashFlowSummary(req, res, next));
router.get('/batches', (req, res, next) => adminController.getBatches(req, res, next));
router.post('/batches', (req, res, next) => adminController.createBatch(req, res, next));
router.get('/settings', (req, res, next) => adminController.getSettings(req, res, next));
router.put('/settings', validate({ body: updateSettingsSchema }), (req, res, next) =>
  adminController.updateSettings(req, res, next)
);

export default router;
