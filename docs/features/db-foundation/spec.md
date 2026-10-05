# Spec — DB foundation (backend)

## Problem

Backend đã có `schema.ts`, Express layers, và OpenAPI — nhưng `drizzle/migrations/` trống, chưa có seed chuẩn. Local/staging không có đường migrate + dữ liệu mẫu tin cậy để FE bỏ mock.

## Scope

- **In**:
  - Sinh và review migration đầu từ `src/db/schema.ts`
  - `pnpm run db:migrate` chạy được trên Postgres local (Docker hoặc Neon)
  - `pnpm run db:seed`: shop_settings mặc định, admin bootstrap (từ env), vài item `draft`/`shelf` mẫu
  - `docker-compose.yml` optional cho Postgres local (khớp docs setup)
  - Cập nhật setup docs nếu lệnh/env lệch thực tế
- **Out**:
  - Không đổi contract HTTP trừ khi phát hiện lệch schema↔OpenAPI bắt buộc
  - Không làm auth OTP thật, Blob upload, hold-expire job
  - Không nối FE (đó là `db-foundation` phía `2hand-shop`)
  - Không Redis / payment gateway / carrier API

## Acceptance criteria

- [x] `drizzle/migrations/` có SQL sinh từ schema; đã review (không destructive bất ngờ)
- [x] `pnpm run db:migrate` apply thành công trên DB trống
- [x] `pnpm run db:seed` idempotent đủ để dev lặp lại (hoặc ghi rõ giới hạn)
- [x] `GET /api/health` OK sau migrate
- [x] Seed **không** chạy trên production deploy tự động
- [x] DoD [`../../05-quality/definition-of-done.md`](../../05-quality/definition-of-done.md) — typecheck xanh; seed không auto prod; không đổi HTTP contract
- [x] OpenAPI cập nhật chỉ nếu phát hiện lệch bắt buộc — *không cần patch trong feature này*

## References

- Schema: `src/db/schema.ts`
- Migrations: [`../../03-database/migrations.md`](../../03-database/migrations.md)
- Setup: [`../../06-operations/setup.md`](../../06-operations/setup.md)
- ADR: [`../../adr/001-stack.md`](../../adr/001-stack.md), [`../../adr/000-pham-vi.md`](../../adr/000-pham-vi.md)
- FE song song: `2hand-shop/docs/features/db-foundation/`
