import { Router } from 'express';
import { orderController } from '../controllers/order.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { optionalCustomerAuth } from '../middlewares/auth.middleware.js';
import { createOrderRateLimiter } from '../middlewares/rate-limit.middleware.js';
import {
  createOrderSchema,
  cancelOrderSchema,
  extendHoldSchema,
  checkDepositSchema,
  trackOrderSchema,
} from '../dtos/order.dto.js';

const router = Router();

router.post(
  '/',
  createOrderRateLimiter,
  optionalCustomerAuth,
  validate({ body: createOrderSchema }),
  (req, res, next) => orderController.createOrder(req, res, next)
);
router.get('/track', validate({ query: trackOrderSchema }), (req, res, next) =>
  orderController.trackOrder(req, res, next)
);
router.get(
  '/deposit-check',
  optionalCustomerAuth,
  validate({ query: checkDepositSchema }),
  (req, res, next) => orderController.checkDeposit(req, res, next)
);
router.post('/:code/extend', validate({ body: extendHoldSchema }), (req, res, next) =>
  orderController.extendHold(req, res, next)
);
router.post('/:code/cancel', validate({ body: cancelOrderSchema }), (req, res, next) =>
  orderController.cancelOrder(req, res, next)
);

export default router;
