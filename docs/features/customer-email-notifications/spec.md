# Spec — Customer Email Notifications & Unverified Registration Flow

## Problem

1. Khi khách hàng đăng ký tài khoản mới, hệ thống sinh mã OTP 6 số nhưng không gửi email (do chưa tích hợp dịch vụ gửi email). Khách hàng không nhận được mã xác thực.
2. Luồng đăng ký cũ bắt buộc xác thực email ngay lập tức (`requires_verification: true`), và API `/auth/login` chặn người dùng chưa xác thực (401 `EMAIL_NOT_VERIFIED`), làm gián đoạn trải nghiệm mua sắm của khách.
3. Cửa hàng chưa có tính năng gửi email thông báo tự động cho khách hàng khi:
   - Đăng ký tài khoản thành công (kèm OTP xác thực).
   - Đơn hàng được xác nhận thành công (`confirmed`).
   - Đơn hàng được giao thành công (`completed`).
   - Đơn hàng được hoàn trả thành công (`returned`).

## Scope

- **In**:
  - Module `emailService` hỗ trợ:
    - Gửi email qua SMTP (Nodemailer: Gmail App Password, Custom SMTP, v.v.)
    - Gửi email qua Resend HTTP API (native `fetch`, không cần extra dependencies)
    - Fallback Dev Logger khi chưa có cấu hình SMTP/Resend trong môi trường dev (không làm gãy flow)
  - Luồng đăng ký tài khoản khách hàng:
    - Cho phép khách đăng ký thành công ngay và giữ `is_verified: false`.
    - Trả về thông báo: `"Đăng ký tài khoản thành công! Để nhận thông tin về đơn hàng, vui lòng xác thực email."`
    - Cấp phiên đăng nhập / session cookie ngay khi đăng ký.
    - Cho phép khách hàng đăng nhập (`/api/auth/login`) bình thường mà không bị chặn bởi lỗi 401 `EMAIL_NOT_VERIFIED`.
    - Gửi email chứa mã OTP xác thực tới email khách hàng lúc đăng ký và khi bấm gửi lại mã.
  - Luồng thông báo đơn hàng qua email:
    - **Quy tắc**: Chỉ gửi email đơn hàng cho khách hàng có tài khoản VÀ đã xác thực email (`is_verified === true`).
    - Gửi email khi đơn hàng chuyển sang `confirmed` (Shop xác nhận hoặc hệ thống tự động duyệt sau khi nhận cọc).
    - Gửi email khi đơn hàng chuyển sang `completed` (Shop bấm hoàn tất giao hàng, nhắc chính sách đổi trả).
    - Gửi email khi đơn hàng chuyển sang `returned` (Shop xác nhận nhận lại hàng hoàn).
- **Out**:
  - Không gửi email đơn hàng cho khách vãng lai hoặc khách có tài khoản nhưng chưa xác thực email.
  - Không bắt buộc xác thực email mới được mua hàng hoặc đăng nhập.

## Acceptance Criteria

- [x] Khách đăng ký tài khoản thành công nhận được thông báo yêu cầu xác thực email để nhận thông tin đơn hàng.
- [x] Email chứa mã OTP 6 số được gửi tới email khách hàng khi đăng ký và khi gọi resend code.
- [x] Khách hàng chưa xác thực email vẫn có thể đăng nhập bình thường; profile trả về `is_verified: false`.
- [x] Khi đơn hàng chuyển sang `confirmed`, nếu khách hàng có tài khoản và đã xác thực email thì hệ thống gửi email xác nhận đơn.
- [x] Khi đơn hàng chuyển sang `completed`, nếu khách hàng có tài khoản và đã xác thực email thì hệ thống gửi email giao hàng thành công.
- [x] Khi đơn hàng chuyển sang `returned`, nếu khách hàng có tài khoản và đã xác thực email thì hệ thống gửi email hoàn hàng thành công.
- [x] Toàn bộ logic gửi email là non-blocking (lỗi gửi mail không rollback transaction của đơn hàng hoặc tài khoản).
- [x] Tuân thủ Rule 8: Không log PII (mask email trong logs).
- [x] Typecheck pass, OpenAPI contract cập nhật tương thích.

## References

- OpenAPI: `/auth/register`, `/auth/login`, `/auth/verify-email`, `/auth/resend-code`
- Domain: `docs/04-domain/order-flow.md`
- DB Schema: `customers`, `orders`
