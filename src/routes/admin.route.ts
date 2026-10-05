import { Router } from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { requireAdminAuth, requirePermission } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { adminLoginSchema, createAdminSchema, updateAdminSchema } from '../dtos/auth.dto.js';
import { itemUpsertSchema, queryAdminItemsSchema, updateItemStatusSchema } from '../dtos/item.dto.js';
import { updateSettingsSchema } from '../dtos/setting.dto.js';
import { adminUploadMiddleware } from '../middlewares/upload.middleware.js';
import {
  adminOrdersQuerySchema,
  confirmOrderBodySchema,
  extendHoldBodySchema,
  fulfillOrderBodySchema,
  markDepositBodySchema,
  updateOrderStatusBodySchema,
  updatePaymentBodySchema,
} from '../dtos/admin-order.dto.js';
import {
  cashFlowSummaryQuerySchema,
  createBatchBodySchema,
  createReconciliationBodySchema,
} from '../dtos/batch.dto.js';
import { adminLoginRateLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

router.post(
  '/auth/login',
  adminLoginRateLimiter,
  validate({ body: adminLoginSchema }),
  (req, res, next) => adminController.login(req, res, next)
);
router.post('/auth/logout', (req, res, next) => adminController.logout(req, res, next));

router.use(requireAdminAuth);

router.get('/auth/me', (req, res, next) => adminController.getMe(req, res, next));

router.get('/admins', requirePermission('manage_admins'), (req, res, next) =>
  adminController.listAdmins(req, res, next)
);
router.post(
  '/admins',
  requirePermission('manage_admins'),
  validate({ body: createAdminSchema }),
  (req, res, next) => adminController.createAdmin(req, res, next)
);
router.patch(
  '/admins/:id',
  requirePermission('manage_admins'),
  validate({ body: updateAdminSchema }),
  (req, res, next) => adminController.updateAdmin(req, res, next)
);

router.get(
  '/items',
  requirePermission('items'),
  validate({ query: queryAdminItemsSchema }),
  (req, res, next) => adminController.getItems(req, res, next)
);
router.post('/items', requirePermission('items'), validate({ body: itemUpsertSchema }), (req, res, next) =>
  adminController.createItem(req, res, next)
);
router.get('/items/:id', requirePermission('items'), (req, res, next) =>
  adminController.getItem(req, res, next)
);
router.put(
  '/items/:id',
  requirePermission('items'),
  validate({ body: itemUpsertSchema }),
  (req, res, next) => adminController.updateItem(req, res, next)
);
router.patch(
  '/items/:id/status',
  requirePermission('items'),
  validate({ body: updateItemStatusSchema }),
  (req, res, next) => adminController.updateItemStatus(req, res, next)
);
router.post('/uploads', requirePermission('items'), adminUploadMiddleware, (req, res, next) =>
  adminController.uploadImage(req, res, next)
);

router.get(
  '/orders',
  requirePermission('orders'),
  validate({ query: adminOrdersQuerySchema }),
  (req, res, next) => adminController.getOrders(req, res, next)
);
router.get('/orders/:id', requirePermission('orders'), (req, res, next) =>
  adminController.getOrderDetail(req, res, next)
);
router.patch(
  '/orders/:id/confirm',
  requirePermission('orders'),
  validate({ body: confirmOrderBodySchema }),
  (req, res, next) => adminController.confirmOrder(req, res, next)
);
router.patch(
  '/orders/:id/fulfill',
  requirePermission('orders'),
  validate({ body: fulfillOrderBodySchema }),
  (req, res, next) => adminController.fulfillOrder(req, res, next)
);
router.patch(
  '/orders/:id/status',
  requirePermission('orders'),
  validate({ body: updateOrderStatusBodySchema }),
  (req, res, next) => adminController.updateOrderStatus(req, res, next)
);
router.patch(
  '/orders/:id/hold',
  requirePermission('orders'),
  validate({ body: extendHoldBodySchema }),
  (req, res, next) => adminController.extendHold(req, res, next)
);
router.patch(
  '/orders/:id/payment',
  requirePermission('orders'),
  validate({ body: updatePaymentBodySchema }),
  (req, res, next) => adminController.updatePayment(req, res, next)
);
router.patch(
  '/orders/:id/deposit',
  requirePermission('deposits'),
  validate({ body: markDepositBodySchema }),
  (req, res, next) => adminController.markDeposit(req, res, next)
);

router.get(
  '/cash-flow/summary',
  requirePermission('cash_flow'),
  validate({ query: cashFlowSummaryQuerySchema }),
  (req, res, next) => adminController.getCashFlowSummary(req, res, next)
);
router.get('/cash-flow/reconciliations', requirePermission('cash_flow'), (req, res, next) =>
  adminController.listReconciliations(req, res, next)
);
router.post(
  '/cash-flow/reconciliations',
  requirePermission('cash_flow'),
  validate({ body: createReconciliationBodySchema }),
  (req, res, next) => adminController.createReconciliation(req, res, next)
);

router.get('/batches', requirePermission('batches'), (req, res, next) =>
  adminController.getBatches(req, res, next)
);
router.post(
  '/batches',
  requirePermission('batches'),
  validate({ body: createBatchBodySchema }),
  (req, res, next) => adminController.createBatch(req, res, next)
);
router.get('/batches/:id', requirePermission('batches'), (req, res, next) =>
  adminController.getBatchDetail(req, res, next)
);

router.get('/settings', requirePermission('settings'), (req, res, next) =>
  adminController.getSettings(req, res, next)
);
router.put(
  '/settings',
  requirePermission('settings'),
  validate({ body: updateSettingsSchema }),
  (req, res, next) => adminController.updateSettings(req, res, next)
);

export default router;
