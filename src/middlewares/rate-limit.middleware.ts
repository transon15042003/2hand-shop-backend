import rateLimit from 'express-rate-limit';
import { ErrorCode, HttpStatus } from '../constants/http-status.js';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** ponytail: in-memory store — fine for single Render instance; upgrade to Redis if scaling horizontally. */
function makeLimiter(windowMs: number, max: number, message: string) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        error: ErrorCode.RATE_LIMITED,
        message,
      });
    },
  });
}

/** Login / register / OTP — default 20 / 15 min. */
export const authRateLimiter = makeLimiter(
  envInt('RATE_LIMIT_AUTH_WINDOW_MS', 15 * 60 * 1000),
  envInt('RATE_LIMIT_AUTH_MAX', 20),
  'Quá nhiều lần thử đăng nhập hoặc OTP. Vui lòng thử lại sau.'
);

/** Create order — default 30 / 15 min. */
export const createOrderRateLimiter = makeLimiter(
  envInt('RATE_LIMIT_ORDER_WINDOW_MS', 15 * 60 * 1000),
  envInt('RATE_LIMIT_ORDER_MAX', 30),
  'Bạn đang tạo đơn quá nhanh. Vui lòng thử lại sau.'
);

/** Admin login — default 10 / 15 min. */
export const adminLoginRateLimiter = makeLimiter(
  envInt('RATE_LIMIT_ADMIN_WINDOW_MS', 15 * 60 * 1000),
  envInt('RATE_LIMIT_ADMIN_MAX', 10),
  'Quá nhiều lần đăng nhập quản trị. Vui lòng thử lại sau.'
);
