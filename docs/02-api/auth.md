# Auth

Hai phân hệ độc lập. Không dùng chung cookie/token.

## Customer (buyer)

### Đăng ký / OTP

1. `POST /auth/register` — name, phone, email, password → tạo customer `isVerified=false`, OTP 6 số, TTL ~10 phút.
2. `POST /auth/verify-otp` — xác thực → tạo session.
3. `POST /auth/resend-otp` — gửi lại OTP.

### Login / session

- `POST /auth/login` — phone hoặc email + password.
- Cookie: `hk_small_store_customer_session` = raw token (HttpOnly, SameSite=Lax, Secure ở production, Max-Age 400 ngày).
- DB: `customer_sessions.token_hash` = SHA-256(raw). Không lưu raw token.
- Sliding: nếu `lastSeenAt` > 1 giờ → gia hạn `expiresAt` + Set-Cookie lại.
- `GET /auth/me` — require customer auth.
- `POST /auth/logout` — xóa session hiện tại + clear cookie.

Chi tiết: [`../adr/006-customer-session.md`](../adr/006-customer-session.md).

### Guest order lookup

Tra cứu đơn công khai: bắt buộc cặp `orderCode` + `customerPhone` (chống IDOR). Không dựa vào chỉ mã đơn.

## Admin (shop owner)

- `POST /admin/auth/login` — credentials admin → JWT / signed session cookie `admin_session`.
- Mọi route `/admin/*` (trừ login) qua `requireAdminAuth`.
- Session ngắn hơn phiên khách; không 400 ngày.

Env: `JWT_SECRET`, `ADMIN_SESSION_TOKEN` (xem `.env.example`).

## Roles (thực tế)

| Role | Ai | Quyền chính |
|---|---|---|
| `customer` | Người mua | Đặt hàng, track/cancel/extend đơn của mình, quản lý profile |
| `admin` | Chủ shop | CRUD items/batches/settings, fulfill orders, cash-flow |
| Guest | Chưa login | Xem shelf items, tạo đơn (optional auth), deposit-check, track bằng code+phone |

Không có role `seller` đa người bán — một shop một admin.

## Middleware

- `requireCustomerAuth` — bắt buộc cookie session hợp lệ.
- `optionalCustomerAuth` — gắn customer nếu có, không 401 nếu thiếu (vd tạo đơn).
- `requireAdminAuth` — admin only.
