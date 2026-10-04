# Layering

```
Request
  → Middleware (CORS, JSON, cookie, Zod validate, auth)
  → Controller   # parse HTTP, gọi service, map status/body
  → Service      # business rules, transactions, calculations
  → Repository   # Drizzle queries only
  → PostgreSQL
```

## Ai được gọi ai

| Từ ↓ / Tới → | Middleware | Controller | Service | Repository | DB |
|---|---|---|---|---|---|
| Route | ✓ | ✓ | ✗ | ✗ | ✗ |
| Middleware | — | next | ✗* | ✗* | ✗* |
| Controller | — | — | ✓ | ✗ | ✗ |
| Service | — | — | peer OK | ✓ | via repo / `db.transaction` |
| Repository | — | — | ✗ | — | ✓ |

\* Auth middleware được phép đọc session qua repository/util — không chứa order/item business logic.

## Trách nhiệm

**Controller**
- Đọc `req.body` / `params` / `query` / cookies (đã validate).
- Gọi một service method.
- Trả JSON + HTTP status. Không `db.*`, không tính tiền.

**Service**
- Quy tắc: cọc, hold, transition đơn, snapshot settings, cash-flow side effects.
- Mở `db.transaction` khi đụng nhiều bảng / khóa tồn kho.
- Ném `AppError(code, status, message)`.

**Repository**
- CRUD / query Drizzle.
- Không biết HTTP. Không quyết định “được ship hay không”.

## Error flow

Service ném `AppError` → `errorMiddleware` → `{ code, message, fields? }`.

Xem [`../02-api/error-handling.md`](../02-api/error-handling.md).
