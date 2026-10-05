# Spec — Order concurrency (backend)

## Problem

FE tắt mock cần `POST /orders` đúng OpenAPI: snake_case body, 409 `ITEMS_ALREADY_RESERVED_OR_SOLD` + `unavailable_item_ids`, confirmation shape đủ field, `deposit-check` có `return_fee`. FOR UPDATE đã có nhưng deposit rule lệch ADR 004, `hasCompleted` ngoài transaction, chưa lazy-expire hold.

## Scope

- **In**:
  - Create order: dedupe `item_ids`, `FOR UPDATE` + lock order, conflict body OpenAPI, full `OrderConfirmationResponse`
  - Deposit: first-time phone (hoặc customer chưa completed) → `pending` + amount từ settings; trusted → `not_required`; `amount_due = total - deposit_amount`
  - `GET /orders/deposit-check` (+ optional session) → `{ deposit_required, deposit_amount, return_fee }`
  - Lazy hold expiry khi track / trước reserve item hết hạn (`pending`→cancel+shelf; `not_required|received`→confirm)
  - Error JSON dùng `error` (OpenAPI) + `unavailable_item_ids`
- **Out**: cron worker, admin ship/confirm-deposit, `/me/orders`, blob

## Acceptance criteria

- [x] Create với seed shelf item → 201 đủ field snake_case
- [x] Item không shelf → 409 + `unavailable_item_ids`
- [x] deposit-check khớp OpenAPI
- [x] Lazy expire: đơn `new` hết hold + pending → cancelled, món về shelf
- [x] typecheck + runnable check
- [x] DoD

## References

- ADR 007, 004, 008; `docs/04-domain/order-flow.md`
- OpenAPI `/orders`, `/orders/deposit-check`, `OrderConflictResponse`
