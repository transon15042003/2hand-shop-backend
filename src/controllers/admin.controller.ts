import { Request, Response, NextFunction } from 'express';
import { adminService } from '../services/admin.service.js';
import { HttpStatus, ErrorCode } from '../constants/http-status.js';
import { appConfig } from '../configs/app.config.js';
import { clearAdminSessionCookie, setAdminSessionCookie } from '../utils/session-cookie.util.js';

export class AdminController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { password } = req.body;
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      if (password !== adminPassword && password !== appConfig.adminSessionToken) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          code: ErrorCode.INVALID_CREDENTIALS,
          message: 'Mật khẩu quản trị không đúng',
        });
      }

      setAdminSessionCookie(res, appConfig.adminSessionToken);

      return res.status(HttpStatus.OK).json({
        token: appConfig.adminSessionToken,
        user: {
          role: 'admin',
          name: 'Chủ shop / Quản trị viên',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      clearAdminSessionCookie(res);
      return res.status(HttpStatus.OK).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async getItems(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, category, batch_id, search, limit, offset } = req.query as any;
      const result = await adminService.getAdminItems({
        status,
        category,
        batchId: batch_id,
        search,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      });
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      next(error);
    }
  }

  async createItem(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await adminService.createItem(req.body);
      return res.status(HttpStatus.CREATED).json(item);
    } catch (error) {
      next(error);
    }
  }

  async updateItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const item = await adminService.updateItem(id, req.body);
      return res.status(HttpStatus.OK).json(item);
    } catch (error) {
      next(error);
    }
  }

  async getOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, limit, offset } = req.query as any;
      const result = await adminService.getAdminOrders({
        status,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      });
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getOrderDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const order = await adminService.getOrderDetail(id);
      return res.status(HttpStatus.OK).json(order);
    } catch (error) {
      next(error);
    }
  }

  async confirmOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { shipping_fee } = req.body;
      const order = await adminService.confirmOrder(id, shipping_fee);
      return res.status(HttpStatus.OK).json(order);
    } catch (error) {
      next(error);
    }
  }

  async confirmDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { transaction_id } = req.body;
      const order = await adminService.confirmDeposit(id, transaction_id);
      return res.status(HttpStatus.OK).json(order);
    } catch (error) {
      next(error);
    }
  }

  async shipOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { carrier_name, tracking_code, actual_shipping_cost } = req.body;
      const order = await adminService.markAsShipping(id, carrier_name, tracking_code, actual_shipping_cost);
      return res.status(HttpStatus.OK).json(order);
    } catch (error) {
      next(error);
    }
  }

  async completeOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const order = await adminService.completeOrder(id);
      return res.status(HttpStatus.OK).json(order);
    } catch (error) {
      next(error);
    }
  }

  async returnOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { refund_amount, reason } = req.body;
      const order = await adminService.processReturn(id, refund_amount, reason);
      return res.status(HttpStatus.OK).json(order);
    } catch (error) {
      next(error);
    }
  }

  async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const order = await adminService.cancelOrder(id, reason);
      return res.status(HttpStatus.OK).json(order);
    } catch (error) {
      next(error);
    }
  }

  async getCashFlowSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await adminService.getCashFlowSummary();
      return res.status(HttpStatus.OK).json(summary);
    } catch (error) {
      next(error);
    }
  }

  async getBatches(req: Request, res: Response, next: NextFunction) {
    try {
      const batchList = await adminService.getBatches();
      return res.status(HttpStatus.OK).json({ batches: batchList });
    } catch (error) {
      next(error);
    }
  }

  async createBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const batch = await adminService.createBatch(req.body);
      return res.status(HttpStatus.CREATED).json(batch);
    } catch (error) {
      next(error);
    }
  }

  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await adminService.getSettings();
      return res.status(HttpStatus.OK).json(settings);
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await adminService.updateSettings(req.body);
      return res.status(HttpStatus.OK).json(settings);
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
