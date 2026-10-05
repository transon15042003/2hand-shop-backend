# Plan — Production hardening

## Approach

Thêm `helmet` + `express-rate-limit` (đã nằm trong checklist — không tự viết crypto headers). Wire middleware mỏng; Blueprint Render tối thiểu.

## Files to touch

| File | Thay đổi |
|---|---|
| `src/app.ts` | helmet, trust proxy, CORS prod |
| `src/middlewares/rate-limit.middleware.ts` | auth / orders / admin-login |
| `src/routes/auth.route.ts`, `order.route.ts`, `admin.route.ts` | apply limits |
| `src/constants/http-status.ts` | `RATE_LIMITED` |
| `render.yaml` | web service |
| `package.json` | deps + check script |
| `.env.example` | rate limit knobs |
| `docs/05-quality/security.md` | tick checklist |
| `scripts/check-production-hardening.ts` | headers + 429 |

## Risks

- Multi-instance memory rate limit không chia sẻ — ghi `ponytail` / doc; upgrade Redis sau
- Helmet CSP mặc định có thể chặn nếu serve HTML — API JSON only, OK

## Test plan

- [ ] `pnpm run typecheck`
- [ ] `pnpm exec tsx scripts/check-production-hardening.ts`
