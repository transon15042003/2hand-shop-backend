# API guidelines

## Base URL & versioning

- Production/dev API prefix: `/api`
- Versioned: `/api/v1/...`
- Compatibility: cùng resource cũng mount dưới `/api/...` (không `/v1`) cho proxy Next.js.

Ví dụ: `POST /api/v1/orders` ≡ `POST /api/orders`.

## Naming

- Resource = danh từ số nhiều: `/items`, `/orders`, `/batches`
- Action phụ trên resource: `POST /orders/:code/cancel`, `POST /admin/orders/:id/ship`
- Admin namespace: `/admin/...` (sau login admin)
- Public storefront: không prefix admin

## Methods

| Method | Dùng cho |
|---|---|
| GET | Đọc, list, track, deposit-check |
| POST | Tạo / action (confirm, ship, cancel) |
| PUT | Cập nhật toàn phần resource (item, settings) |
| DELETE | Hiếm — ưu tiên soft state transition |

## Pagination & filtering

Query chuẩn (items public):

| Param | Ý nghĩa |
|---|---|
| `page` | 1-based, default 1 |
| `limit` | default 12, max 50 |
| `category`, `condition` | filter enum |
| `min_price`, `max_price` | VND integer |
| `search` | tên / id |
| `sort` | `newest` \| `price_asc` \| `price_desc` |

Response list nên kèm `meta` hoặc `pagination` theo OpenAPI (`page`, `limit`, `total`).

## Response shape (mục tiêu contract)

Success:

```json
{
  "success": true,
  "data": {},
  "message": "Thao tác thành công",
  "meta": { "page": 1, "limit": 20, "total": 100 }
}
```

Một số endpoint hiện tại có thể trả shape gọn hơn — ưu tiên khớp [`openapi.yaml`](./openapi.yaml) khi chỉnh.

## Tiền tệ

VND, **integer**, không dùng float.

## Contract SSOT

Mọi thay đổi path/schema → cập nhật [`openapi.yaml`](./openapi.yaml) **trước hoặc cùng PR** với code.

Đồng bộ Frontend: copy/align với `2hand-shop/contracts/openapi.yaml`. Khi enum lệch (category, condition, deposit_status…), ưu tiên schema BE + ADR; ghi nhận ở [`../00-product/glossary.md`](../00-product/glossary.md) và lên kế hoạch sync FE riêng — không “sửa docs BE cho giống FE” nếu code chưa đổi.
