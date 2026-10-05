# Payment (cọc & COD)

MVP **không** có payment gateway webhook. Thu tiền = chuyển khoản thủ công + COD.

## Flows

### Cọc đơn đầu

1. `GET /orders/deposit-check?phone=` → có cần cọc không (không lộ lịch sử đơn).
2. Tạo đơn: nếu cần → `depositStatus = pending`, `amountDue = total - depositAmount`.
3. Khách CK theo `shop_settings` bank fields (snapshot / FE hiển thị).
4. Admin `PATCH /admin/orders/:id/deposit` → DB `received` (API trả `paid`), ghi `cash_flow_entries` income category `deposit`. Không tự confirm đơn.
5. Complete → cọc đã nhận vẫn theo luật hoàn tất; enum BE dùng `received` (không có `applied` — ADR [008](../adr/008-deposit-status-enum-alignment.md)).

### COD

- Shipper thu `amountDue`.
- Admin complete / đối soát → income `order_cod`.
- Tiền treo: tổng `amountDue` các đơn `shipping` + COD (báo cáo cash-flow).

### Bank transfer full order

`paymentMethod = bank_transfer` — admin xác nhận thủ công tương tự (không webhook).

## Idempotency

Chưa có header `Idempotency-Key` toàn cục. An toàn hiện tại:

- Tạo đơn: khóa item — lần 2 cùng món → 409, không double-reserve.
- `deposit` / `fulfill` / `status` / `payment`: service phải **reject** nếu state đã qua (không ghi cash-flow trùng). Kiểm tra status trước khi insert `cash_flow_entries`.

Khi thêm cổng thanh toán sau này: bắt buộc idempotency key + bảng event webhook unique.

## Reconciliation

Bảng `reconciliation_sessions` + báo cáo `GET /admin/cash-flow/summary`:

- Tiền thực về
- Tiền treo shipper
- Tổng chi (vốn kiện, cước thật, hoàn)
- Net cash flow

Công thức: [`../adr/002-dong-tien.md`](../adr/002-dong-tien.md).

## Out of scope now

VNPay / MoMo / Stripe webhook, auto capture, 3DS — không implement cho đến ADR mới.
