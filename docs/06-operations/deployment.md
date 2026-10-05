# Deployment

Target điển hình: Render (Blueprint [`render.yaml`](../../render.yaml)) / Railway / Fly.io (Node web service).

## Quy tắc PaaS

1. **Migrate trước start**: Free plan không hỗ trợ `preDeployCommand` — gộp `pnpm run db:migrate && pnpm run start` trong `startCommand` (Blueprint). Paid → tách migrate sang pre-deploy.
2. **Bind** `0.0.0.0:$PORT` — PaaS gán PORT động ([Render port binding](https://render.com/docs/web-services#port-binding)).
3. **Ephemeral FS** — không ghi upload local; chỉ URL object storage.
4. **Một service = một app** — không nhét Next.js cùng process.
5. **Health**:
   - `GET /api/health` — liveness (không DB); Blueprint `healthCheckPath`
   - `GET /api/ready` — readiness (`SELECT 1`); dùng cho keep-alive (đánh thức cả Neon)

## Render Blueprint

1. Push repo lên GitHub.
2. Render Dashboard → New → Blueprint → chọn repo (file `render.yaml`).
3. Điền secrets sync:false: `DATABASE_URL`, `ADMIN_PASSWORD`, `CORS_ORIGIN` (URL FE production), `BLOB_READ_WRITE_TOKEN`.
4. Deploy; kiểm tra `/api/health` và `/api/ready`.

Hold expire chạy in-process (`HOLD_EXPIRE_INTERVAL_MS`). Cron riêng (Render Cron = **trả phí**) chỉ cần nếu tắt interval (`0`) rồi dùng `pnpm run job:expire-holds`.

## Hạn chế sleep (Render Free)

Free web service **sleep sau 15 phút không có HTTP inbound**. Không tắt được bằng config. Cách làm trong repo:

| Cách | Làm gì | Ghi chú |
|---|---|---|
| **UptimeRobot / cron-job.org** (khuyến nghị) | HTTP monitor 5–10 phút → `https://<app>.onrender.com/api/ready` | Ổn định hơn GitHub Actions schedule |
| **GitHub Actions** [`keep-alive.yml`](../../.github/workflows/keep-alive.yml) | Cron `*/10`; secret `BACKEND_READY_URL` | Schedule GitHub có thể trễ; bật Actions trên repo |
| **Traffic FE** | Layout SSR gọi `/api/settings` | Chỉ giữ ấm khi có người mở site |

**Ceiling:** một service chạy liên tục ~720h/tháng ≈ gần hết **750 free instance-hours**. Keep-alive 24/7 = đổi “không sleep” lấy gần hết quota Free; hết giờ → service bị treo tới tháng sau. Sleep thì **không** tốn giờ.

Không thêm Render Cron Job chỉ để ping — Cron trên Render **không thuộc Free**.

Sau khi deploy lần đầu:

1. Repo GitHub → Settings → Secrets → `BACKEND_READY_URL` = `https://<tên-service>.onrender.com/api/ready`
2. (Tuỳ chọn) UptimeRobot: Create monitor → HTTP(s) → interval 5–10 min → cùng URL; timeout ≥ 90s (cold start).
3. Actions → `keep-alive` → Run workflow để thử.

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
- Neon Free cũng có thể suspend compute — ping `/api/ready` (có `SELECT 1`) giúp giữ ấm DB cùng lúc với Render.

## Rollback

- **App:** redeploy commit/image trước.
- **DB:** ưu tiên migration forward-fix; backup Neon trước migrate phá hủy. Drizzle không luôn có down migration.
