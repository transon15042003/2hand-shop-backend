# Tech stack

| Lớp | Lựa chọn | Ghi chú |
|---|---|---|
| Runtime | Node.js LTS | `@types/node` ^22 |
| Language | TypeScript 5.7 | `strict` via `tsconfig.json` |
| Package manager | pnpm | `pnpm-lock.yaml` |
| HTTP | Express 4.21 | Middleware pipeline |
| ORM | Drizzle ORM 0.39 | Type-safe SQL; `FOR UPDATE` native |
| Migration | drizzle-kit 0.30 | `pnpm run db:generate` / `db:migrate` |
| DB | PostgreSQL (Neon hoặc local) | ENUM, JSONB, transactions |
| Validation | Zod 3.24 | DTOs + `validate` middleware |
| Auth crypto | bcryptjs, jsonwebtoken, cookie-parser | Customer session hash SHA-256 |
| Queue / cache | *Chưa* | MVP không Redis/BullMQ |
| Object storage | *URL only* | Upload ngoài API này |

## Từ chối có chủ đích

| Không dùng | Lý do (ADR 001) |
|---|---|
| NestJS | Boilerplate thừa cho quy mô 1 shop |
| Prisma | Overhead engine; `FOR UPDATE` kém tự nhiên hơn Drizzle |
| MongoDB | Thiếu ACID/FK cho đơn + tiền |

## Scripts

| Script | Việc |
|---|---|
| `dev` | `tsx watch src/server.ts` |
| `build` / `start` | `tsc` → `node dist/server.js` |
| `db:generate` | Sinh migration từ `src/db/schema.ts` |
| `db:migrate` | Apply migration |
| `db:push` | Push schema (dev only — cẩn thận) |
| `db:studio` | GUI Drizzle |
| `typecheck` | `tsc --noEmit` |
