import { Router } from 'express';
import { itemController } from '../controllers/item.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { queryPublicItemsSchema } from '../dtos/item.dto.js';

const router = Router();

router.get('/', validate({ query: queryPublicItemsSchema }), (req, res, next) =>
  itemController.getItems(req, res, next)
);
router.get('/:id', (req, res, next) => itemController.getItemDetail(req, res, next));

export default router;
