import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { HttpStatus, SESSION_COOKIE_NAME } from '../constants/http-status.js';
import { appConfig } from '../configs/app.config.js';
import { AuthenticatedRequest } from '../interfaces/index.js';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      return res.status(HttpStatus.CREATED).json(result);
    } catch (error) {
      next(error);
    }
  }

  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, otp } = req.body;
      const result = await authService.verifyOtp(email, otp);

      if (result.sessionToken) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 400);

        res.cookie(SESSION_COOKIE_NAME, result.sessionToken, {
          httpOnly: true,
          secure: !appConfig.isDev,
          sameSite: 'lax',
          path: '/',
          expires: expiresAt,
        });
      }

      return res.status(HttpStatus.OK).json({
        message: 'Xác thực tài khoản thành công',
        customer: result.customer,
      });
    } catch (error) {
      next(error);
    }
  }

  async resendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const result = await authService.resendOtp(email);
      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { identifier, password } = req.body;
      const result = await authService.login(identifier, password);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 400);

      res.cookie(SESSION_COOKIE_NAME, result.sessionToken, {
        httpOnly: true,
        secure: !appConfig.isDev,
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
      });

      return res.status(HttpStatus.OK).json({
        message: 'Đăng nhập thành công',
        customer: result.customer,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies?.[SESSION_COOKIE_NAME];
      await authService.logout(token);

      res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: !appConfig.isDev,
        sameSite: 'lax',
        path: '/',
      });

      return res.status(HttpStatus.OK).json({ success: true, message: 'Đã đăng xuất' });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      return res.status(HttpStatus.OK).json({
        customer: req.customer,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
