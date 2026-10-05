# Deployment

Target điển hình: Render / Railway / Fly.io (Node web service).

## Quy tắc PaaS

1. **Migrate trước start**: release chạy `pnpm run db:migrate` trước `pnpm run start`.
2. **Bind** `0.0.0.0:$PORT` — PaaS gán PORT động ([Render port binding](https://render.com/docs/web-services#port-binding)).
3. **Ephemeral FS** — không ghi upload local; chỉ URL object storage.
4. **Một service = một app** — không nhét Next.js cùng process.

## Env production

Bắt buộc: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_SESSION_TOKEN`, `CORS_ORIGIN`, `NODE_ENV=production`, `ADMIN_PASSWORD` (mạnh).  
Upload ảnh admin: `BLOB_READ_WRITE_TOKEN` (Vercel Blob).  
Cookie Secure khi HTTPS. Tên biến / cách lấy: [`.env.example`](../../.env.example).

## CI gợi ý

```
install → typecheck → (test khi có) → build → migrate (staging) → deploy
```

Không commit secrets.

## Neon

- Dùng pooled connection string nếu serverless / nhiều connection ngắn.
- Branch DB cho preview nếu cần.

## Rollback

- **App:** redeploy commit/image trước.
- **DB:** ưu tiên migration forward-fix; backup Neon trước migrate phá hủy. Drizzle không luôn có down migration.
