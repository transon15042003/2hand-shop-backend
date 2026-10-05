# Plan — Batches + cash-flow (backend)

## Approach

Tính metrics kiện từ items + order_items/completed; cash-flow aggregate từ orders + cash_flow_entries + batches theo cửa sổ period (7 ngày / 4 tuần / 6 tháng). Reconciliation lưu vào bảng hiện có (title=session_code, records JSON), map ra OpenAPI.

## Files to touch

| File | Thay đổi |
|---|---|
| `src/utils/batch-mapper.util.ts` | Summary/detail |
| `src/utils/cash-flow.util.ts` | Period windows + series buckets |
| `src/dtos/batch.dto.ts`, `cash-flow.dto.ts` | Zod |
| `src/services/admin.service.ts` / batch+cash services | Logic |
| `src/repositories/*` | Stats queries |
| `src/routes/admin.route.ts` | Routes + validate |
| `scripts/check-batches-cashflow.ts` | Smoke |
| `docs/features/*` | Spec/plan/tasks |

## Risks

- FE `batch_id` = code → resolve trước insert item
- OpenAPI nói COD = sum `total`; FE dùng `amount_due` — theo FE/ADR 004
- Schema reconciliation lệch OpenAPI — map qua JSON `records`

## Test plan

- [ ] `pnpm run typecheck`
- [ ] `pnpm exec tsx scripts/check-batches-cashflow.ts`
