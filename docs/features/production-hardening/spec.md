# Spec — Production hardening

## Problem

API chưa có security headers / rate limit theo checklist `docs/05-quality/security.md`; CORS luôn cho localhost; thiếu Blueprint deploy Render rõ ràng.

## Scope

- **In**:
  - `helmet` security headers
  - Rate limit `/auth/*` nhạy cảm + `POST /orders` + admin login (memory store)
  - `trust proxy` (Render); CORS production chỉ `CORS_ORIGIN`; thêm `PATCH` methods
  - `render.yaml` web service + health check + migrate-before-start
  - Cập nhật security/deployment docs
- **Out**: Redis rate-limit store; WAF; full CI GitHub Actions (chỉ ghi gợi ý)

## Acceptance criteria

- [ ] Response có header Helmet cơ bản (`X-Content-Type-Options`, …)
- [ ] Vượt ngưỡng rate limit → 429 `RATE_LIMITED`
- [ ] Production CORS không whitelist localhost cứng
- [ ] `render.yaml` + docs deploy
- [ ] typecheck + runnable check
- [ ] DoD

## References

- `docs/05-quality/security.md`
- `docs/06-operations/deployment.md`
- Render port binding / ephemeral FS
