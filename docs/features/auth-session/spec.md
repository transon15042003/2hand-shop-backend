# Spec — Auth session (backend)

## Problem

FE đã tắt mock và gọi OpenAPI paths (`/auth/verify-email`, `/auth/session`, …). Backend còn route/shape cũ (`verify-otp`, không có `session`/`logout-all`/`change-password`), cookie dùng `Expires` thay vì `Max-Age`, và sliding session ghi DB mỗi request thay vì 1 lần/giờ (ADR 006).

## Scope

- **In**:
  - Customer: register, verify-email (`code`), resend-code, login, logout, logout-all, session (luôn 200), GET/PUT `/auth/me`, change-password
  - Cookie `2hand_customer_session`: HttpOnly, SameSite=Lax, Path=/, Max-Age=34560000 (+ Secure prod); token hash SHA-256 trong `customer_sessions`
  - Sliding expire: chỉ refresh DB + cookie khi `last_seen_at` > 1 giờ
  - Admin: `POST /admin/auth/login|logout` trả `{ token, user }` khớp contract
  - Response shape snake_case theo OpenAPI (`CustomerProfile`, `CustomerAuthResponse`, …)
- **Out**:
  - Gửi email OTP thật (dev vẫn trả `demo_otp`)
  - `/me/orders*` (order feature)
  - Redis / JWT customer / multi-admin users

## Acceptance criteria

- [x] FE có thể login seed customer → `GET /auth/session` trả profile; logout xóa cookie
- [x] Cookie Set-Cookie dùng `Max-Age` (không `Expires`); logout `Max-Age=0`
- [x] Sliding chỉ khi `last_seen_at` cũ hơn 1 giờ
- [x] `logout-all` + `change-password` (giữ phiên hiện tại) đúng ADR 006
- [x] Admin login trả `token` + `user.role=admin`
- [x] OpenAPI paths khớp code (không đổi contract trừ lỗi code tên nếu bắt buộc)
- [x] DoD + `pnpm run typecheck`
- [x] Một runnable check cho luồng auth chính (`scripts/check-auth-session.ts`)

## References

- ADR: [`../../adr/006-customer-session.md`](../../adr/006-customer-session.md)
- OpenAPI: [`../../02-api/openapi.yaml`](../../02-api/openapi.yaml) (`/auth/*`, `/admin/auth/*`)
- Schema: `customer_sessions`, `customers`
