# 004 — Nghiệp vụ đặt cọc đơn đầu tiên và hạch toán phí trả hàng

Trạng thái: Đã chốt ngày 2026-10-03. Cập nhật theo [ADR 005](005-configurable-business-settings.md). **§2.2 (`deposit_status` enum) superseded by [ADR 008](./008-deposit-status-enum-alignment.md)** (2026-10-05).  
Nguồn: Thỏa thuận quy tắc kinh doanh với chủ shop Son. Đồng bộ với [ADR 004 của Frontend](../../../2hand-shop/docs/adr/004-deposit-and-return-fee.md).

---

## 1. Bản chất Nghiệp vụ

Do đặc thù bán quần áo 2hand độc bản, việc khách đặt đơn ảo (boom hàng) hoặc trả hàng tùy tiện sẽ gây thiệt hại lớn cho chủ shop (món đồ bị giữ chỗ làm mất cơ hội bán cho người khác, shop phải gánh cước ship 2 chiều của bưu cục). Do đó, chủ shop áp dụng chính sách:
1. **Cọc đơn đầu tiên**: Khách hàng mới (chưa từng có đơn hoàn tất) phải cọc trước **50.000₫**.
2. **Khách quen được miễn cọc**: Số điện thoại hoặc tài khoản đã có ít nhất một đơn ở trạng thái `completed` được miễn cọc hoàn toàn.
3. **Phí trả hàng**: Cho phép trả hàng trong vòng 2 ngày kể từ khi nhận, nhưng khách phải chịu phí là **50.000₫** (trừ trực tiếp vào tiền hoàn món nếu đơn có cọc, hoặc thu 50.000₫ phí ship 2 chiều nếu đơn không cọc).

---

## 2. Quy tắc Xử lý Kỹ thuật Phía Server

### 2.1 Kiểm tra điều kiện cọc (`GET /orders/deposit-check`)
- Request truyền vào `phone` của khách hàng.
- Server chuẩn hóa số điện thoại (loại bỏ ký tự khoảng trắng, dấu gạch nối).
- Thực hiện truy vấn trong bảng `orders`:
  ```sql
  SELECT COUNT(*) FROM orders 
  WHERE customer_phone = :phone AND order_status = 'completed';
  ```
- Nếu `count > 0` $\rightarrow$ `deposit_required: false`, `deposit_amount: 0`.
- Nếu `count == 0` $\rightarrow$ `deposit_required: true`, `deposit_amount: settings.depositAmount` (50.000₫).
- **Lưu ý bảo mật**: Endpoint này chỉ trả về trạng thái có cần cọc hay không và mức cọc, tuyệt đối không trả về thông tin danh tính hay lịch sử đơn của số điện thoại đó.

### 2.2 Trạng thái Cọc (`deposit_status`)
Bảng `orders` quản lý cọc qua Enum `deposit_status`:
- `not_required`: Số điện thoại/tài khoản đã có đơn hoàn tất, không cần cọc.
- `pending`: Cần cọc, đơn mới tạo và shop chưa nhận được tiền chuyển khoản.
- `paid`: Chủ shop đã bấm xác nhận nhận cọc (`depositPaidAt` được ghi nhận).
- `applied`: Đơn hàng hoàn tất thành công (`completed`), cọc được khấu trừ chính thức vào tổng đơn.
- `forfeited`: Khách bị mất cọc (do trả hàng, hoặc tự hủy đơn sau khi shop đã bấm xác nhận đơn).
- `refunded`: Shop hoàn lại cọc cho khách (do shop hủy đơn, hoặc khách tự hủy trước khi shop xác nhận đơn).
- `voided`: Đơn hàng bị hủy khi khách chưa từng chuyển cọc (`pending` $\rightarrow$ hủy).

### 2.3 Công thức Tính Tiền Thu Khi Giao (COD)
Khi đơn hàng được giao cho shipper thu tiền, số tiền cần thu hộ (`amount_due`) được tính toán chính xác:

$$\text{amount\_due} = \text{total} - \text{deposit\_amount} = (\text{subtotal} + \text{shipping\_fee}) - \text{deposit\_amount}$$

*Ví dụ:* Áo giá 150.000₫, phí ship 30.000₫, cọc 50.000₫ $\rightarrow$ `total = 180.000₫`, `amount_due = 130.000₫`. Shipper chỉ thu của khách 130.000₫.

### 2.4 Hạch toán Trả Hàng trong 2 ngày (`POST /admin/orders/:id/return`)
1. Server kiểm tra: `now() - completedAt <= returnWindowDays` (mặc định 2 ngày). Nếu vượt quá $\rightarrow$ Ném lỗi `RETURN_WINDOW_EXPIRED`.
2. Tính tiền hoàn lại cho khách (`refund_amount`):
   - Đơn có cọc: Khách mất cọc 50.000₫ (`deposit_status = 'forfeited'`), số tiền hoàn = `subtotal - 50.000₫`.
   - Đơn không cọc: Khách chịu phí ship 2 chiều 50.000₫ (`return_fee = 50.000₫`), số tiền hoàn = `subtotal - 50.000₫`.
   - Phí ship lúc giao ban đầu không hoàn lại trong mọi trường hợp.
3. Chuyển toàn bộ các món trong đơn từ `sold` trở lại `shelf` để tiếp tục mở bán.
4. Ghi nhận bút toán `refund` vào sổ quỹ `cash_flow_entries`.

---

## 3. Chặn Quy trình Giao hàng khi Chưa Nhận Cọc

Nếu đơn hàng có `deposit_status = 'pending'`, Backend **nghiêm cấm** thực hiện thao tác chuyển trạng thái sang `shipping` (`POST /admin/orders/:id/ship`).
- API sẽ ném lỗi HTTP 409 Conflict với mã lỗi `DEPOSIT_REQUIRED`.
- Chủ shop bắt buộc phải thực hiện bước kiểm tra tài khoản ngân hàng và bấm "Xác nhận nhận cọc" (`POST /admin/orders/:id/confirm-deposit`) trước khi được phép bàn giao cho bưu cục.
