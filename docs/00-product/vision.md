# Vision — 2hand-shop Backend

## Product purpose

Backend là **authority of truth** cho cửa hàng quần áo cũ một chủ: tồn kho 1-of-1, đơn hàng, cọc/COD, phiên khách, cài đặt shop và dòng tiền.

Frontend (`2hand-shop`) chịu UI, giỏ localStorage, và gọi API. Backend quyết định ai giữ món, trạng thái đơn, và số tiền.

## Positioning

- **Không** phải sàn đa seller (không gian hàng, hoa hồng, ký gửi).
- **Không** cổng thanh toán tự động / webhook VNPay–MoMo (MVP).
- Khác Chợ Tốt / marketplace: một chủ, món độc bản, minh bạch số đo & lỗi, đối soát tay.

## Principles

1. **1-of-1** — Không bán trùng; race → transaction + `FOR UPDATE`.
2. **Snapshot chính sách** — Đơn đóng băng cọc/ship/return/hold/`policyVersion` lúc tạo.
3. **Human-scale ops** — Admin một người: xác nhận cọc, ship, COD thủ công.
4. **Contract-first HTTP** — OpenAPI + Zod; lỗi có `code` ổn định.

## Evidence

- Phạm vi: [`../adr/000-pham-vi.md`](../adr/000-pham-vi.md)
- Stack: [`../adr/001-stack.md`](../adr/001-stack.md)
- Glossary: [`./glossary.md`](./glossary.md)
