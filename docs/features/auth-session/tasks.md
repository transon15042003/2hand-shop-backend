# Tasks — Auth session (backend)

Làm theo thứ tự. Tick khi xong.

- [x] 1. Cookie helper Max-Age=34560000 + clear Max-Age=0
- [x] 2. Align routes: verify-email, resend-code, session, logout-all, change-password, PUT /me
- [x] 3. Auth service: CustomerProfile snake_case, token trong body, OTP `code`, ALREADY_VERIFIED
- [x] 4. Middleware: slide chỉ khi last_seen > 1h; clear cookie khi invalid
- [x] 5. Admin login response `{ token, user: { role, name } }`
- [x] 6. `scripts/check-auth-session.ts` + chạy xanh
- [x] 7. `pnpm run typecheck`
- [x] 8. Cập nhật features README + tick spec AC
