import { Request, Response, NextFunction } from 'express';
import { adminService } from '../services/admin.service.js';
import { adminAuthService } from '../services/admin-auth.service.js';
import { HttpStatus, ErrorCode } from '../constants/http-status.js';
import { clearAdminSessionCookie, setAdminSessionCookie } from '../utils/session-cookie.util.js';
import { uploadService } from '../services/upload.service.js';
import { AppError } from '../middlewares/error.middleware.js';
import type { AuthenticatedRequest } from '../interfaces/index.js';

export class AdminController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;
      const result = await adminAuthService.login(username, password);
      setAdminSessionCookie(res, result.token);
      return res.status(HttpStatus.OK).json(result);
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

  async listAdmins(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await adminAuthService.listAdmins();
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      next(error);
    }
  }

  async createAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.admin) {
        throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
      }
      const created = await adminAuthService.createAdmin(req.admin, req.body);
      return res.status(HttpStatus.CREATED).json(created);
    } catch (error) {
      next(error);
    }
  }

  async updateAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.admin) {
        throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
      }
      const updated = await adminAuthService.updateAdmin(req.admin, req.params.id, req.body);
      return res.status(HttpStatus.OK).json(updated);
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.admin) {
        throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
      }
      return res.status(HttpStatus.OK).json({
        id: req.admin.id,
        username: req.admin.username,
        display_name: req.admin.displayName,
        role: req.admin.role,
        permissions: req.admin.permissions,
      });
    } catch (error) {
      next(error);
    }
  }

  async getItems(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.getAdminItems(req.query as any);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getItem(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await adminService.getAdminItem(req.params.id);
      return res.status(HttpStatus.OK).json(item);
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
      const item = await adminService.updateItem(req.params.id, req.body);
      return res.status(HttpStatus.OK).json(item);
    } catch (error) {
      next(error);
    }
  }

  async updateItemStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await adminService.updateItemStatus(req.params.id, req.body.status);
      return res.status(HttpStatus.OK).json(item);
    } catch (error) {
      next(error);
    }
  }

  async getOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const q = req.query as any;
      const result = await adminService.getAdminOrders({
        order_status: q.order_status,
        payment_status: q.payment_status,
        carrier_name: q.carrier_name,
        search: q.search,
        sort: q.sort,
        page: q.page,
        limit: q.limit,
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
      const { shipping_fee, note } = req.body;
      const order = await adminService.confirmOrder(id, shipping_fee, note);
      return res.status(HttpStatus.OK).json(order);
    } catch (error) {
      next(error);
    }
  }

  async markDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { note } = req.body ?? {};
      const order = await adminService.markDepositPaid(id, note);
      return res.status(HttpStatus.OK).json(order);
    } catch (error) {
      next(error);
    }
  }

  async fulfillOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { carrier_name, tracking_code, actual_shipping_cost, note } = req.body;
      const order = await adminService.fulfillOrder(
        id,
        carrier_name,
        tracking_code,
        actual_shipping_cost,
        note
      );
      return res.status(HttpStatus.OK).json(order);
    } catch (error) {
      next(error);
    }
  }

  async updateOrderStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, reason, return_shipping_fee } = req.body;
      const order = await adminService.updateOrderStatus(id, status, reason, return_shipping_fee);
      return res.status(HttpStatus.OK).json(order);
    } catch (error) {
      next(error);
    }
  }

  async extendHold(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { minutes } = req.body;
      const order = await adminService.extendHold(id, minutes);
      return res.status(HttpStatus.OK).json(order);
    } catch (error) {
      next(error);
    }
  }

  async updatePayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { payment_status, note } = req.body;
      const order = await adminService.updatePaymentStatus(id, payment_status, note);
      return res.status(HttpStatus.OK).json(order);
    } catch (error) {
      next(error);
    }
  }

  async getCashFlowSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const period = (req.query.period as 'day' | 'week' | 'month') || 'week';
      const summary = await adminService.getCashFlowSummary(period);
      return res.status(HttpStatus.OK).json(summary);
    } catch (error) {
      next(error);
    }
  }

  async listReconciliations(req: Request, res: Response, next: NextFunction) {
    try {
      const sessions = await adminService.listReconciliations();
      return res.status(HttpStatus.OK).json(sessions);
    } catch (error) {
      next(error);
    }
  }

  async createReconciliation(req: Request, res: Response, next: NextFunction) {
    try {
      const session = await adminService.createReconciliation(req.body);
      return res.status(HttpStatus.CREATED).json(session);
    } catch (error) {
      next(error);
    }
  }

  async getBatches(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.getBatches();
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getBatchDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const batch = await adminService.getBatchDetail(req.params.id);
      return res.status(HttpStatus.OK).json(batch);
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

  async uploadImage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new AppError('Thiếu file ảnh (trường `file`).', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED);
      }
      const result = await uploadService.storeItemImage(req.file);
      return res.status(HttpStatus.CREATED).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
