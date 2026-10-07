# Spec — Kiện hàng đa chi phí, Sale sản phẩm & Quản trị xóa tồn kho

## Problem

1. Kiện hàng trước đây chỉ ghi nhận tiền mua kiện và chi phí xử lý, thiếu chi phí vận chuyển kiện về kho và chi phí phát sinh khác. Dòng tiền và điểm hòa vốn chưa phản ánh đủ 100% chi phí thực tế.
2. Sản phẩm độc bản (1-of-1) thiếu cơ chế giảm giá/sale (cả lẻ và hàng loạt theo kiện/danh mục), thiếu chốt chặn an toàn tài chính (nguy cơ sale dưới giá vốn hoặc đổi giá khi món đang trong đơn giữ chỗ).
3. Thiếu chức năng xóa sản phẩm: không có cơ chế gỡ khỏi kệ, chuyển kiện, xóa món nhập nhầm hoặc ghi nhận hao hụt tiêu hủy cho món hỏng mà vẫn đảm bảo toàn vẹn dữ liệu đơn hàng và lịch sử dòng tiền.

## Scope

- **In**:
  - Batches: Mở rộng `shipping_cost`, `other_cost`, `target_margin_percent`, `notes`. Cập nhật `total_investment`, `break_even_target`, `estimated_cost_per_item`.
  - Cash-flow: Ghi nhận chi tiết từng khoản chi phí kiện và khoản điều chỉnh chi phí phát sinh.
  - Items Sale: Hỗ trợ sale lẻ (`POST /admin/items/{id}/discount`), hủy sale (`POST /admin/items/{id}/remove-discount`), sale hàng loạt (`POST /admin/items/bulk-discount`), hủy sale hàng loạt (`POST /admin/items/bulk-remove-discount`). Chốt chặn `PRICE_LOCKED` và `SALE_BELOW_COST`.
  - Items Removal & Status:
    - Gỡ khỏi kệ: `PATCH /admin/items/{id}/status` chuyển về `draft`.
    - Chuyển/tách kiện: `PATCH /admin/items/{id}/batch`.
    - Xóa vĩnh viễn: `DELETE /admin/items/{id}` (chặn nếu đã nằm trong đơn hàng `order_items`, hỗ trợ thu hồi vốn).
    - Tiêu hủy / Hao hụt: `POST /admin/items/{id}/discard` chuyển trạng thái sang `discarded`, lưu lý do và ghi nhận tổn thất hao hụt.
  - Schema & Migration: Cập nhật `item_status` enum (`discarded`), cột bảng `batches` và `items`, tạo migration 0005.
  - API Contract: Đồng bộ đầy đủ vào `docs/02-api/openapi.yaml`.
  - Kiểm thử: `scripts/check-batch-costs-sale-item-mgmt.ts`.

- **Out**:
  - Tích hợp cổng thanh toán tự động, kết nối trực tiếp API hãng vận chuyển.

## Acceptance criteria

- [x] Tạo kiện có đủ chi phí ship, xử lý, chi phí khác; tính đúng tổng đầu tư và điểm hòa vốn.
- [x] Cập nhật chi phí kiện tự động điều chỉnh dòng tiền `cash_flow_entries`.
- [x] Sale sản phẩm tự động tính % hoặc giá mới làm tròn đến 1.000 VND; snapshot `original_price`.
- [x] Chặn đổi giá / sale khi món đang `reserved` hoặc `sold`.
- [x] Cảnh báo/chặn khi sale dưới giá vốn nếu không có cờ `allow_below_cost`.
- [x] Khôi phục giá gốc chính xác sau khi kết thúc sale.
- [x] Xóa món chưa bán thành công và cập nhật lại thống kê kiện; chặn xóa nếu món đã từng nằm trong đơn hàng.
- [x] Tiêu hủy món chuyển sang `discarded`, cập nhật thống kê hao hụt kiện và ghi nhận chi phí tổn thất nếu có giá vốn.
- [x] `pnpm run typecheck`, `pnpm run build` và smoke test script pass 100%.
