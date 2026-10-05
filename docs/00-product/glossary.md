# Glossary — Ubiquitous Language

Quy ước: **code / DB / API = English**. **Docs nghiệp vụ & error message client = tiếng Việt**.

---

## Items (Món)

| Tiếng Việt | Code / DB | Ý nghĩa |
|---|---|---|
| Món | `Item` / `items` | Một chiếc quần áo vật lý duy nhất. Tồn kho luôn = 1. Không dùng SKU số lượng. |
| Nhóm | `category` | `t_shirts`, `shirts`, `sweaters`, `jackets`, `blazers`, `pants`, `shorts`, `skirts`, `dresses`, `bags`, `scarves`, `hats`, `accessories` |
| Size | `size` | Cỡ trên mác do shop nhập. Không quy đổi tự động. |
| Số đo | `measurements` (jsonb) | cm đo tay: `chest`, `length`, `waist`, `shoulders`, … |
| Chất liệu | `material` | Vải shop xác định. |
| Tình trạng | `condition` | `like_new`, `excellent`, `good`, `fair` (SSOT = `schema.ts`). |
| Điểm lỗi | `defectDescription`, `defectImages` | Bắt buộc khi condition cần ghi chú khuyết điểm. |
| Kệ hàng | `status: shelf` | Đang mở bán công khai. |
| Nháp | `status: draft` | Chỉ admin thấy. |
| Giữ chỗ | `status: reserved` | Nằm trong đơn đang xử lý. |
| Đã bán | `status: sold` | Đơn `completed`. |

Vòng đời món: `draft → shelf ⇄ reserved → sold`. Không có `archived`.

---

## Orders (Đơn hàng)

| Tiếng Việt | Code / DB | Ý nghĩa |
|---|---|---|
| Đơn hàng | `Order` / `orders` | Mã `ORD-…`, danh sách món, địa chỉ, thanh toán, snapshot chính sách. |
| Mới | `order_status: new` | Vừa tạo, trong cửa sổ giữ chỗ. |
| Đã xác nhận | `confirmed` | Shop/system xác nhận, chốt ship. |
| Đang giao | `shipping` | Đã bàn giao bưu cục, có tracking. |
| Hoàn tất | `completed` | Khách nhận, thanh toán đủ; món → `sold`. |
| Đã hủy | `cancelled` | Hủy bởi khách/shop/system; món về `shelf`. |
| Đã trả | `returned` | Trong cửa sổ trả hàng; món về `shelf`. |
| Cọc | `depositAmount`, `depositStatus` | Cọc đơn đầu (mặc định 50.000₫). |
| Tiền thu khi giao | `amountDue` | COD: `total - depositAmount`. |
| Giữ đơn | `holdMinutes`, `holdExpiresAt` | Mặc định 30 phút. |
| Chênh lệch cước | `shippingMargin` | `shippingFee - actualShippingCost`. |

### `deposit_status` (schema)

`not_required` · `pending` · `received` · `forfeited` · `refunded` · `voided`

### `payment_status`

`unpaid` · `partial` · `paid` · `refunded`

### `payment_method`

`bank_transfer` · `cod`

---

## Customers & Auth

| Tiếng Việt | Code / DB | Ý nghĩa |
|---|---|---|
| Khách hàng | `Customer` / `customers` | SĐT + email unique; xác thực OTP email 6 số. |
| Phiên khách | `CustomerSession` / `customer_sessions` | Token raw → cookie; server lưu SHA-256 hash; 400 ngày sliding. |
| Admin | Admin auth riêng | JWT/session cookie `admin_session`; không dùng phiên khách. |

---

## Batches & Cash flow

| Tiếng Việt | Code / DB | Ý nghĩa |
|---|---|---|
| Kiện hàng | `Batch` / `batches` | Lô nhập: vốn + chi phí xử lý + margin mục tiêu. |
| Bút toán | `CashFlowEntry` / `cash_flow_entries` | `income` / `expense` / `refund`. |
| Đối soát | `ReconciliationSession` | Phiên đối soát COD với đơn vị vận chuyển. |

---

## Settings

`shop_settings` — một bản ghi cấu hình shop: cọc, return fee, hold, ship, freeship, ngân hàng, `policyVersion`.

Khi đặt hàng, các giá trị liên quan **snapshot** vào `orders`. Khách phải gửi `policyVersion` khớp hiện hành.

---

## Thuật ngữ template khác (mapping)

Template kiểu marketplace dùng từ khác — map sang domain này:

| Template / marketplace | HK Small Store |
|---|---|
| Listing | Item |
| Escrow | Deposit (cọc thủ công) |
| Consignment | Không áp dụng (shop tự sở hữu hàng) |
| Seller / multi-vendor | Một admin / chủ shop |
| Buyer | Customer |
| Payment gateway webhook | Không có (MVP); xác nhận cọc/COD thủ công |

---

## Lệch Frontend (cố ý ghi nhận)

SSOT **repo này** = `src/db/schema.ts` + [`../02-api/openapi.yaml`](../02-api/openapi.yaml).  
FE (`hk-small-store`) có thể khác — đồng bộ qua PR OpenAPI riêng, **không** sửa docs BE cho “giống FE” nếu schema chưa đổi.

| Chủ đề | Backend (SSOT) | Frontend (tham chiếu docs/contract) |
|---|---|---|
| `category` | 13 giá trị: `t_shirts`, `shirts`, `sweaters`, `jackets`, `blazers`, `pants`, `shorts`, `skirts`, `dresses`, `bags`, `scarves`, `hats`, `accessories` | Thường 5 nhóm: `tops`, `bottoms`, `dresses`, `outerwear`, `other` |
| `condition` | `new`, `like_new`, `good`, `fair`, `attention_required` | Khớp OpenAPI |
| `deposit_status` | `not_required`, `pending`, `received`, `forfeited`, `refunded`, `voided` (ADR [008](../adr/008-deposit-status-enum-alignment.md)) | Khớp OpenAPI sau `openapi-fe-sync` |
| `payment_status` | DB: `unpaid`, `pending_cod`, `partial`, `paid`, `refunded`; OpenAPI MVP: `unpaid`, `pending_cod`, `paid` | Khớp OpenAPI MVP |
