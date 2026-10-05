# Plan — Hold expire job + OpenAPI contract checks

## Approach

Không thêm queue: một hàm scan + `setInterval` trong `server.ts`, kèm script one-shot cho cron PaaS. Contract = assert field bắt buộc (không parse toàn bộ YAML).

## Files to touch

| File | Thay đổi |
|---|---|
| `src/services/order.service.ts` | `expireAllDueHolds` |
| `src/jobs/hold-expire.job.ts` | run + startScheduler |
| `src/server.ts` | wire scheduler |
| `scripts/run-hold-expire.ts` | CLI |
| `scripts/check-hold-expire-job.ts` | smoke |
| `scripts/check-openapi-contract.ts` | contract |
| `package.json` | scripts |
| `.env.example` | `HOLD_EXPIRE_INTERVAL_MS` |
| `docs/04-domain/order-flow.md`, overview | cron có |

## Risks

- Nhiều instance web → double-run (idempotent nhờ status `new` check trong `applyHoldExpiry`)
- Interval quá ngắn → load DB; mặc định 3 phút

## Test plan

- [ ] `pnpm run typecheck`
- [ ] `pnpm exec tsx scripts/check-hold-expire-job.ts`
- [ ] `pnpm exec tsx scripts/check-openapi-contract.ts`
