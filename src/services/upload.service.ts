import { randomUUID } from 'crypto';
import { put } from '@vercel/blob';
import type { Express } from 'express';
import { HttpStatus, ErrorCode } from '../constants/http-status.js';
import { UPLOAD_EXT, UPLOAD_MIME_TYPES } from '../constants/upload.js';
import { AppError } from '../middlewares/error.middleware.js';

export class UploadService {
  async storeItemImage(file: Express.Multer.File): Promise<{ url: string }> {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new AppError(
        'Chưa cấu hình BLOB_READ_WRITE_TOKEN trên máy chủ.',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_ERROR
      );
    }

    const mime = file.mimetype as (typeof UPLOAD_MIME_TYPES)[number];
    const ext = UPLOAD_EXT[mime];
    if (!ext) {
      throw new AppError('Chỉ nhận ảnh JPG, PNG hoặc WebP.', HttpStatus.BAD_REQUEST, 'UNSUPPORTED_FILE_TYPE');
    }

    const pathname = `items/${randomUUID()}.${ext}`;
    const blob = await put(pathname, file.buffer, {
      access: 'public',
      contentType: mime,
      token,
    });

    return { url: blob.url };
  }
}

export const uploadService = new UploadService();
