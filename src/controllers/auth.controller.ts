import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { HttpStatus, SESSION_COOKIE_NAME } from '../constants/http-status.js';
import { AuthenticatedRequest } from '../interfaces/index.js';
import { clearCustomerSessionCookie, setCustomerSessionCookie } from '../utils/session-cookie.util.js';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      if (result.token) {
        setCustomerSessionCookie(res, result.token);
      }
      return res.status(HttpStatus.CREATED).json(result);
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, code } = req.body;
      const result = await authService.verifyEmail(email, code);
      setCustomerSessionCookie(res, result.token);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      next(error);
    }
  }

  async resendCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const result = await authService.resendCode(email);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { identifier, password } = req.body;
      const result = await authService.login(identifier, password);
      setCustomerSessionCookie(res, result.token);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.[SESSION_COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
      const result = await authService.logout(token);
      clearCustomerSessionCookie(res);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      next(error);
    }
  }

  async logoutAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await authService.logoutAll(req.customer!.id);
      clearCustomerSessionCookie(res);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.customer) {
        return res.status(HttpStatus.OK).json({ customer: null });
      }
      const customer = await authService.getProfile(req.customer.id);
      return res.status(HttpStatus.OK).json({ customer });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const customer = await authService.getProfile(req.customer!.id);
      return res.status(HttpStatus.OK).json(customer);
    } catch (error) {
      next(error);
    }
  }

  async updateMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const customer = await authService.updateProfile(req.customer!.id, req.body);
      return res.status(HttpStatus.OK).json(customer);
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { current_password, new_password } = req.body;
      const result = await authService.changePassword(
        req.customer!.id,
        current_password,
        new_password,
        req.sessionToken!
      );
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
