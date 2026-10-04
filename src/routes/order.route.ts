import { Router } from 'express';
import { orderController } from '../controllers/order.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { optionalCustomerAuth } from '../middlewares/auth.middleware.js';
import {
  createOrderSchema,
  cancelOrderSchema,
  extendHoldSchema,
} from '../dtos/order.dto.js';

const router = Router();

router.post('/', optionalCustomerAuth, validate({ body: createOrderSchema }), orderController.createOrder);
router.get('/track', orderController.trackOrder);
router.get('/deposit-check', orderController.checkDeposit);
router.post('/:code/extend', validate({ body: extendHoldSchema }), orderController.extendHold);
router.post('/:code/cancel', validate({ body: cancelOrderSchema }), orderController.cancelOrder);

export default router;
