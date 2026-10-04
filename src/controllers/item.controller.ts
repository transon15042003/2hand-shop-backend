import { Request, Response, NextFunction } from 'express';
import { itemService } from '../services/item.service.js';
import { HttpStatus } from '../constants/http-status.js';

export class ItemController {
  async getItems(req: Request, res: Response, next: NextFunction) {
    try {
      const { category, condition, page, limit, sort } = req.query as any;
      const result = await itemService.getPublicItems({
        category,
        condition,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        sort,
      });
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getItemDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const item = await itemService.getPublicItemDetail(id);
      return res.status(HttpStatus.OK).json(item);
    } catch (error) {
      next(error);
    }
  }
}

export const itemController = new ItemController();
