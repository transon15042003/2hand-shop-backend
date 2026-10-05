# 002 — Thiết kế mô hình quản lý dòng tiền và đối soát

Trạng thái: Đã chốt ngày 2026-09-27.  
Nguồn: Quyết định bổ sung năng lực quản trị tài chính cho chủ shop một người. Đồng bộ với [ADR 002 Frontend](../../../HK Small Store/docs/adr/002-dong-tien.md).

---

## 1. Bối cảnh Vận hành & Rủi ro Tài chính

Một cửa hàng đồ si do một người vận hành thường đối mặt với 3 rủi ro dòng tiền nghiêm trọng:
1. **Tiền COD bị đọng tại đơn vị vận chuyển**: Đơn hàng đã giao thành công nhưng tiền thu hộ chưa được shipper đối soát về tài khoản, dẫn tới thiếu hụt tiền mặt để nhập kiện hàng mới.
2. **Âm tiền cước vận chuyển**: Tiền ship thu của khách (đồng giá hoặc ước lượng) thấp hơn cước phí thực tế mà bưu cục thu, dẫn tới bị hao hụt lợi nhuận trên từng đơn hàng.
3. **Không kiểm soát được điểm hòa vốn của kiện hàng**: Mua kiện đồ si (vd: 5.000.000₫/kiện) cộng với chi phí giặt hấp, phân loại nhưng không theo dõi được tỷ lệ thu hồi vốn thực tế theo thời gian.

---

## 2. Quyết định Thiết kế Dữ liệu Phía Backend

### 2.1 Bảng `cash_flow_entries` (Sổ quỹ Dòng tiền)
Hệ thống sử dụng bảng `cash_flow_entries` để ghi nhận mọi biến động tiền mặt thực tế:
- `id`: Định danh tự tăng.
- `order_code`: Mã đơn hàng liên kết (nếu có).
- `batch_id`: Mã kiện hàng liên kết (nếu có).
- `type`: Phân loại dòng tiền (`income` - Thu vào, `expense` - Chi ra, `refund` - Hoàn trả).
- `amount`: Số tiền (VND, số nguyên dương).
- `category`: Nhóm thu/chi (`deposit`, `order_cod`, `batch_capital`, `shipping_cost`, `refund_return`, v.v.).
- `description`: Mô tả chi tiết giao dịch.
- `created_at`: Thời điểm phát sinh giao dịch tiền.

### 2.2 Quản lý Đợt nhập kiện (`batches`)
Bảng `batches` ghi nhận chi phí đầu vào của từng đợt nhập kiện:
- `initial_capital`: Tiền vốn mua kiện.
- `processing_cost`: Tiền chi phí xử lý (giặt ủi, phân loại, bao bì).
- `target_margin_percent`: Biên lợi nhuận mục tiêu (mặc định 30% $\rightarrow$ Điểm hòa vốn đạt khi doanh thu đạt 130% tổng chi phí).
- `status`: `processing` $\rightarrow$ `active` $\rightarrow$ `break_even` $\rightarrow$ `completed`.
- Mỗi món hàng (`items`) khi đăng bán được gán trực tiếp vào `batch_id` kèm `cost_price` (giá vốn phân bổ của món đồ).

### 2.3 Chênh lệch Cước Vận chuyển (`shipping_margin`)
Trên bản ghi đơn hàng (`orders`), lưu trữ:
- `shipping_fee`: Phí ship thu của khách (mặc định 30.000₫ hoặc 0₫ nếu freeship).
- `actual_shipping_cost`: Cước phí thực tế chủ shop trả cho bưu cục (do chủ shop nhập khi xác nhận giao hàng).
- `shipping_margin`: Tự động tính = `shipping_fee - actual_shipping_cost`. Nếu âm $\rightarrow$ Shop phải bù cước; nếu dương $\rightarrow$ Shop có dư cước.

---

## 3. Công thức Báo cáo Tài chính (`GET /admin/cash-flow/summary`)

Báo cáo tài chính tổng hợp từ Backend cung cấp 4 chỉ số cốt lõi:

$$\text{Tiền thực về} = \sum \text{Tiền cọc đã nhận} + \sum \text{Tiền đơn COD đã đối soát} + \sum \text{Tiền chuyển khoản đã khớp}$$

$$\text{Tiền treo ở shipper} = \sum \text{amount\_due của các đơn đang shipping có payment\_method = 'cod'}$$

$$\text{Tổng chi phí} = \sum \text{Vốn nhập kiện} + \sum \text{Cước bưu cục thực tế} + \sum \text{Tiền hoàn trả khách}$$

$$\text{Dòng tiền ròng (Net Cash Flow)} = \text{Tiền thực về} - \text{Tổng chi phí}$$

---

## 4. Hệ quả Kỹ thuật

- Khi chủ shop bấm "Đã nhận cọc" $\rightarrow$ Backend tự động tạo 1 bản ghi `income` trong `cash_flow_entries`.
- Khi đơn hàng hoàn tất và nhận tiền COD $\rightarrow$ Tạo bản ghi `income` tương ứng với `amount_due`.
- Khi chấp nhận trả hàng trong 2 ngày $\rightarrow$ Tạo bản ghi `refund` với số tiền `refund_amount = subtotal - return_fee`.
- Toàn bộ các thao tác trên được bọc trong database transaction để đảm bảo số liệu kế toán không bao giờ bị lệch.
