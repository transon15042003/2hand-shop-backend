# hk-small-store-backend

API server cho tiệm quần áo cũ tuyển chọn độc bản (1-of-1).

**Stack:** Node.js · Express · TypeScript · Drizzle ORM · Neon/PostgreSQL · Zod

---

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm run db:migrate
pnpm run dev
```

Server mặc định: `http://localhost:5000` — health: `GET /api/health`

Biến môi trường chính: xem [`.env.example`](.env.example) và [`docs/06-operations/setup.md`](docs/06-operations/setup.md).

---

## Tài liệu

| | |
|---|---|
| Agent rules | [`AGENTS.md`](AGENTS.md) |
| Product glossary | [`docs/00-product/glossary.md`](docs/00-product/glossary.md) |
| Architecture | [`docs/01-architecture/overview.md`](docs/01-architecture/overview.md) |
| OpenAPI contract | [`docs/02-api/openapi.yaml`](docs/02-api/openapi.yaml) |
| Data model | [`docs/03-database/data-model.md`](docs/03-database/data-model.md) |
| Order flow | [`docs/04-domain/order-flow.md`](docs/04-domain/order-flow.md) |
| ADRs | [`docs/adr/`](docs/adr/) |
| Changelog | [`CHANGELOG.md`](CHANGELOG.md) |

Frontend đồng bộ: repo `hk-small-store` (Next.js). Contract HTTP chung qua OpenAPI.

---

## Invariants cốt lõi

1. **1-of-1**: Mỗi món tồn kho = 1. Tạo đơn dùng transaction + `FOR UPDATE`.
2. **Session khách**: Cookie HttpOnly `hk_small_store_customer_session`, token băm SHA-256, sliding 400 ngày.
3. **Snapshot đơn**: Cọc / ship / return / hold / `policy_version` đóng băng lúc đặt hàng.
4. **Thu tiền MVP**: Chuyển khoản thủ công + COD — không webhook cổng thanh toán.

Chi tiết DoD: [`docs/05-quality/definition-of-done.md`](docs/05-quality/definition-of-done.md).
