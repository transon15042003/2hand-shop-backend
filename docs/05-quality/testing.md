# Testing

## Hiện có trong repo

| Lệnh | Việc |
|---|---|
| `pnpm run typecheck` | `tsc --noEmit` — cổng tối thiểu trước merge |

Chưa có script `test` trong `package.json` (MVP). Khi thêm: Vitest hoặc `node:test` + Supertest.

## Tầng mục tiêu

| Tầng | Phạm vi | Gợi ý |
|---|---|---|
| Unit | Service thuần: `amountDue`, deposit check, transition guard | Mock repository |
| Integration | Repository + Postgres test DB / Neon branch | Transaction thật, `FOR UPDATE` |
| Contract | HTTP ↔ OpenAPI | Supertest + schema validate |

## Bắt buộc trước khi merge (domain nóng) — khi đã có test runner

1. **Concurrency**: N request đồng thời cùng `itemId` → đúng 1 order thành công, còn lại `OUT_OF_STOCK` 409.
2. **Transition**: Không `new → shipping` trực tiếp.
3. **Snapshot**: Đổi `shop_settings` sau tạo đơn không đổi số liệu đơn cũ.
4. **Zod**: Body thiếu field → 400 + `fields`.

## Test database

- Không chạy integration trên production Neon.
- Local Docker hoặc Neon branch; migrate sạch trước suite.

## Coverage

Không báo cáo % coverage giả khi chưa có suite. Mục tiêu sau: critical paths (create order, cancel, confirm-deposit, ship, complete) có check tự động.
