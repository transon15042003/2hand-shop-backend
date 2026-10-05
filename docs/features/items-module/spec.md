# Spec — Items module (backend)

## Problem

FE đã tắt mock và gọi OpenAPI items. Backend còn thiếu filter public, visibility draft/sold=404, shape admin (pagination/stats), `GET /admin/items/{id}`, `PATCH .../status`, và DTO camelCase. Enum `item_condition` lệch FE (`excellent` vs `new`/`attention_required`).

## Scope

- **In**:
  - Public `GET /items` (min/max price, search, sort, pagination `total_pages`) + `GET /items/{id}` (shelf|reserved 200; draft|sold 404)
  - Admin list/create/update/detail + `PATCH /admin/items/{id}/status` (draft↔shelf + publish rules)
  - Request/response snake_case theo OpenAPI; images `{url,alt}`; align `item_condition` enum với OpenAPI
  - Publish validation port từ FE `item-rules` (`PUBLISH_REQUIREMENTS_NOT_MET`, `PRICE_LOCKED`, `ITEM_IN_ACTIVE_ORDER`)
- **Out**:
  - `POST /admin/uploads` (blob feature)
  - Order hold/reserve side-effects (order-concurrency)

## Acceptance criteria

- [x] Public list chỉ `shelf`; detail ẩn draft/sold
- [x] Admin list trả `items` + `pagination` + `stats`
- [x] Create/update/status đúng publish rules; seed item shelf list được
- [x] Migration condition enum apply được local
- [x] `pnpm run typecheck` + runnable check
- [x] DoD

## References

- OpenAPI `/items`, `/admin/items*`
- Domain: [`../../04-domain/listing-rules.md`](../../04-domain/listing-rules.md)
- FE: `HK Small Store/src/lib/item-rules.ts`
