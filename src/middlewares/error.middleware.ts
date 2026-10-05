import { Request, Response, NextFunction } from 'express';
import { HttpStatus, ErrorCode } from '../constants/http-status.js';
import { Logger } from '../utils/logger.util.js';

export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;
  public details?: any;
  public unavailableItemIds?: string[];
  public email?: string;

  constructor(
    message: string,
    statusCode: number = HttpStatus.BAD_REQUEST,
    errorCode: string = ErrorCode.INTERNAL_ERROR,
    details?: any,
    extra?: { unavailableItemIds?: string[]; email?: string }
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.unavailableItemIds = extra?.unavailableItemIds;
    this.email = extra?.email;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  Logger.error(`[API Error] ${req.method} ${req.url} ->`, err.message || err);

  if (err instanceof AppError) {
    const body: Record<string, unknown> = {
      error: err.errorCode,
      message: err.message,
    };
    if (err.details !== undefined) body.fields = err.details;
    if (err.unavailableItemIds?.length) body.unavailable_item_ids = err.unavailableItemIds;
    if (err.email) body.email = err.email;
    // EMAIL_NOT_VERIFIED historically put email inside details
    if (err.errorCode === ErrorCode.EMAIL_NOT_VERIFIED && err.details?.email && !body.email) {
      body.email = err.details.email;
    }
    return res.status(err.statusCode).json(body);
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(HttpStatus.BAD_REQUEST).json({
      error: ErrorCode.VALIDATION_FAILED,
      message: 'Định dạng JSON gửi lên không hợp lệ',
    });
  }

  return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    error: ErrorCode.INTERNAL_ERROR,
    message: 'Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau.',
  });
}
