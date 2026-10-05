# Tasks — DB foundation (backend)

Làm theo thứ tự. Tick khi xong.

- [x] 1. Xác nhận Postgres local/Neon (`DATABASE_URL` trong `.env`) — *Postgres local đã sẵn trên :5432; compose vẫn có cho máy khác*
- [x] 2. Thêm `docker-compose.yml` Postgres 16 nếu chưa có (khớp setup.md)
- [x] 3. `pnpm run db:generate` từ `src/db/schema.ts` → review SQL trong `drizzle/migrations/` (`0000_married_molecule_man.sql`)
- [x] 4. `pnpm run db:migrate` trên DB trống — *đã wipe schema cũ từ `db:push` rồi migrate lại thành công*
- [x] 5. Viết `src/db/seed.ts` + `pnpm run db:seed` (settings, sample items, demo customer)
- [x] 6. `pnpm run typecheck`
- [x] 7. `GET /api/health` sau migrate + seed → `{"status":"ok",...}`
- [x] 8. Cập nhật [`../../06-operations/setup.md`](../../06-operations/setup.md) (seed không auto trên prod)
- [x] 9. Schema↔OpenAPI: không lệch bắt buộc cho migrate; sync sâu để lại slug `openapi-fe-sync`
