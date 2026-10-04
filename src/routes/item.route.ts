import { Router } from 'express';
import { itemController } from '../controllers/item.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { queryItemsSchema } from '../dtos/item.dto.js';

const router = Router();

router.get('/', validate({ query: queryItemsSchema }), itemController.getItems);
router.get('/:id', itemController.getItemDetail);

export default router;
