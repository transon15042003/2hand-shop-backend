# Plan — Order fulfillment (backend)

## Approach

Giữ logic trong `admin.service` (transaction + side-effect món/cash-flow). Đổi route sang PATCH OpenAPI; tách mapper snake_case + map `received`→`paid` ở biên API. Domain rules theo `order-flow.md` / ADR 004 — không đổi enum DB.

## Files to touch

| File | Thay đổi |
|---|---|
| `src/routes/admin.route.ts` | PATCH confirm/fulfill/status/deposit/hold/payment |
| `src/controllers/admin.controller.ts` | Wire body Zod + detail response |
| `src/dtos/admin-order.dto.ts` | Bodies + list query |
| `src/services/admin.service.ts` | Rules + list counts/pagination + timeline |
| `src/utils/order-mapper.util.ts` | Admin summary/detail + deposit map |
| `src/services/order.service.ts` | Outgoing deposit map trên track/confirm |
| `src/constants/http-status.ts` | `RETURN_WINDOW_EXPIRED`, `SHIPPING_FEE_REQUIRED` |
| `scripts/check-order-fulfillment.ts` | Smoke happy + gates |
| `docs/04-domain/payment.md` | Path PATCH |
| `docs/features/*` | Spec/plan/tasks + README |

## Risks

- FE OpenAPI còn `paid`/`applied` vs DB `received` — map biên; `openapi-fe-sync` sau
- Complete không set COD `paid` (đối soát riêng) — lệch code cũ
- Deposit mark không auto-confirm (OpenAPI: confirm là bước riêng)

## Test plan

- [ ] `pnpm run typecheck`
- [ ] `pnpm exec tsx scripts/check-order-fulfillment.ts`
