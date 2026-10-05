# Spec — Batches + cash-flow (backend)

## Problem

Admin FE cần danh sách/chi tiết kiện, tạo kiện, báo cáo dòng tiền theo `period`, và phiên đối soát COD — BE hiện trả camelCase stub không khớp OpenAPI.

## Scope

- **In**:
  - `GET/POST /admin/batches`, `GET /admin/batches/{id}` (id hoặc code)
  - `BatchSummary` metrics (vốn, sold, revenue, break-even 130%)
  - Resolve `batch_id` code→id khi upsert item (FE gửi code)
  - `GET /admin/cash-flow/summary?period=` đúng shape OpenAPI + series
  - `GET/POST /admin/cash-flow/reconciliations` (COD → paid, ghi sổ)
- **Out**: chỉnh schema reconciliation lớn; cron; đổi enum deposit

## Acceptance criteria

- [x] List batches có `totals` + snake_case metrics
- [x] Create batch trùng code → 400 `BATCH_CODE_EXISTS`
- [x] Detail theo code có `items` admin summary
- [x] Cash-flow summary đủ field OpenAPI; `net_cash_flow` = tổng `series[].net`
- [x] Reconciliation: đơn COD `pending_cod` + completed/returned → paid; validate tổng
- [x] typecheck + smoke script
- [x] DoD

## References

- OpenAPI Admin Batches / Cash Flow
- ADR 002, `docs/04-domain/payment.md`
