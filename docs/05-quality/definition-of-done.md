# Definition of Done

Một endpoint/module **done** khi:

1. **ACID / concurrency** — Đụng tồn kho hoặc nhiều bảng tiền → `db.transaction` + `SELECT … FOR UPDATE` khi cần. Không double-sell.
2. **Zod** — Body/query/params validated; 400 có `fields` rõ.
3. **Snapshot** — Đơn mới đóng băng policy/shipping/deposit/hold liên quan; không đọc lại `shop_settings` để tính đơn cũ.
4. **AuthZ** — Guest/customer/admin đúng ranh giới; track đơn guest cần `orderCode` + `phone` (không IDOR).
5. **OpenAPI** — Path + schema khớp [`../02-api/openapi.yaml`](../02-api/openapi.yaml); đồng bộ FE contract khi đổi.
6. **Errors** — `AppError` + `code` ổn định; không 500 trần do quên catch nghiệp vụ; message tiếng Việt an toàn.
7. **Layering** — Không query DB trong controller; không HTTP/status trong repository.
8. **Docs** — Đổi invariant/domain → cập nhật `04-domain` / glossary hoặc ADR mới supersede.
9. **Feature gate** — Đụng domain, tồn kho, hoặc API → có `docs/features/<slug>/spec.md` trước hoặc cùng PR ([`../06-operations/agent-stack.md`](../06-operations/agent-stack.md)).
10. **Check** — Logic không tầm thường có ít nhất một runnable check (unit/integration) fail được khi regress. Hiện tối thiểu: `pnpm run typecheck`.
11. **Secrets / PII** — Không commit secret; không log SĐT/email/địa chỉ/token/OTP.

## Checklist PR (backend)

- [ ] `pnpm run typecheck` pass
- [ ] Migration (nếu đổi schema) đã `generate` + review SQL; không sửa migration đã apply trên shared
- [ ] OpenAPI cập nhật cùng PR
- [ ] Feature đụng domain/API có `docs/features/<slug>/spec.md`
- [ ] Không thêm dependency nếu stdlib/package sẵn đủ
- [ ] Hard rules trong [`AGENTS.md`](../../AGENTS.md) vẫn đúng
