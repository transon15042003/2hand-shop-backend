# Migrations

Tool: **drizzle-kit**. Output: `drizzle/migrations/` (cấu hình `drizzle.config.ts`).

## Quy trình

```
1. Sửa src/db/schema.ts
2. pnpm run db:generate     # review SQL sinh ra
3. Review migration SQL     # destructive? rename? data backfill?
4. pnpm run db:migrate      # local / staging trước
5. Deploy: migrate deploy trước khi start app mới
```

## Rules

1. **Không sửa** migration đã apply trên shared/staging/production.
2. Muốn sửa sai sót → migration mới (additive / corrective).
3. `db:push` chỉ cho máy local throwaway — không dùng trên DB thật.
4. Đổi enum PostgreSQL: thêm value mới an toàn hơn; rename/remove thường cần downtime hoặc multi-step.
5. Cột NOT NULL mới trên bảng có data: thêm nullable → backfill → set NOT NULL (nhiều migration).

## Neon / branching

Preview có thể dùng Neon branch từ schema production; vẫn chạy migrate trên branch đó, không rewrite history production.

## Seed

Seed (khi có `src/db/seed.ts` hoặc script tương đương): settings mặc định, admin bootstrap, sample items `draft`/`shelf`.  
Seed **không** chạy tự động trên production deploy.
