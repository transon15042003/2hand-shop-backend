import { randomUUID } from 'crypto';
import { put, del } from '@vercel/blob';
import type { Express } from 'express';
import sharp from 'sharp';
import { HttpStatus, ErrorCode } from '../constants/http-status.js';
import { UPLOAD_MIME_TYPES } from '../constants/upload.js';
import { AppError } from '../middlewares/error.middleware.js';

export function isShopBlobUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    return parsed.hostname.endsWith('.public.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

export function extractBlobUrls(rawImages: unknown): string[] {
  if (!Array.isArray(rawImages)) return [];
  const urls: string[] = [];
  for (const item of rawImages) {
    let url: string | undefined;
    if (typeof item === 'string') {
      url = item;
    } else if (item && typeof item === 'object' && typeof (item as any).url === 'string') {
      url = (item as any).url;
    }
    if (url && isShopBlobUrl(url)) {
      urls.push(url);
    }
  }
  return urls;
}

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
    if (!UPLOAD_MIME_TYPES.includes(mime)) {
      throw new AppError('Chỉ nhận ảnh JPG, PNG hoặc WebP.', HttpStatus.BAD_REQUEST, 'UNSUPPORTED_FILE_TYPE');
    }

    let processedBuffer: Buffer;
    let metadata: sharp.Metadata;
    try {
      const pipeline = sharp(file.buffer);
      metadata = await pipeline.metadata();

      processedBuffer = await sharp(file.buffer)
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      throw new AppError(
        'Không thể xử lý định dạng ảnh.',
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_FAILED
      );
    }

    // Nếu ảnh gửi lên vốn đã là WebP, cạnh dài ≤ 1600, đúng chiều (không cần xoay)
    // và dung lượng gốc nhỏ hơn bản nén lại thì giữ buffer gốc để tiết kiệm dung lượng.
    const isInputWebp = file.mimetype === 'image/webp' || metadata.format === 'webp';
    const withinBounds = (metadata.width ?? 0) <= 1600 && (metadata.height ?? 0) <= 1600;
    const isOriented = !metadata.orientation || metadata.orientation === 1;

    const bufferToSave =
      isInputWebp && withinBounds && isOriented && file.buffer.length < processedBuffer.length
        ? file.buffer
        : processedBuffer;

    const pathname = `items/${randomUUID()}.webp`;
    try {
      // Product photos must be publicly readable on the storefront.
      const blob = await put(pathname, bufferToSave, {
        access: 'public',
        contentType: 'image/webp',
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

  async deleteBlobs(urls: string[]): Promise<void> {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return;
    const targets = Array.from(new Set(urls.filter(isShopBlobUrl)));
    if (targets.length === 0) return;
    try {
      await del(targets, { token });
    } catch (err) {
      console.error('Không xóa được blob không còn dùng:', err);
    }
  }

  async cleanupOrphanedBlobs(oldImages: unknown[], newImages: unknown[] = []): Promise<void> {
    const oldUrls = extractBlobUrls(oldImages);
    if (oldUrls.length === 0) return;
    const newUrlSet = new Set(extractBlobUrls(newImages));
    const toDelete = oldUrls.filter((url) => !newUrlSet.has(url));
    if (toDelete.length > 0) {
      await this.deleteBlobs(toDelete);
    }
  }
}

export const uploadService = new UploadService();
