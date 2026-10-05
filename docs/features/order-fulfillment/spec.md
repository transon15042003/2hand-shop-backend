# Spec — Order fulfillment (backend)

## Problem

Admin FE gọi `PATCH` confirm / fulfill / status / deposit / hold / payment theo OpenAPI, nhưng BE còn `POST` path cũ, thiếu gate cọc, return window, response camelCase, và `deposit_status` DB `received` lệch FE `paid`.

## Scope

- **In**:
  - Align HTTP: `PATCH /admin/orders/{id}/confirm|fulfill|status|deposit|hold|payment`
  - Domain: confirm từ `new` (+ `DEPOSIT_REQUIRED` nếu `pending`); fulfill từ `confirmed` (+ cọc đã nhận); status `completed|returned|cancelled` theo `order-flow.md` + ADR 004
  - Map response `OrderAdminDetail` / list summary snake_case; API `deposit_status`: `received` → `paid` (ADR 008 boundary)
  - Admin list: `orders` + `pagination` + `counts`
  - Lazy hold trước confirm/hold khi đơn còn `new`
  - Enum `payment_status` thêm `pending_cod` (COD sau fulfill)
- **Out**: reconciliation sessions, cash-flow summary đầy đủ (`batches-cashflow`), cron hold job, đổi enum DB `received`→`paid`

## Acceptance criteria

- [x] PATCH deposit (`pending`→`received`/`paid` API) không tự confirm đơn
- [x] Confirm khi còn `pending` cọc → 409 `DEPOSIT_REQUIRED`; sau cọc → `confirmed`
- [x] Fulfill → `shipping`, COD → `pending_cod`; cọc còn pending → 409 `DEPOSIT_REQUIRED`
- [x] Complete chỉ từ `shipping` → món `sold`; không ép `payment_status=paid` với COD
- [x] Return trong window → món `shelf`, refund theo ADR 004; quá hạn → 409 `RETURN_WINDOW_EXPIRED`
- [x] Cancel shop từ `new|confirmed|shipping` → món `shelf`, cọc `refunded`/`voided`
- [x] typecheck + `scripts/check-order-fulfillment.ts`
- [x] DoD

## References

- OpenAPI `/admin/orders/*`
- `docs/04-domain/order-flow.md`, `payment.md`
- ADR 004, 007, 008
