# Plan — Auth session (backend)

## Approach

Khớp OpenAPI path/shape trước; tái dùng `customer_sessions` + hash token đã có. Gom Set-Cookie/Max-Age và map `CustomerProfile` vào helper nhỏ. Sửa middleware sliding 1h. Không đụng order/items.

## Files to touch

| File | Thay đổi |
|---|---|
| `src/routes/auth.route.ts` | Path OpenAPI + endpoints thiếu |
| `src/controllers/auth.controller.ts` | Cookie Max-Age; response shape |
| `src/services/auth.service.ts` | Profile, logout-all, change-password, updateMe |
| `src/repositories/customer.repository.ts` | deleteAll / deleteOthers / hasCompletedOrder |
| `src/middlewares/auth.middleware.ts` | Slide 1h; gắn sessionToken; clear cookie khi invalid |
| `src/dtos/auth.dto.ts` | `code`, change-password, profile update |
| `src/controllers/admin.controller.ts` | `{ token, user }` |
| `src/constants/http-status.ts` | Max-Age + error codes |
| `src/utils/session-cookie.util.ts` | Cookie helpers |
| `scripts/check-auth-session.ts` | Smoke authenticate |
| `docs/features/README.md` | Status slug |

## Risks

- Lệch snake_case field → FE parse fail — map đủ `CustomerProfile`
- Slide mỗi request → load DB — giới hạn 1h
- Alias path cũ (`verify-otp`) — **không** giữ; FE đã dùng OpenAPI

## Test plan

- [x] `pnpm run typecheck`
- [x] `pnpm exec tsx scripts/check-auth-session.ts` (login → session → me → logout → session null)
