# Architecture overview

```
┌─────────────────────┐
│  Next.js Frontend   │  (repo 2hand-shop)
│  storefront + admin │
└──────────┬──────────┘
           │ HTTPS / JSON
           │ Cookie session + Admin token
           ▼
┌─────────────────────┐
│  Express API        │  /api  và /api/v1
│  Middleware (Zod,   │
│  auth, errors)      │
│  Controller→Service │
│  →Repository        │
└──────────┬──────────┘
           │ Drizzle
           ▼
┌─────────────────────┐
│  PostgreSQL (Neon)  │
│  ACID + FOR UPDATE  │
└─────────────────────┘

Planned / out of MVP:
  · Object storage — URL ảnh trong DB (+ Vercel Blob upload)
  · Redis / BullMQ — chưa; hold expiry = lazy-check + in-process/CLI job (ADR 007)
  · Payment gateway webhook — chưa; cọc/COD xác nhận tay
```

## Entry points

| File | Việc |
|---|---|
| `src/server.ts` | `listen(PORT)` |
| `src/app.ts` | Express factory, mount `/api`, error middleware |
| `src/routes/*` | Wire controller + middleware |
| `src/db/schema.ts` | SSOT tables/enums |

## Vai trò

| Thành phần | Trách nhiệm |
|---|---|
| Frontend | UI, giỏ local, client validation, đếm ngược hold |
| Backend | Authority of truth: tồn kho 1-of-1, đơn, tiền, phiên, settings |
| Postgres | Persistence, transaction, row lock |

## Ranh giới

- Không multi-vendor, không hoa hồng.
- Không lưu file ảnh trên disk server (ephemeral FS trên PaaS).
- Contract HTTP: [`../02-api/openapi.yaml`](../02-api/openapi.yaml).

Xem ADR: [`../adr/000-pham-vi.md`](../adr/000-pham-vi.md), [`../adr/001-stack.md`](../adr/001-stack.md). Product: [`../00-product/vision.md`](../00-product/vision.md).
