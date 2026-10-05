# Deployment

Target điển hình: Render (Blueprint [`render.yaml`](../../render.yaml)) / Railway / Fly.io (Node web service).

## Quy tắc PaaS

1. **Migrate trước start**: release chạy `pnpm run db:migrate` trước `pnpm run start` (Blueprint `startCommand` đã gộp).
2. **Bind** `0.0.0.0:$PORT` — PaaS gán PORT động ([Render port binding](https://render.com/docs/web-services#port-binding)).
3. **Ephemeral FS** — không ghi upload local; chỉ URL object storage.
4. **Một service = một app** — không nhét Next.js cùng process.
5. **Health**: `GET /api/health` (Blueprint `healthCheckPath`).

## Render Blueprint

1. Push repo lên GitHub.
2. Render Dashboard → New → Blueprint → chọn repo (file `render.yaml`).
3. Điền secrets sync:false: `DATABASE_URL`, `ADMIN_PASSWORD`, `CORS_ORIGIN` (URL FE production), `BLOB_READ_WRITE_TOKEN`.
4. Deploy; kiểm tra `/api/health`.

Hold expire chạy in-process (`HOLD_EXPIRE_INTERVAL_MS`). Cron riêng chỉ cần nếu tắt interval (`0`) rồi dùng `pnpm run job:expire-holds`.

## Env production

Bắt buộc: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_SESSION_TOKEN`, `CORS_ORIGIN`, `NODE_ENV=production`, `ADMIN_PASSWORD` (mạnh).  
Upload ảnh admin: `BLOB_READ_WRITE_TOKEN` (Vercel Blob).  
Hold expire: in-process `HOLD_EXPIRE_INTERVAL_MS` (mặc định 3 phút) hoặc Cron Job chạy `pnpm run job:expire-holds`.  
Rate limit (optional): `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_ORDER_MAX`, `RATE_LIMIT_ADMIN_MAX` (+ `*_WINDOW_MS`).  
Cookie Secure khi HTTPS. Tên biến / cách lấy: [`.env.example`](../../.env.example).

## CI gợi ý

```
install → typecheck → check:production-hardening → build → migrate (staging) → deploy
```

Không commit secrets.

## Neon

- Dùng pooled connection string nếu serverless / nhiều connection ngắn.
- Branch DB cho preview nếu cần.

## Rollback

- **App:** redeploy commit/image trước.
- **DB:** ưu tiên migration forward-fix; backup Neon trước migrate phá hủy. Drizzle không luôn có down migration.
