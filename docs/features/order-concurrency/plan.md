# Plan — Order concurrency (backend)

## Approach

Giữ transaction FOR UPDATE; sửa DTO snake_case; map conflict/confirmation; chuyển deposit check + hasCompleted vào tx; thêm `applyHoldExpiry` dùng chung track/create.

## Files to touch

| File | Thay đổi |
|---|---|
| `src/dtos/order.dto.ts` | snake_case create + deposit query |
| `src/services/order.service.ts` | create/deposit/lazy expire/response |
| `src/repositories/order.repository.ts` | hasCompleted(tx), find by item reserved |
| `src/middlewares/error.middleware.ts` | `error` + unavailable_item_ids |
| `src/controllers/order.controller.ts` | map body/query |
| `src/routes/order.route.ts` | validate deposit query; optional auth on deposit-check |
| `scripts/check-order-concurrency.ts` | smoke |
| `docs/features/*` | status |

## Risks

- Deadlock: sort item ids trước lock
- Enum deposit `received` (ADR 008) không `paid`
- OpenAPI create mô tả `shipping_fee` null vs property default — giữ default/freeship (property)

## Test plan

- [x] typecheck
- [x] `pnpm exec tsx scripts/check-order-concurrency.ts`
