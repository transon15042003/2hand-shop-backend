# Plan — OpenAPI ↔ FE sync

## Approach

SSOT enum = schema Drizzle. Sửa OpenAPI trước, copy sang FE, rồi bỏ mapper BE và đổi FE `paid`/`applied` (deposit) → `received`. Timestamp API giữ `deposit_paid_at` (khớp cột DB).

## Files to touch

| File | Thay đổi |
|---|---|
| `docs/02-api/openapi.yaml` | DepositStatus + mô tả |
| `HK Small Store/contracts/openapi.yaml` | Copy từ BE |
| `src/utils/deposit-status.util.ts` | Bỏ API alias `paid`/`applied` |
| `src/utils/order-mapper.util.ts` + order.service | Trả status DB |
| `scripts/check-order-fulfillment.ts` | Expect `received` |
| FE `src/lib/order-rules.ts`, `formatters.ts`, UI, `rules.check.ts` | Enum mới |
| FE `contracts/schema.d.ts` | generate:types |
| `docs/00-product/glossary.md` | Đóng lệch deposit |

## Risks

- FE quên một chỗ so sánh `=== 'paid'` (deposit) → badge/logic sai — grep kỹ, chạy `rules.check`
- Hai PR (BE + FE) cần merge gần nhau; FE trước khi BE deploy sẽ nhận `paid` cũ — merge BE trước hoặc cùng lúc

## Test plan

- [ ] BE `pnpm run typecheck` + `check-order-fulfillment` (khi server chạy) / grep assert
- [ ] FE `pnpm run generate:types` + `npx tsx src/lib/rules.check.ts` + typecheck
