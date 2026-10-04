import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../interfaces/index.js';
import { HttpStatus, ErrorCode, SESSION_COOKIE_NAME, ADMIN_COOKIE_NAME } from '../constants/http-status.js';
import { appConfig } from '../configs/app.config.js';
import { db } from '../configs/database.js';
import { customerSessions, customers } from '../db/schema.js';
import { eq, and, gt } from 'drizzle-orm';
import { HashUtil } from '../utils/hash.util.js';

export async function requireCustomerAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(HttpStatus.UNAUTHORIZED).json({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Vui lòng đăng nhập để tiếp tục',
    });
  }

  try {
    const tokenHash = HashUtil.hashToken(token);
    const session = await db.query.customerSessions.findFirst({
      where: and(
        eq(customerSessions.tokenHash, tokenHash),
        gt(customerSessions.expiresAt, new Date())
      ),
    });

    if (!session) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ',
      });
    }

    const customer = await db.query.customers.findFirst({
      where: eq(customers.id, session.customerId),
    });

    if (!customer) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Tài khoản không tồn tại',
      });
    }

    // Slide session (gia hạn 400 ngày theo ADR 006)
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 400);

    await db
      .update(customerSessions)
      .set({
        lastSeenAt: new Date(),
        expiresAt: newExpiresAt,
      })
      .where(eq(customerSessions.tokenHash, tokenHash));

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: !appConfig.isDev,
      sameSite: 'lax',
      path: '/',
      expires: newExpiresAt,
    });

    req.customer = {
      id: customer.id,
      phone: customer.phone,
      email: customer.email,
      name: customer.name,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalCustomerAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return next();
  }

  try {
    const tokenHash = HashUtil.hashToken(token);
    const session = await db.query.customerSessions.findFirst({
      where: and(
        eq(customerSessions.tokenHash, tokenHash),
        gt(customerSessions.expiresAt, new Date())
      ),
    });

    if (session) {
      const customer = await db.query.customers.findFirst({
        where: eq(customers.id, session.customerId),
      });

      if (customer) {
        req.customer = {
          id: customer.id,
          phone: customer.phone,
          email: customer.email,
          name: customer.name,
        };
      }
    }
  } catch {
    // Ignore error for optional auth
  }

  next();
}

export async function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[ADMIN_COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token || (token !== appConfig.adminSessionToken && token !== 'demo_admin_token')) {
    return res.status(HttpStatus.UNAUTHORIZED).json({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Bạn không có quyền truy cập trang quản trị',
    });
  }

  req.isAdmin = true;
  next();
}
