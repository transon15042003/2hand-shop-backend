/** Matches FE `upload-rules.ts` and OpenAPI `POST /admin/uploads`. */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const UPLOAD_EXT: Record<(typeof UPLOAD_MIME_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
