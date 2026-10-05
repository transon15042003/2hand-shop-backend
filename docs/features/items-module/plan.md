# Plan — Items module (backend)

## Approach

Align schema condition + image shape với OpenAPI/FE trước (migration). Gom map snake_case + publishProblems vào helper. Mở rộng item/admin service; không đụng orders.

## Files to touch

| File | Thay đổi |
|---|---|
| `src/db/schema.ts` | condition enum; images/defect_images `{url,alt}` |
| `drizzle/migrations/*` | enum + data remap `excellent`→`like_new` |
| `src/dtos/item.dto.ts` | snake_case upsert + query |
| `src/utils/item-publish.util.ts` | publish/draft/status rules |
| `src/utils/item-mapper.util.ts` | row → public/admin DTO |
| `src/repositories/item.repository.ts` | filters + stats |
| `src/services/item.service.ts` / `admin.service.ts` | contract shapes |
| `src/routes/admin.route.ts` | GET by id, PATCH status |
| `src/db/seed.ts` | alt + conditions mới |
| `scripts/check-items-module.ts` | smoke |
| `docs/04-domain/listing-rules.md` | condition enum |

## Risks

- Enum migrate trên DB đã có data — remap `excellent`
- JSON images thiếu `alt` — map empty alt; publish sẽ chặn lên kệ

## Test plan

- [x] migrate + typecheck
- [x] `pnpm exec tsx scripts/check-items-module.ts`
