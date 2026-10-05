import { Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.service.js';
import { HttpStatus } from '../constants/http-status.js';
import { AuthenticatedRequest } from '../interfaces/index.js';

export class OrderController {
  async createOrder(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await orderService.createOrder({
        ...req.body,
        customerId: req.customer?.id,
      });
      return res.status(HttpStatus.CREATED).json(result);
    } catch (error) {
      next(error);
    }
  }

  async trackOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { order_code, phone } = req.query as { order_code: string; phone: string };
      const order = await orderService.trackOrder(order_code, phone);
      return res.status(HttpStatus.OK).json(order);
    } catch (error) {
      next(error);
    }
  }

  async checkDeposit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { phone } = req.query as { phone: string };
      const result = await orderService.checkDepositRequirement(phone, req.customer?.id);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      next(error);
    }
  }

  async extendHold(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.params;
      const { minutes } = req.body;
      const result = await orderService.extendHold(code, minutes);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      next(error);
    }
  }

  async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.params;
      const reason = req.body.reason || 'Khách hủy đơn';
      const result = await orderService.cancelOrderByCustomer(code, reason);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const orderController = new OrderController();
