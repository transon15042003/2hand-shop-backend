import { Request, Response, NextFunction } from 'express';
import { HttpStatus, ErrorCode } from '../constants/http-status.js';
import { Logger } from '../utils/logger.util.js';

export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;
  public details?: any;

  constructor(
    message: string,
    statusCode: number = HttpStatus.BAD_REQUEST,
    errorCode: string = ErrorCode.INTERNAL_ERROR,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  Logger.error(`[API Error] ${req.method} ${req.url} ->`, err.message || err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      code: err.errorCode,
      message: err.message,
      fields: err.details,
    });
  }

  // Handle standard JSON syntax errors or others
  if (err.type === 'entity.parse.failed') {
    return res.status(HttpStatus.BAD_REQUEST).json({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'Định dạng JSON gửi lên không hợp lệ',
    });
  }

  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    code: ErrorCode.INTERNAL_ERROR,
    message: 'Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau.',
  });
}
