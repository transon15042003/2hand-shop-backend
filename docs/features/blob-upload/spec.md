# Spec — Blob upload (backend)

## Problem

Contract `POST /api/admin/uploads` cần lưu file multipart lên Vercel Blob và trả `{ url }` cho admin form.

## Scope

- **In**: Route + multer + `@vercel/blob` put; giới hạn 5 MB / JPEG|PNG|WebP; admin auth; OpenAPI sync
- **Out**: Resize ảnh; virus scan; CDN riêng

## Acceptance criteria

- [ ] `POST /api/admin/uploads` 201 `{ url: https://...blob... }` với Bearer admin
- [ ] 400 `UNSUPPORTED_FILE_TYPE` / `FILE_TOO_LARGE`
- [ ] 401 khi thiếu auth
- [ ] `.env.example` + setup docs
- [ ] `pnpm run typecheck`

## References

- FE contract: `HK Small Store/contracts/openapi.yaml`
- `src/constants/upload.ts`, `src/services/upload.service.ts`
