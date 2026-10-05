# Setup

## Prerequisites

- Node.js ≥ 20 (LTS)
- pnpm
- PostgreSQL (Docker local hoặc Neon)

## Env (mẫu điền)

```bash
cp .env.example .env
# Mở .env — mỗi biến có comment "Cách tạo / tìm" trong file mẫu.
```

**SSOT tên biến + hướng dẫn điền:** [`.env.example`](../../.env.example) ở root repo.

| Biến | Bắt buộc? | Mục đích ngắn |
|---|---|---|
| `PORT` | nên có | HTTP port (default `5000`) |
| `NODE_ENV` | nên có | `development` / `production` |
| `DATABASE_URL` | **có** | Postgres (Docker / local / Neon) |
| `JWT_SECRET` | **có** (prod) | Ký JWT |
| `ADMIN_SESSION_TOKEN` | **có** | Bearer / cookie admin |
| `ADMIN_PASSWORD` | tuỳ | Mật khẩu `/admin/login` (default `admin123`) |
| `CORS_ORIGIN` | **có** | Origin FE |
| `SEED_CUSTOMER_PASSWORD` | tuỳ | Mật khẩu khách seed (default `123456`) |
| `BLOB_READ_WRITE_TOKEN` | **có** khi upload ảnh | Vercel Blob Read/Write |

Tóm tắt tạo nhanh:

| Cần gì | Làm gì |
|---|---|
| Postgres local | `docker compose up -d` → giữ `DATABASE_URL` mẫu |
| Neon | [console.neon.tech](https://console.neon.tech) → Connect → copy URI |
| Secret random | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| Blob token | [vercel.com](https://vercel.com) → Storage → Blob → copy `BLOB_READ_WRITE_TOKEN` |

## Docker Compose (local)

File [`docker-compose.yml`](../../docker-compose.yml) ở root repo:

```bash
docker compose up -d
```

Khớp `DATABASE_URL` trong `.env.example`. Redis: không cần MVP.

## Migrate & run

```bash
pnpm install
cp .env.example .env   # rồi điền theo comment trong file
docker compose up -d   # nếu dùng Postgres local
pnpm run db:generate   # khi vừa sửa schema.ts
pnpm run db:migrate
pnpm run db:seed       # optional, local only
pnpm run dev
```

Health: `GET http://localhost:$PORT/api/health`

## Schema path

- Source: `src/db/schema.ts`
- Migrations: theo `drizzle.config.ts` (thường `drizzle/migrations`)

## Seed

```bash
pnpm run db:seed
```

Insert-if-missing: `shop_settings` id=1, batch mẫu, 2 items (`shelf` + `draft`), 1 customer demo (`khachhang@2handshop.vn` / `SEED_CUSTOMER_PASSWORD` hoặc `123456`).

**Không** chạy seed tự động trên production deploy. Admin login dùng mật khẩu `ADMIN_PASSWORD` + session `ADMIN_SESSION_TOKEN` (env), không từ bảng users.
