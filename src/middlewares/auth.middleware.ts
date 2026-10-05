import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../interfaces/index.js';
import {
  HttpStatus,
  ErrorCode,
  SESSION_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
  SESSION_DURATION_DAYS,
  SESSION_SLIDE_MIN_INTERVAL_MS,
} from '../constants/http-status.js';
import { appConfig } from '../configs/app.config.js';
import { customerRepository } from '../repositories/customer.repository.js';
import { HashUtil } from '../utils/hash.util.js';
import { clearCustomerSessionCookie, setCustomerSessionCookie } from '../utils/session-cookie.util.js';

function readCustomerToken(req: AuthenticatedRequest): string | undefined {
  return req.cookies?.[SESSION_COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
}

async function attachCustomerSession(
  req: AuthenticatedRequest,
  res: Response,
  token: string,
  options: { slide: boolean; clearOnInvalid: boolean }
): Promise<boolean> {
  const tokenHash = HashUtil.hashToken(token);
  const session = await customerRepository.findValidSession(tokenHash);

  if (!session) {
    if (options.clearOnInvalid) clearCustomerSessionCookie(res);
    return false;
  }

  const customer = await customerRepository.findById(session.customerId);
  if (!customer) {
    if (options.clearOnInvalid) clearCustomerSessionCookie(res);
    return false;
  }

  if (options.slide) {
    const lastSeen = session.lastSeenAt ? new Date(session.lastSeenAt).getTime() : 0;
    const shouldSlide = Date.now() - lastSeen > SESSION_SLIDE_MIN_INTERVAL_MS;
    if (shouldSlide) {
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + SESSION_DURATION_DAYS);
      await customerRepository.touchSession(tokenHash, newExpiresAt);
      setCustomerSessionCookie(res, token);
    }
  }

  req.sessionToken = token;
  req.customer = {
    id: customer.id,
    phone: customer.phone,
    email: customer.email,
    name: customer.name,
  };
  return true;
}

export async function requireCustomerAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = readCustomerToken(req);

  if (!token) {
    return res.status(HttpStatus.UNAUTHORIZED).json({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Vui lòng đăng nhập để tiếp tục',
    });
  }

  try {
    const ok = await attachCustomerSession(req, res, token, { slide: true, clearOnInvalid: true });
    if (!ok) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ',
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalCustomerAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = readCustomerToken(req);
  if (!token) return next();

  try {
    await attachCustomerSession(req, res, token, { slide: true, clearOnInvalid: true });
  } catch {
    // optional — ignore
  }
  next();
}

export async function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[ADMIN_COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token || token !== appConfig.adminSessionToken) {
    return res.status(HttpStatus.UNAUTHORIZED).json({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Bạn không có quyền truy cập trang quản trị',
    });
  }

  req.isAdmin = true;
  next();
}
