# Architecture Decision Records

Quyết định đã chốt. **Không sửa ADR cũ** — viết ADR mới supersede nếu đổi hướng.

| # | Title |
|---|---|
| [000](./000-pham-vi.md) | Phạm vi shop & ranh giới FE/BE |
| [001](./001-stack.md) | Express, Drizzle, Neon |
| [002](./002-dong-tien.md) | Dòng tiền & đối soát COD |
| [003](./003-api-architecture-and-contracts.md) | REST & OpenAPI contracts |
| [004](./004-deposit-and-return-fee.md) | Cọc & phí trả hàng |
| [005](./005-configurable-business-settings.md) | Settings động & snapshot |
| [006](./006-customer-session.md) | Session khách 400 ngày |
| [007](./007-inventory-and-concurrency.md) | 1-of-1 & `FOR UPDATE` |
| [008](./008-deposit-status-enum-alignment.md) | Enum `deposit_status` khớp schema (`received`, …) |

Trước đây nằm ở `docs/decisions/` — đã chuyển vào đây.

## Audit 2026-10-05

| ADR | Khớp code? | Hành động |
|---|---|---|
| 000–003, 005–007 | OK (spot-check) | Sửa link FE `docs/decisions` → `docs/adr` |
| 004 §2.2 deposit enum | Lệch (`paid`/`applied` vs schema `received`) | Supersede bằng 008 |
| Category/condition | Schema 13 category / 4 condition | Ghi drift FE trong glossary (không ADR) |
