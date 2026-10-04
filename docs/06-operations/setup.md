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

Chuẩn tên biến = `.env.example`. README/docs cũ nhắc tên khác → bỏ qua.

## Docker Compose (gợi ý local)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: twohand_shop
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

Redis: không cần MVP.

## Migrate & run

```bash
pnpm install
pnpm run db:generate   # khi vừa sửa schema.ts
pnpm run db:migrate
pnpm run dev
```

Health: `GET http://localhost:$PORT/api/health`

## Schema path

- Source: `src/db/schema.ts`
- Migrations: theo `drizzle.config.ts` (thường `drizzle/migrations`)

## Seed

Chưa có seed script chuẩn trong MVP — tạo data qua admin API hoặc SQL thủ công. Khi thêm seed: một lệnh `pnpm run db:seed`, không hard-code secret.
