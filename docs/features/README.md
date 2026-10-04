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
| `db-foundation` | Schema + migrate + seed |
| `auth-session` | Customer OTP + 400-day session + admin |
| `items-module` | Public + admin items |
| `order-concurrency` | FOR UPDATE + hold + deposit check |
| `order-fulfillment` | Confirm/ship/complete/return/cancel |
| `batches-cashflow` | Batches + cash-flow summary |
| `hold-jobs-contract` | Expire job + OpenAPI contract tests |
| `production-hardening` | Helmet, rate limit, deploy |
| `openapi-fe-sync` | Đồng bộ enum/contract với Frontend |

Không tạo folder marketplace (`wishlist`, `buyer-seller-chat`, …) — ngoài phạm vi ADR 000.
