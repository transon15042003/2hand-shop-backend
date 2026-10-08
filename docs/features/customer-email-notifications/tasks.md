# Tasks — Customer Email Notifications & Unverified Registration Flow

- [x] Task 1: Cấu hình biến môi trường (`.env.example`, `src/configs/app.config.ts`)
- [x] Task 2: Xây dựng `src/services/email.service.ts` với các email templates và hàm kiểm tra `isVerified`
- [x] Task 3: Cập nhật `src/services/auth.service.ts` và `src/controllers/auth.controller.ts` (cho phép đăng ký và login không chặn verify, gửi OTP qua email, trả về thông báo)
- [x] Task 4: Tích hợp trigger gửi email khi xác nhận đơn, giao hàng và hoàn hàng trong `src/services/admin.service.ts` & `src/services/order.service.ts`
- [x] Task 5: Cập nhật OpenAPI spec `docs/02-api/openapi.yaml`
- [x] Task 6: Viết script test/verification kiểm tra các luồng email và đăng ký
- [x] Task 7: Chạy typecheck và kiểm tra Definition of Done
