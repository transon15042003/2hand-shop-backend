# 008 — Đồng bộ enum `deposit_status` với schema Drizzle

Trạng thái: Đã chốt 2026-10-05.  
**Supersedes:** [ADR 004](./004-deposit-and-return-fee.md) §2.2 (danh sách `deposit_status` / tên cột timestamp).

## Context

ADR 004 mô tả `deposit_status` gồm `paid` và `applied`, và timestamp `depositPaidAt`.  
Schema thực tế trong `src/db/schema.ts` dùng:

```ts
depositStatusEnum: not_required | pending | received | forfeited | refunded | voided
```

và field timestamp `depositReceivedAt` (không có `paid` / `applied`).

Frontend contract/glossary historically dùng bộ tên khác (`paid`, `applied`, `pending_cod` cho payment…). Hai repo cần đồng bộ dần qua OpenAPI; **repo backend lấy schema làm SSOT**.

## Decision

1. **Canonical `deposit_status` (BE):**  
   `not_required` · `pending` · `received` · `forfeited` · `refunded` · `voided`
2. **`received`** = shop đã xác nhận nhận cọc (thay cho `paid` trong ADR 004).  
   Không dùng `applied` trong DB — khi đơn `completed`, cọc đã nhận vẫn ở `received` (hoặc chuyển `forfeited`/`refunded` theo luật hủy/trả); số tiền khấu trừ thể hiện qua `amountDue` / cash-flow, không qua enum `applied`.
3. Mọi docs domain/API/glossary BE dùng enum schema. ADR 004 giữ nguyên lịch sử; phần §2.2 bị supersede bởi ADR này.
4. Lệch FE ghi trong [`../00-product/glossary.md`](../00-product/glossary.md) mục “Lệch Frontend”.

## Consequences

- Implementer/agent không implement `paid`/`applied` trên BE.
- Khi sync OpenAPI với FE: dùng `received` (không map `paid`).
- Không đổi luật nghiệp vụ cọc/trả của ADR 004 ngoài tên enum.
