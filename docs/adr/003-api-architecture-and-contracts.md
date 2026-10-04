# 003 — Kiến trúc RESTful API, Chuẩn hóa Contracts & Phân tầng hệ thống

Trạng thái: Đã chốt ngày 2026-10-02.  
Nguồn: Thống nhất hợp đồng API giữa Frontend Next.js và Backend Express. Tham chiếu [OpenAPI Contract](../02-api/openapi.yaml) (đồng bộ `2hand-shop/contracts/openapi.yaml`).

---

## 1. Bối cảnh & Nguyên tắc Thiết kế

Để đảm bảo Frontend và Backend có thể phát triển song song một cách độc lập mà không xảy ra xung đột dữ liệu:
1. **OpenAPI 3.0 là Single Source of Truth (SSOT)**: Mọi endpoint, tham số request, format response và enum đều phải tuân thủ tuyệt đối theo contract đã thỏa thuận.
2. **RESTful Chuẩn mực**: Sử dụng đúng phương thức HTTP (`GET`, `POST`, `PUT`, `DELETE`), danh từ số nhiều cho tài nguyên (`/items`, `/orders`, `/batches`), và HTTP status codes mang ý nghĩa rõ ràng.
3. **Cấu trúc Response Nhất quán**: Toàn bộ phản hồi API (dù thành công hay thất bại) đều tuân theo một khuôn mẫu cấu trúc dữ liệu duy nhất.

---

## 2. Chuẩn hóa Định dạng Response (API Response Standard)

### Phản hồi thành công (Success Response)
```json
{
  "success": true,
  "data": { ... },
  "message": "Thao tác thành công",
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

### Phản hồi lỗi (Error Response)
```json
{
  "success": false,
  "error": {
    "code": "OUT_OF_STOCK",
    "message": "Rất tiếc! Món [Áo khoác bomber dạ] vừa được người khác đặt trước.",
    "fields": [
      { "field": "itemIds", "message": "Món không khả dụng" }
    ],
    "timestamp": "2026-10-04T04:00:00.000Z"
  }
}
```

---

## 3. Danh mục Mã lỗi Nghiệp vụ (Error Codes)

| Mã lỗi (`code`) | HTTP Status | Ý nghĩa |
|---|---|---|
| `VALIDATION_ERROR` | 400 Bad Request | Dữ liệu đầu vào không hợp lệ theo Zod schema. |
| `ITEM_NOT_FOUND` | 404 Not Found | Không tìm thấy món hàng yêu cầu. |
| `ORDER_NOT_FOUND` | 404 Not Found | Không tìm thấy đơn hàng. |
| `OUT_OF_STOCK` | 409 Conflict | Món hàng đã có người đặt trước (trạng thái khác `shelf`). |
| `POLICY_NOT_ACCEPTED`| 400 Bad Request | Khách chưa tick đồng ý chính sách đặt cọc & hoàn trả. |
| `POLICY_VERSION_OUTDATED`| 409 Conflict | Phiên bản chính sách gửi lên không khớp với phiên bản hiện hành. |
| `DEPOSIT_REQUIRED` | 409 Conflict | Không thể giao hàng do đơn hàng chưa được xác nhận nhận cọc. |
| `INVALID_TRANSITION`| 400 Bad Request | Chuyển đổi trạng thái đơn hàng không hợp lệ (nhảy cóc). |
| `RETURN_WINDOW_EXPIRED`| 400 Bad Request | Đơn hàng đã quá hạn 2 ngày kể từ khi hoàn tất, không thể trả. |
| `HOLD_EXTENSION_LIMIT`| 400 Bad Request | Đơn hàng đã từng được gia hạn giữ chỗ hoặc thời gian gia hạn không hợp lệ. |
| `UNAUTHORIZED` | 401 Unauthorized | Chưa đăng nhập hoặc token/phiên không hợp lệ. |
| `FORBIDDEN` | 403 Forbidden | Không có quyền truy cập tài nguyên. |

---

## 4. Kiểm thực Dữ liệu bằng Zod (Validation Pipeline)

Toàn bộ request được kiểm tra tự động qua middleware `validate`:
```typescript
router.post(
  '/orders',
  validate({ body: createOrderSchema }),
  orderController.createOrder
);
```
- Nếu request không thỏa mãn Zod Schema, middleware lập tức ngắt pipeline và trả về status `400` kèm mảng `fields` chỉ rõ trường sai sót và nguyên nhân bằng tiếng Việt.
- Controller hoàn toàn yên tâm nhận dữ liệu đã được sanitize và ép kiểu chính xác (strongly-typed).

---

## 5. Ranh giới Phân hệ (Route Namespace)

Hệ thống hỗ trợ 2 tiền tố đường dẫn:
1. `/api/v1/` (Chuẩn versioning chính thức)
2. `/api/` (Tương thích trực tiếp với cấu hình rewrite / proxy của Frontend Next.js)

Bao gồm các nhóm tài nguyên:
- `/auth`: Quản lý tài khoản và phiên khách hàng.
- `/items`: Storefront xem và tìm kiếm món hàng.
- `/orders`: Khách tạo đơn, tra cứu lộ trình, hủy đơn, gia hạn giữ đơn, kiểm tra cọc.
- `/settings`: Cung cấp các tham số cài đặt công khai cho khách xem tại checkout.
- `/admin`: Toàn bộ các API phân hệ quản trị dành riêng cho chủ shop (đăng món, duyệt đơn, hạch toán dòng tiền, kiện hàng, điều chỉnh cài đặt).
