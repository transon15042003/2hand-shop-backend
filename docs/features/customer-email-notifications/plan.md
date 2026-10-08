# Plan — Customer Email Notifications & Unverified Registration Flow

## Kiến trúc & Luồng thực thi

### 1. Cấu hình Email (`src/configs/app.config.ts`, `.env.example`)
Thêm các biến môi trường:
- `EMAIL_FROM`: Tên và địa chỉ người gửi (VD: `"HK Small Store <noreply@example.com>"`)
- `RESEND_API_KEY`: API key nếu dùng Resend
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`: Cấu hình nếu dùng SMTP (Gmail App Password, v.v.)

### 2. Module Email Service (`src/services/email.service.ts`)
- Quản lý vận chuyển mail (Resend API `fetch` hoặc `nodemailer` transporter).
- Fallback Dev Logger khi không có key/SMTP cấu hình trên máy dev (in log thông tin, mask email PII theo Rule 8).
- Cung cấp các phương thức:
  - `sendRegistrationOtp(email, data)`
  - `sendOrderConfirmed(email, data)`
  - `sendOrderCompleted(email, data)`
  - `sendOrderReturned(email, data)`
  - `maybeSendOrderNotification(orderCode, event, extra)`: Tra cứu đơn hàng, tìm khách hàng (`customerId` hoặc `customerPhone`), kiểm tra điều kiện `customer.isVerified === true` trước khi gửi.

### 3. Điều chỉnh Luồng Đăng ký & Đăng nhập (`src/services/auth.service.ts`, `src/controllers/auth.controller.ts`)
- Khi `register`:
  - Lưu `isVerified: false`, tạo OTP và hạn dùng.
  - Gửi email mã OTP qua `emailService.sendRegistrationOtp`.
  - Tạo session và cookie đăng nhập ngay cho khách hàng.
  - Trả về thông điệp: `"Đăng ký tài khoản thành công! Để nhận thông tin về đơn hàng, vui lòng xác thực email."`
- Khi `login`:
  - Bỏ kiểm tra chặn `if (!customer.isVerified) throw ...`
  - Cho phép đăng nhập thành công, trả về profile với `is_verified: false` và `verification_notice`.

### 4. Tích hợp Gửi Email Đơn Hàng (`src/services/admin.service.ts`, `src/services/order.service.ts`)
- Sau khi transaction đổi trạng thái đơn hoàn tất:
  - `confirmOrder` & `applyHoldExpiry` (khi cọc đã nhận và hold hết hạn): gọi `emailService.maybeSendOrderNotification(orderCode, 'confirmed')`.
  - `completeOrder`: gọi `emailService.maybeSendOrderNotification(orderCode, 'completed')`.
  - `processReturn`: gọi `emailService.maybeSendOrderNotification(orderCode, 'returned', { reason, returnFee, refundAmount })`.
- Mọi tác vụ gửi mail được bọc try/catch không đồng bộ, không làm gián đoạn transaction chính.

### 5. Cập nhật OpenAPI & Contract
- Cập nhật `docs/02-api/openapi.yaml` tương ứng cho `/auth/register` và `/auth/login`.
