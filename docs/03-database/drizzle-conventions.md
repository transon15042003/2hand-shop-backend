# Drizzle conventions

(Tương đương mục “prisma-conventions” trong template — project dùng Drizzle.)

## Naming

| Layer | Convention | Ví dụ |
|---|---|---|
| TypeScript field | camelCase | `depositAmount`, `holdExpiresAt` |
| SQL column | snake_case qua arg đầu tiên | `integer('deposit_amount')` |
| Table | snake_case plural | `order_items`, `cash_flow_entries` |
| Enum PG | snake_case type name | `item_status`, `deposit_status` |
| PK | `id` varchar/serial hoặc business key | `orders.orderCode`, `items.id` |

## Types

- Tiền: `integer` (VND).
- Thời gian: `timestamp(..., { withTimezone: true })`.
- Cấu trúc linh hoạt: `jsonb` + `.$type<T>()`.
- Enum: `pgEnum` — đổi enum cần migration cẩn thận.

## Indexes (khi thêm)

Ưu tiên index cho:

- `items.status` (+ category nếu filter hot)
- `orders.customer_phone`, `orders.order_status`, `orders.hold_expires_at`
- `customer_sessions.customer_id`, `expires_at`
- Unique: `customers.phone`, `customers.email`, `batches.code`

Khai báo index trong schema Drizzle khi tạo — không thêm ad-hoc trên production DB.

## Soft delete

MVP **không** soft-delete generic. Trạng thái domain (`cancelled`, `draft`, …) thay cho `deleted_at`.  
Nếu sau này cần soft delete: thêm `deletedAt` nullable + mọi public query filter `IS NULL`.

## Relations

Dùng `relations()` của Drizzle cho `db.query.*` include. Với list nặng, prefer explicit `select` + join để tránh N+1.

## Source of truth

Chỉ sửa `src/db/schema.ts` rồi `pnpm run db:generate`. Không chỉnh tay file migration đã apply.
