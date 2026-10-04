# Data model

SSOT schema: [`../../src/db/schema.ts`](../../src/db/schema.ts).

## Entities

```
shop_settings (1 row)
batches 1──* items
customers 1──* customer_sessions
customers 1──* orders
orders 1──* order_items *──1 items
orders 1──* cash_flow_entries
batches 1──* cash_flow_entries
reconciliation_sessions (đối soát COD)
```

### `items`

Một hàng = một món vật lý. `status` ∈ {draft, shelf, reserved, sold}.  
`batchId` gắn giá vốn. `images` / `measurements` / `defect*` là JSONB hoặc text.

### `orders`

PK `orderCode`. Snapshot tài chính & chính sách lúc tạo:  
`depositAmount`, `shippingFee`, `defaultShippingFee`, `freeshipApplied`, `agreedReturnFee`, `returnWindowDays`, `holdMinutes`, `holdExpiresAt`, `policyVersion`, `timeline`.

### `order_items`

`priceSnapshot` — giá món tại lúc đặt (không đọc lại `items.price`).

### `customers` / `customer_sessions`

OTP fields trên customer; session hash riêng. Cascade delete sessions khi xóa customer.

### `batches`

Vốn kiện + processing cost + `targetMarginPercent`. Status: processing → active → break_even → completed.

### `cash_flow_entries`

Sổ quỹ thực: type `income` | `expense` | `refund`, category string, liên kết order và/hoặc batch.

### `shop_settings`

Singleton cấu hình. Đổi setting cốt lõi → tăng `policyVersion`.

## Design rationale

| Quyết định | Lý do |
|---|---|
| Không cột `quantity` | 1-of-1; trạng thái thay cho số lượng |
| Snapshot trên order | Đổi settings không phá hợp đồng đơn cũ |
| `timeline` jsonb | Audit nhẹ cho UI track, không bảng event riêng (MVP) |
| Token hash only | Giảm rủi ro nếu DB lộ |
| Money = integer VND | Tránh float |

Chi tiết ADR: 002 (cash), 005 (settings), 007 (inventory), 008 (`deposit_status`).

## Enums (từ `schema.ts`)

| Enum | Values |
|---|---|
| `item_category` | `t_shirts`, `shirts`, `sweaters`, `jackets`, `blazers`, `pants`, `shorts`, `skirts`, `dresses`, `bags`, `scarves`, `hats`, `accessories` |
| `item_condition` | `like_new`, `excellent`, `good`, `fair` |
| `item_status` | `draft`, `shelf`, `reserved`, `sold` |
| `order_status` | `new`, `confirmed`, `shipping`, `completed`, `cancelled`, `returned` |
| `payment_method` | `bank_transfer`, `cod` |
| `payment_status` | `unpaid`, `partial`, `paid`, `refunded` |
| `deposit_status` | `not_required`, `pending`, `received`, `forfeited`, `refunded`, `voided` |
| `cancel_actor` | `customer`, `shop`, `system` |
| `confirm_actor` | `shop`, `system` |
| `batch_status` | `processing`, `active`, `break_even`, `completed` |

Lệch FE: [`../00-product/glossary.md`](../00-product/glossary.md).
