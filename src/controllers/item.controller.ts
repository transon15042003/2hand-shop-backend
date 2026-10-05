import { Request, Response, NextFunction } from 'express';
import { itemService } from '../services/item.service.js';
import { HttpStatus } from '../constants/http-status.js';

export class ItemController {
  async getItems(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await itemService.getPublicItems(req.query as any);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getItemDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await itemService.getPublicItemDetail(req.params.id);
      return res.status(HttpStatus.OK).json(item);
    } catch (error) {
      next(error);
    }
  }
}

export const itemController = new ItemController();
