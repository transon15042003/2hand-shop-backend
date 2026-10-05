# Spec — OpenAPI ↔ FE sync

## Problem

OpenAPI (cả BE và FE) vẫn dùng `deposit_status: paid | applied` trong khi schema/ADR 008 dùng `received` (không có `applied`). BE map `received`→`paid` ở biên HTTP; FE rule/UI dựa trên `paid`/`applied` — lệch SSOT, dễ lệch tiếp khi thêm field.

## Scope

- **In**:
  - OpenAPI `DepositStatus`: `paid` → `received`, bỏ `applied`; cập nhật mô tả endpoint/schema liên quan
  - Đồng bộ file OpenAPI BE → FE (giữ hai file giống nhau)
  - BE bỏ map `toApiDepositStatus`; trả `received` thẳng
  - FE: types, rules, UI, smoke assertions theo enum mới; `pnpm run generate:types`
  - Glossary BE mục “Lệch Frontend” — bỏ lệch deposit đã đóng
- **Out**: Đổi tên cột DB `deposit_paid_at`; đổi `operationId` markAdminOrderDepositPaid; mở rộng OpenAPI `PaymentStatus` thêm `partial`/`refunded`; sync glossary FE category `tops|…` (ngoài HTTP)

## Acceptance criteria

- [ ] OpenAPI BE = FE; `DepositStatus` = `not_required|pending|received|forfeited|refunded|voided`
- [ ] BE không còn map `received`→`paid`; smoke fulfillment expect `received`
- [ ] FE `rules.check` + typecheck xanh với enum mới
- [ ] DoD [`../../05-quality/definition-of-done.md`](../../05-quality/definition-of-done.md)

## References

- ADR [008](../../adr/008-deposit-status-enum-alignment.md)
- OpenAPI: `docs/02-api/openapi.yaml` ↔ `HK Small Store/contracts/openapi.yaml`
- Schema: `depositStatusEnum`
