# Listing / item rules

Domain dùng **Item**, không “listing” sàn. Validation + moderation cho món độc bản.

## Public visibility

| Status | Public `GET /items` | Public `GET /items/:id` |
|---|---|---|
| `shelf` | Có | 200 |
| `reserved` | Thường ẩn khỏi list (hoặc cờ “đã giữ”) | 200 + không cho thêm giỏ |
| `draft` | Không | 404 |
| `sold` | Không | 404 |

## Category & condition (schema)

- **category** ∈ `t_shirts` \| `shirts` \| `sweaters` \| `jackets` \| `blazers` \| `pants` \| `shorts` \| `skirts` \| `dresses` \| `bags` \| `scarves` \| `hats` \| `accessories`
- **condition** ∈ `like_new` \| `excellent` \| `good` \| `fair`

Lệch FE: xem [`../00-product/glossary.md`](../00-product/glossary.md).

## Create / update (admin)

Zod (`item.dto`): bắt buộc name, category, condition, price, size, material, images, measurements.  
Khuyết điểm: `defectDescription` + `defectImages` khi mô tả lỗi (theo OpenAPI / DTO).

Ảnh = mảng URL + `displayOrder` — **không** upload binary qua API này (MVP). Giới hạn số ảnh: theo OpenAPI / Zod hiện hành.

## Prohibited / moderation

MVP: một admin — không hàng đợi duyệt đa shop.

- Chỉ bán thời trang / phụ kiện trong `item_category`.
- Không đăng hàng cấm theo pháp luật VN (admin chịu trách nhiệm nội dung — không liệt kê chi tiết tại đây).
- Giữ `draft` đến khi đủ ảnh/số đo → `shelf`.

## 1-of-1

Không field số lượng. “Hết hàng” = không còn `shelf`. Race: [`./order-flow.md`](./order-flow.md) + [`../03-database/transactions.md`](../03-database/transactions.md) + ADR 007.
