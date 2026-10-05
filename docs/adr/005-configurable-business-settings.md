# 005 — Cấu hình kinh doanh động, Snapshot đơn hàng và Audit Policy

Trạng thái: Đã chốt ngày 2026-10-03.  
Nguồn: Thỏa thuận nâng cấp nghiệp vụ cài đặt linh hoạt cho chủ shop Son. Đồng bộ với [ADR 005 Frontend](../../../HK Small Store/docs/adr/005-configurable-business-settings.md).

---

## 1. Yêu cầu Nghiệp vụ

1. Toàn bộ các con số kinh doanh (tiền cọc, phí trả hàng, hạn đổi trả, thời gian giữ đơn, phí ship mặc định, ngưỡng freeship) và thông tin liên hệ/ngân hàng **không được hardcode trong mã nguồn**, mà phải được lưu trữ trong cơ sở dữ liệu và cho phép chủ shop điều chỉnh linh hoạt qua màn hình quản trị `/admin/settings`.
2. Khi khách đặt hàng, họ bắt buộc phải đồng ý với phiên bản chính sách hiện hành. Server phải bảo vệ tính toàn vẹn, từ chối các đơn hàng gửi lên với phiên bản chính sách đã lỗi thời.
3. Khi chủ shop thay đổi cài đặt kinh doanh trong tương lai, **tuyệt đối không làm thay đổi các thỏa thuận của những đơn hàng đã tạo trước đó**.

---

## 2. Bảng Cơ sở Dữ liệu `shop_settings`

Bảng `shop_settings` lưu giữ 1 bản ghi cấu hình duy nhất của toàn hệ thống:

| Tên cột | Kiểu dữ liệu | Giá trị mặc định | Diễn giải |
|---|---|---|---|
| `deposit_amount` | integer | 50.000 | Mức tiền cọc đơn đầu tiên (VND). 0 = Không thu cọc. |
| `return_fee` | integer | 50.000 | Phí trả hàng / phí ship 2 chiều khi trả đơn không cọc (VND). |
| `return_window_days` | integer | 2 | Số ngày cho phép khách trả hàng sau khi hoàn tất. |
| `order_hold_minutes` | integer | 30 | Số phút tối đa giữ chỗ món hàng cho một đơn mới. |
| `policy_version` | integer | 1 | Phiên bản chính sách hiện hành (tự tăng khi sửa cài đặt cốt lõi). |
| `default_shipping_fee`| integer | 30.000 | Cước vận chuyển mặc định thu của khách 1 chiều. |
| `freeship_min_items` | integer | 4 | Số món tối thiểu để được miễn phí ship toàn bộ. 0 = Tắt freeship. |
| `shipping_fee_presets`| jsonb | `[20000, 30000]` | Danh sách các mức cước gợi ý để shop chọn nhanh khi xác nhận đơn. |
| `shop_phone` | varchar | '0900000000' | Số điện thoại liên hệ cửa hàng. |
| `shop_zalo` | varchar | '0900000000' | Zalo hỗ trợ khách hàng. |
| `shop_messenger_url` | varchar | null | Link Facebook Messenger. |
| `bank_name` | varchar | 'Vietcombank' | Tên ngân hàng nhận chuyển cọc. |
| `bank_account_number`| varchar | '0000000000' | Số tài khoản ngân hàng. |
| `bank_account_holder`| varchar | 'CHU SHOP' | Tên chủ tài khoản ngân hàng. |
| `bank_qr_image_url` | varchar | null | Link ảnh mã QR tài khoản ngân hàng. |

---

## 3. Cơ chế Snapshot vào Đơn hàng (`orders`)

Khi `POST /orders` được thực thi thành công, Backend sao chép (snapshot) trực tiếp toàn bộ các tham số cấu hình tại thời điểm đó vào dòng đơn hàng tương ứng trong bảng `orders`:
- `deposit_amount`
- `shipping_fee`
- `default_shipping_fee`
- `freeship_applied`
- `agreed_return_fee` (lấy từ `settings.returnFee`)
- `return_window_days`
- `hold_minutes`
- `hold_expires_at` (`now() + hold_minutes * 60 * 1000`)
- `policy_version`
- `policy_accepted_at` (ghi nhận thời điểm server nhận request đồng ý)

**Lợi ích**: Khi shop nâng mức cọc từ 50.000₫ lên 70.000₫ hoặc đổi hạn trả từ 2 ngày sang 3 ngày, toàn bộ đơn hàng trong quá khứ vẫn xử lý chính xác theo đúng cam kết lúc khách ấn nút Đặt hàng.

---

## 4. Kiểm soát Xung đột Phiên bản Chính sách (`policy_version`)

Để tránh tình huống khách hàng đọc điều khoản cũ và đặt đơn ngay lúc chủ shop vừa đổi chính sách:
1. API `GET /settings` trả về `policy_version` hiện hành kèm thông tin cài đặt cho storefront.
2. `POST /orders` bắt buộc truyền lên `policyAccepted: true` và `policyVersion: number`.
3. Server kiểm tra:
   ```typescript
   if (request.policyVersion !== currentSettings.policyVersion) {
     throw new AppError(
       'Phiên bản chính sách của cửa hàng đã thay đổi. Vui lòng tải lại trang.',
       HttpStatus.CONFLICT,
       ErrorCode.POLICY_VERSION_OUTDATED
     );
   }
   ```
4. Khi nhận lỗi `POLICY_VERSION_OUTDATED`, Frontend sẽ tải lại cài đặt mới và yêu cầu khách hàng đọc và tick xác nhận lại trước khi gửi đơn.

---

## 5. Nhật ký Lịch trình Đơn hàng (`timeline` JSONB)

Bảng `orders` sở hữu cột `timeline` kiểu `jsonb` lưu trữ mảng các sự kiện quan trọng trong vòng đời đơn:
```json
[
  {
    "time": "2026-10-04T04:15:00.000Z",
    "title": "Đặt hàng thành công",
    "detail": "Đơn hàng được giữ trong 30 phút chờ nhận cọc"
  },
  {
    "time": "2026-10-04T04:22:10.000Z",
    "title": "Đã nhận tiền cọc",
    "detail": "Chủ shop xác nhận đã nhận 50.000₫ chuyển khoản"
  },
  {
    "time": "2026-10-04T04:25:00.000Z",
    "title": "Shop xác nhận đơn",
    "detail": "Phí ship chốt: 30.000₫. Tổng tiền thu khi giao: 130.000₫"
  }
]
```
Mỗi khi một hành động nghiệp vụ diễn ra (tạo đơn, gia hạn, nhận cọc, xác nhận, gửi hàng, hoàn tất, hủy, trả hàng), Service sẽ tự động nối một phần tử mới vào mảng `timeline` để phục vụ màn hình tra cứu đơn của khách và trang quản trị của shop.
