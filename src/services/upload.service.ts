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
    try {
      // Product photos must be publicly readable on the storefront.
      const blob = await put(pathname, file.buffer, {
        access: 'public',
        contentType: mime,
        token,
      });
      return { url: blob.url };
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (/private store/i.test(raw) || /public access on a private/i.test(raw)) {
        throw new AppError(
          'Blob store đang ở chế độ Private. Tạo/đổi sang store Public trên Vercel Storage → Blob (ảnh món cần URL công khai), rồi cập nhật BLOB_READ_WRITE_TOKEN trên Render.',
          HttpStatus.INTERNAL_SERVER_ERROR,
          ErrorCode.INTERNAL_ERROR
        );
      }
      throw new AppError(
        `Không tải lên được ảnh: ${raw}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_ERROR
      );
    }
  }
}

export const uploadService = new UploadService();
