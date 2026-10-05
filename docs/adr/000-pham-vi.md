# 000 — Phạm vi nghiệp vụ & Ranh giới trách nhiệm Backend

Trạng thái: Đã chốt ngày 2026-09-26.  
Nguồn: Phiên làm việc định hình phạm vi cửa hàng với chủ shop. Đồng bộ với [000 của Frontend](../../../HK Small Store/docs/adr/000-pham-vi.md).

---

## 1. Bối cảnh & Ranh giới Hệ thống

Dự án Backend đóng vai trò là hạt nhân xử lý dữ liệu và logic nghiệp vụ cho cửa hàng thời trang đồ cũ HK Small Store. Hệ thống được thiết kế phục vụ một mô hình kinh doanh đặc thù: **Cửa hàng một chủ tự vận hành, bán các món đồ si tuyển chọn độc bản (1-of-1)**.

### Ranh giới trách nhiệm giữa Frontend và Backend
- **Frontend Next.js**: Chịu trách nhiệm hiển thị giao diện, điều hướng người dùng, quản lý giỏ hàng cục bộ (local storage), kiểm tra sơ bộ định dạng dữ liệu (client-side validation), hiển thị đếm ngược thời gian và hỗ trợ người dùng thao tác mượt mà.
- **Backend API**: Là **thẩm quyền tối cao (Authority of Truth)** về tính toàn vẹn dữ liệu, kiểm soát tồn kho, bảo mật phân quyền, quản lý phiên và xử lý tài chính:
  1. Thực thi tính toàn vẹn hàng độc bản: Không một ai có thể mua trùng món với người khác.
  2. Quyết định trạng thái đơn hàng và lịch sử dòng tiền.
  3. Quản lý chính sách đặt cọc, tính toán số tiền thực thu, hoàn trả và phí ship.
  4. Lưu trữ an toàn thông tin khách hàng và phiên đăng nhập.

---

## 2. Các Quyết định Phạm vi Cốt lõi

| Hạng mục | Quyết định Backend | Lý do & Hệ quả Kỹ thuật |
|---|---|---|
| **Mô hình hoạt động** | Cửa hàng một chủ, **không phải sàn TMĐT**. | Không thiết kế bảng `vendors`, không có cơ chế chia hoa hồng, không có kiểm duyệt shop. Cơ sở dữ liệu tinh gọn, tập trung vào `items`, `orders`, `customers` và `batches`. |
| **Đặc tính sản phẩm (1-of-1)** | Mỗi món là một thực thể vật lý duy nhất, số lượng tồn kho = 1. | Món hết hàng sẽ chuyển trạng thái `reserved` hoặc `sold`. Không có khái niệm tăng/giảm số lượng tồn kho theo số nguyên $N > 1$. Bắt buộc dùng database transaction khi tạo đơn. |
| **Tài khoản người dùng** | Phân hệ Khách hàng riêng biệt với Phân hệ Quản trị. | - Khách hàng đăng ký bằng Họ tên, SĐT, Email, Mật khẩu và xác thực qua mã OTP Email 6 số.<br>- Chủ shop đăng nhập qua cổng riêng `/api/v1/admin/auth/login`. |
| **Thanh toán & Thu tiền** | Thu tiền qua COD hoặc Chuyển khoản ngân hàng thủ công. | Không tích hợp Webhook cổng thanh toán tự động trong MVP. Backend cung cấp API cho chủ shop bấm xác nhận đã nhận cọc và đã nhận tiền COD thủ công. |
| **Chính sách đổi trả** | **Không đổi món/size**. Trả hàng trong vòng 2 ngày kể từ khi hoàn tất nếu chưa mặc. | - Khi trả hàng: Hoàn tiền món trừ 50.000₫ (hoặc mất cọc 50.000₫ nếu đơn có cọc, hoặc trừ phí ship 2 chiều 50.000₫).<br>- Phí ship lúc giao ban đầu không hoàn lại.<br>- Backend tự động kiểm tra mốc `completedAt` với `return_window_days` trong bảng `shop_settings`. |
| **Vận chuyển & Giao nhận** | Giao hàng toàn quốc, shop tự gửi qua bưu cục. | Không gọi API tự động của đơn vị vận chuyển (GHN/GHTK/ViettelPost). Chủ shop tự nhập mã vận đơn và chi phí thực tế khi xác nhận giao hàng. Backend tính toán `shipping_margin`. |

---

## 3. Hệ quả đối với Thiết kế Backend

1. **Không cho phép Over-selling**: Giỏ hàng ở Frontend chỉ là danh sách tạm thời trên máy khách. Khi khách gửi request tạo đơn `POST /orders`, Backend phải khóa bản ghi của từng món trong DB và kiểm tra trạng thái `shelf`. Nếu một món đã bị giữ chỗ bởi người khác, toàn bộ request phải bị từ chối với mã lỗi 409 Conflict.
2. **Snapshot chính sách**: Mọi tham số kinh doanh (tiền cọc, phí trả hàng, hạn trả, thời gian giữ đơn, phí ship) phải được snapshot vào bảng `orders` tại thời điểm tạo đơn. Khi chủ shop thay đổi cấu hình trong tương lai, các đơn hàng cũ vẫn giữ nguyên các điều khoản đã cam kết với khách.
3. **Phân quyền chặt chẽ**: Khách hàng chỉ được phép xem và thao tác với đơn hàng của chính mình. Đối với khách vãng lai tra cứu đơn, bắt buộc cung cấp đủ cả `orderCode` và `customerPhone` để tránh nguy cơ rò rỉ dữ liệu (chống IDOR).
