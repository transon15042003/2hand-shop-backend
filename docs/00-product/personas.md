# Personas

Hai vai trò duy nhất trong MVP. Không Seller đa gian, không moderator riêng.

## Khách hàng (Customer)

- Duyệt kệ, đặt món (guest hoặc đã đăng ký).
- Đăng ký: tên, SĐT, email, mật khẩu → OTP email 6 số.
- Phiên dài (cookie + `customer_sessions`, ~400 ngày) — ADR 006.
- Theo dõi đơn (mã + SĐT hoặc khi đăng nhập); hủy theo luật cọc.
- Hạng ảnh hưởng checkout FE: guest / chưa hoàn tất đơn / đã có đơn hoàn tất (cọc).

## Chủ shop / Admin

- Auth riêng (JWT / `admin_session`) — không dùng phiên khách.
- CRUD món & kiện, xác nhận cọc, confirm/ship/complete/return/cancel đơn.
- Cài đặt shop (`shop_settings`), dòng tiền & đối soát COD.
- API dưới `/admin/...` (và alias `/api/...`).

| Không có | Lý do |
|---|---|
| Seller tài khoản riêng | Một chủ sở hữu hàng |
| Moderator queue | Admin = chủ shop |
| Payment provider actor | Đối soát tay |
