# Git workflow (backend)

SSOT quy trình Git cho `2hand-shop-backend`. Agent và người cùng tuân thủ.  
Gắn với feature ship: [`.cursor/rules/feature-ship.mdc`](../../.cursor/rules/feature-ship.mdc) và [`git-workflow.mdc`](../../.cursor/rules/git-workflow.mdc).

## Mục tiêu

- `main` luôn **deployable** (typecheck + migrate đã apply trên staging/local trước khi merge).
- Mỗi feature slug = **một nhánh + một PR** → lịch sử `main` đọc được.
- Không đẩy secret; không force-push `main`.

## Mô hình nhánh

| Nhánh | Vai trò |
|---|---|
| `main` | Production / nguồn sự thật. **Không** commit trực tiếp (trừ hotfix khẩn cấp có user xác nhận rõ). |
| `feat/<slug>` | Feature trong `docs/features/<slug>/` (vd `feat/order-concurrency`) |
| `fix/<short>` | Bugfix không thuộc feature folder (vd `fix/hold-expire-npe`) |
| `chore/<short>` | Tooling, deps, CI (vd `chore/ci-typecheck`) |
| `docs/<short>` | Chỉ docs/rules (vd `docs/git-workflow`) |

Nhánh sống ngắn (ideal < vài ngày). Xóa nhánh remote sau khi merge.

## Vòng đời một feature

```
1. git checkout main && git pull
2. git checkout -b feat/<slug>
3. Viết/ cập nhật docs/features/<slug>/{spec,plan,tasks}.md
4. Code + typecheck + runnable check
5. Tick AC trên spec/tasks; cập nhật docs/features/README.md
6. git add … && git commit   # 1+ commit trên nhánh; message có slug / why
7. git push -u origin HEAD
8. gh pr create → review ngắn → merge (ưu tiên squash)
9. git checkout main && git pull && git branch -d feat/<slug>
10. Chỉ lúc này mới mở feature tiếp theo
```

Hotfix / docs-only: cùng vòng nhưng prefix `fix/` hoặc `docs/`.

## Commit

- Message: **why** trước what; có thể dùng prefix `feat:`, `fix:`, `chore:`, `docs:`.
- HEREDOC khi commit từ agent.
- Không commit `.env`, credential, dump DB.
- Không `--no-verify` trừ user yêu cầu.
- Không `commit --amend` đã push trừ điều kiện amend trong user rules.

Ví dụ:

```
feat(order-concurrency): lock items with FOR UPDATE on create

Align POST /orders with OpenAPI conflict body and lazy hold expiry.
```

## Pull request

- **Title**: ngắn, có slug hoặc phạm vi (vd `feat: order-concurrency`).
- **Body** tối thiểu:

```markdown
## Summary
- …

## Test plan
- [ ] pnpm run typecheck
- [ ] (check script nếu có)
- [ ] migrate local nếu có migration mới
```

- Một PR = một feature/fix. Không gộp nhiều slug trừ user yêu cầu.
- Đổi OpenAPI → ghi rõ cần sync `2hand-shop/contracts/openapi.yaml`.
- Merge: **squash** mặc định (một commit sạch trên `main`). Merge commit OK nếu nhánh có nhiều commit có nghĩa.
- Sau merge: xóa nhánh remote (GitHub option hoặc `git push origin --delete …`).

## Cấm / hạn chế

| Không | Vì sao |
|---|---|
| Commit thẳng lên `main` | Mất review gate; phá ship-per-feature |
| Force-push `main` | Nguy hiểm; chỉ khi user yêu cầu tường minh |
| Rebase tương tác (`-i`) trên agent | Không hỗ trợ TTY |
| Để working tree feature A khi bắt đầu feature B | Trộn diff; vi phạm feature-ship |
| Push migration chưa review SQL | Schema SSOT; migration đã apply shared không sửa |

## Hotfix production

1. `fix/<short>` từ `main` mới nhất.
2. Sửa tối thiểu + check.
3. PR ưu tiên merge nhanh.
4. Nếu đã deploy: redeploy `main` sau merge; DB chỉ forward-fix.

## Đồng bộ Frontend

- Contract HTTP: BE `docs/02-api/openapi.yaml` ↔ FE `contracts/openapi.yaml` — cùng PR BE hoặc issue/PR FE ngay sau.
- Không bắt buộc cùng monorepo git; ghi link PR FE trong body PR BE khi lệch contract.

## Bảo vệ `main` (khuyến nghị GitHub)

Settings → Branches → protect `main`:

- Require pull request before merging
- (Optional) require status checks khi có CI

Agent không cấu hình GitHub settings hộ trừ khi user nhờ.

## Liên hệ deploy

Sau merge `main`: PaaS auto-deploy nếu đã gắn repo. Vẫn chạy migrate trước start — [`deployment.md`](./deployment.md).
