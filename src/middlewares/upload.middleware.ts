import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { HttpStatus, ErrorCode } from '../constants/http-status.js';
import { UPLOAD_MAX_BYTES, UPLOAD_MIME_TYPES } from '../constants/upload.js';
import { AppError } from './error.middleware.js';

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (UPLOAD_MIME_TYPES.includes(file.mimetype as (typeof UPLOAD_MIME_TYPES)[number])) {
      cb(null, true);
      return;
    }
    cb(new AppError('Chỉ nhận ảnh JPG, PNG hoặc WebP.', HttpStatus.BAD_REQUEST, 'UNSUPPORTED_FILE_TYPE'));
  },
}).single('file');

/** Multipart field `file` for admin item photos (max 5 MB, JPEG/PNG/WebP). */
export function adminUploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('Ảnh lớn hơn 5 MB.', HttpStatus.BAD_REQUEST, 'FILE_TOO_LARGE'));
      }
      return next(new AppError('Không nhận file upload.', HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED));
    }
    if (err) return next(err);
    next();
  });
}
