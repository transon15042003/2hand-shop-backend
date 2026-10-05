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
| `JWT_SECRET` | **có** (prod) | Ký JWT (khách + admin) |
| `CORS_ORIGIN` | **có** | Origin FE |
| `SEED_CUSTOMER_PASSWORD` | tuỳ | Mật khẩu khách seed (default `123456`) |
| `BLOB_READ_WRITE_TOKEN` | **có** khi upload ảnh | Vercel Blob Read/Write |

> `ADMIN_PASSWORD` / `ADMIN_SESSION_TOKEN` **không còn** dùng cho login. Tạo chủ shop: `pnpm run admin:create-owner -- --username … --password … [--name …]`.

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

Insert-if-missing: `shop_settings` id=1, batch mẫu, 2 items (`shelf` + `draft`), 1 customer demo (`khachhang@hksmallstore.vn` / `SEED_CUSTOMER_PASSWORD` hoặc `123456`).

**Không** chạy seed tự động trên production deploy. Admin accounts nằm ở bảng `admin_users` — tạo owner bằng `pnpm run admin:create-owner` (không seed).
