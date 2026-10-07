# Features

Mỗi feature lớn có thư mục riêng:

```
docs/features/<feature-slug>/
  spec.md    # Vấn đề, phạm vi, acceptance criteria
  plan.md    # Cách làm, chạm file nào, rủi ro
  tasks.md   # Checklist thực thi theo thứ tự
```

Copy từ [`_template/`](./_template/).

Không nhân bản toàn bộ ROADMAP thành feature trừ khi đang implement. ADR vẫn ở `docs/adr/`.

## Gợi ý slug hiện có trong lộ trình

| Slug | Phase roadmap |
|---|---|
| [`db-foundation`](./db-foundation/) | Schema + migrate + seed — **xong** (local verified) |
| [`auth-session`](./auth-session/) | Customer OTP + 400-day session + admin — **xong** |
| [`items-module`](./items-module/) | Public + admin items — **xong** |
| [`order-concurrency`](./order-concurrency/) | FOR UPDATE + hold + deposit check — **xong** |
| [`order-fulfillment`](./order-fulfillment/) | Confirm/fulfill/status/deposit — **xong** (local verified) |
| [`batches-cashflow`](./batches-cashflow/) | Batches + cash-flow summary — **xong** (local verified) |
| [`hold-jobs-contract`](./hold-jobs-contract/) | Expire job + OpenAPI contract tests — **xong** (local verified) |
| [`production-hardening`](./production-hardening/) | Helmet, rate limit, deploy — **xong** (local verified) |
| [`openapi-fe-sync`](./openapi-fe-sync/) | Đồng bộ enum/contract với Frontend — **xong** (local verified) |
| [`batch-costs-sale-item-mgmt`](./batch-costs-sale-item-mgmt/) | Kiện hàng đa chi phí, Sale sản phẩm & Quản trị tồn kho — **xong** (local verified) |

Không tạo folder marketplace (`wishlist`, `buyer-seller-chat`, …) — ngoài phạm vi ADR 000.

## Ship

Xong 1 feature (AC + check xanh) → nhánh `feat/<slug>` → **commit + push + PR merge `main`** trước khi bắt đầu slug kế ([`git-workflow`](../06-operations/git-workflow.md), [`feature-ship`](../../.cursor/rules/feature-ship.mdc)).
