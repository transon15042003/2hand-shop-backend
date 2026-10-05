# Plan — DB foundation (backend)

## Approach

Schema đã là SSOT. Sinh migration bằng drizzle-kit, review SQL, migrate local. Thêm `src/db/seed.ts` + script `db:seed` đọc env (không hard-code secret). Compose Postgres khớp `.env.example`. Không đụng service/controller trừ khi seed cần helper nhỏ đã có.

## Files to touch

| File | Thay đổi |
|---|---|
| `drizzle/migrations/*` | Migration đầu (generate) |
| `src/db/seed.ts` | Seed settings + admin + sample items |
| `package.json` | Script `db:seed` |
| `docker-compose.yml` | Postgres 16 (optional, khớp setup.md) |
| `docs/06-operations/setup.md` | Seed + compose nếu chưa khớp |
| `.env.example` | Chỉ nếu thiếu biến seed cần |

## Risks

- Enum/column lệch OpenAPI FE → ghi rõ, xử lý trong `openapi-fe-sync` hoặc patch nhỏ cùng PR nếu chặn migrate
- Seed ghi đè data local → seed chỉ insert-if-missing / document wipe
- `db:push` trên DB thật — **không** dùng trong feature này

## Test plan

- [x] `pnpm run db:generate` (khi schema đổi) + review SQL
- [x] `pnpm run db:migrate` trên DB trống
- [x] `pnpm run db:seed` rồi query nhanh (studio hoặc SQL) thấy settings/items
- [x] `pnpm run typecheck`
- [x] `GET /api/health`
