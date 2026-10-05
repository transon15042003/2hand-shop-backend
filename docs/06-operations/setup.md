# Setup

## Prerequisites

- Node.js ≥ 20 (LTS)
- pnpm
- PostgreSQL (Docker local hoặc Neon)

## Env

```bash
cp .env.example .env
```

| Variable | Mục đích |
|---|---|
| `PORT` | HTTP port (default `5000`) |
| `NODE_ENV` | `development` / `production` |
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Ký admin JWT |
| `ADMIN_SESSION_TOKEN` | Secret admin session |
| `CORS_ORIGIN` | Origin Frontend (vd `http://localhost:3000`) |
| `SEED_CUSTOMER_PASSWORD` | (optional) mật khẩu customer seed; default `123456` |

Chuẩn tên biến = `.env.example`. README/docs cũ nhắc tên khác → bỏ qua.

## Docker Compose (local)

File [`docker-compose.yml`](../../docker-compose.yml) ở root repo:

```bash
docker compose up -d
```

Khớp `DATABASE_URL` trong `.env.example`. Redis: không cần MVP.

## Migrate & run

```bash
pnpm install
cp .env.example .env
docker compose up -d          # nếu dùng Postgres local
pnpm run db:generate          # khi vừa sửa schema.ts
pnpm run db:migrate
pnpm run db:seed              # optional, local only
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

**Không** chạy seed tự động trên production deploy. Admin login dùng `ADMIN_SESSION_TOKEN` (env), không từ bảng users.
