# Spec — Hold expire job + OpenAPI contract checks

## Problem

Lazy hold expiry chỉ chạy khi ai đó đọc đơn — đơn hết hạn có thể giữ món `reserved` lâu nếu không ai mở. Chưa có job định kỳ (ADR 007). Các smoke hiện tại không kiểm tra shape OpenAPI cốt lõi theo một chỗ.

## Scope

- **In**:
  - `expireAllDueHolds()` quét `order_status=new` + `hold_expires_at < now`, tái dùng `applyHoldExpiry`
  - Scheduler in-process (`HOLD_EXPIRE_INTERVAL_MS`, mặc định 3 phút; `0` = tắt)
  - CLI `pnpm run job:expire-holds` (Render Cron / manual)
  - `scripts/check-openapi-contract.ts` — assert required fields vài endpoint công khai + admin
  - Cập nhật `order-flow.md` / overview (cron có)
- **Out**: Redis/BullMQ; full OpenAPI response validator dependency; `openapi-fe-sync` (sync file FE)

## Acceptance criteria

- [x] Job hủy đơn `pending` hết hold → món `shelf`; `not_required|received` → `confirmed` + `confirmed_by=system`
- [x] Interval + CLI chạy được; `HOLD_EXPIRE_INTERVAL_MS=0` không schedule
- [x] Contract check xanh trên settings / items / deposit-check / admin batches+orders+cash-flow
- [x] typecheck + smoke hold job
- [x] DoD

## References

- ADR 007 §3.2; `docs/04-domain/order-flow.md`
- OpenAPI required fields trên schemas đã ship
