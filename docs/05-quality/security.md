# Security

## Input validation

- Mọi input qua Zod (`validate` middleware) trước controller.
- Parse JSON fail → 400 `VALIDATION_FAILED`.
- Không tin client: giá món / tồn kho lấy từ DB (`priceSnapshot`), không từ body giỏ FE.

## Auth & session

- Customer cookie HttpOnly + SameSite=Lax; Secure ở production (ADR 006).
- Session token: entropy cao, chỉ lưu SHA-256 hash trong `customer_sessions`.
- Admin tách biệt customer (`JWT_SECRET`, `ADMIN_SESSION_TOKEN`).
- Track đơn guest: bắt buộc `orderCode` + `customerPhone` — chống IDOR.

## Authorization checklist

| Hành động | Ai được |
|---|---|
| Public list/detail shelf items | Guest |
| Tạo đơn | Guest hoặc customer |
| Cancel/extend đơn của mình | Customer owner hoặc guest với code+phone |
| Admin fulfill / settings / batches | Admin only |

## Rate limiting / headers (production checklist)

- [x] Rate limit `/auth/login`, `/auth/register`, `/auth/resend-otp`, `POST /orders` (+ admin login)
- [x] Helmet / security headers
- [x] CORS chỉ `CORS_ORIGIN` (production); localhost chỉ khi `NODE_ENV=development`
- [x] Không phản chiếu raw SQL / stack ra client
- [x] Secrets chỉ env — không commit `.env`

Rate limit dùng memory store (một instance Render). Scale ngang → cần Redis store (chưa làm).


## PII & logging

**Không log:** SĐT, email, địa chỉ, mật khẩu, OTP, raw session token, số TK ngân hàng đầy đủ.

Được log: `orderCode`, `itemId`, error `code`, method + path, request id (khi có).

## Dependencies

Không thêm package auth/payment lạ khi stack hiện tại đủ. `pnpm audit` trước release.
