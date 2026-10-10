# Git workflow (backend)

SSOT quy trình Git cho `hk-small-store-backend`. Agent và người cùng tuân thủ.  
Gắn với feature ship: [`.cursor/rules/feature-ship.mdc`](../../.cursor/rules/feature-ship.mdc) và [`git-workflow.mdc`](../../.cursor/rules/git-workflow.mdc).

## Mục tiêu

- `main` luôn **deployable** (typecheck + migrate đã apply trên staging/local trước khi merge).
- Mỗi feature slug = **một nhánh + một PR** → lịch sử `main` đọc được.
- Không đẩy secret; không force-push `main`.

## Mô hình nhánh & Các trường hợp tạo nhánh

Mọi nhánh đều phải xuất phát từ `main` mới nhất (`git checkout main && git pull`). Tuyệt đối không phân nhánh từ một feature branch khác chưa được merge trừ khi có yêu cầu phụ thuộc đặc biệt đã thỏa thuận.

| Loại nhánh | Quy ước đặt tên | Trường hợp sử dụng & Lưu ý |
|---|---|---|
| **Feature** | `feat/<slug>` | **Tính năng mới**: Tương ứng với feature folder trong `docs/features/<slug>/` (vd: `feat/order-concurrency`, `feat/customer-auth`). Phải hoàn thiện AC, cập nhật spec/tasks trước khi merge. |
| **Bugfix** | `fix/<short>` | **Sửa lỗi thông thường**: Fix lỗi phát hiện trong quá trình phát triển/staging không thuộc phạm vi feature folder riêng (vd: `fix/hold-expire-npe`, `fix/email-resend-headers`). |
| **Hotfix** | `hotfix/<short>` | **Vá lỗi khẩn cấp production**: Lỗi nghiêm trọng ảnh hưởng trực tiếp đến người dùng/hệ thống live (vd: `hotfix/crash-checkout-token`). Phạm vi sửa tối thiểu, review và merge ưu tiên. |
| **Chore / Tooling** | `chore/<short>` | **Công cụ & Hạ tầng**: Cập nhật dependencies, CI/CD, script build/deploy, linter cấu hình (vd: `chore/ci-typecheck`, `chore/bump-drizzle`). Không thay đổi business logic. |
| **Documentation** | `docs/<short>` | **Tài liệu & Quy tắc**: Chỉ chỉnh sửa tài liệu, specs, rules, ADRs (vd: `docs/git-workflow`, `docs/update-policy`). Không ảnh hưởng đến runtime code hay DB schema. |
| **Refactor** | `refactor/<short>` | **Tái cấu trúc**: Cải thiện cấu trúc mã nguồn, tối ưu hiệu năng nội bộ mà không làm thay đổi contract API hay nghiệp vụ người dùng (vd: `refactor/order-service-layering`). |
| **Main (Trunk)** | `main` | **Production / Nguồn sự thật**: Luôn ở trạng thái deployable. **Không** commit trực tiếp (trừ trường hợp hotfix khẩn cấp đặc biệt có xác nhận tường minh từ user). |

> **Nguyên tắc cô lập nhánh**:
> - Mỗi nhánh sống ngắn (short-lived, lý tưởng < vài ngày).
> - 1 nhánh = 1 mục tiêu (1 feature / 1 bugfix / 1 chore) = 1 PR. Không gộp nhiều mục đích vào cùng một nhánh.
> - Sau khi PR được merge vào `main`, phải xóa nhánh remote và nhánh local tương ứng.

## Vòng đời chuẩn của một nhánh

```bash
# 1. Đồng bộ mã nguồn mới nhất từ main
git checkout main && git pull

# 2. Tạo nhánh theo đúng tiền tố trường hợp
git checkout -b feat/<slug>   # hoặc fix/<short>, hotfix/<short>, chore/<short>, docs/<short>

# 3. Thực hiện công việc
# - Với feature: Viết/cập nhật docs/features/<slug>/{spec,plan,tasks}.md
# - Code + typecheck (pnpm run typecheck) + runnable check
# - Tick AC trên spec/tasks; cập nhật docs/features/README.md nếu có

# 4. Commit các thay đổi (1 hoặc nhiều commit có ý nghĩa rõ ràng, nêu lý do why)
git add <files>
git commit -m "feat(scope): concise why message"

# 5. Push lên remote và tạo PR
git push -u origin HEAD
gh pr create

# 6. Thực hiện quy trình merge phù hợp (xem chi tiết mục 'Quy trình merge')
# 7. Đồng bộ lại main và dọn dẹp nhánh sau khi merge thành công
git checkout main && git pull
git branch -d feat/<slug>

# 8. Chỉ bắt đầu nhánh/feature tiếp theo sau khi nhánh hiện tại đã được merge hoàn tất
```

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

## Pull request & Tiêu chuẩn kiểm thử

- **Title**: Ngắn, đúng quy ước Conventional Commits có slug hoặc phạm vi (vd: `feat: order-concurrency` hoặc `fix: hold-expire-npe`).
- **Body** tối thiểu:

```markdown
## Summary
- Tóm tắt thay đổi chính...
- Lý do thay đổi (why)...

## Test plan
- [ ] pnpm run typecheck (bắt buộc)
- [ ] pnpm run build (bắt buộc)
- [ ] pnpm run db:migrate (nếu có migration mới)
- [ ] API manual verification / Postman (nếu có endpoint mới)
```

- **Nguyên tắc PR**:
  - 1 PR = 1 nhánh = 1 mục tiêu duy nhất. Không gộp nhiều feature khác nhau vào cùng một PR trừ khi user yêu cầu tường minh.
  - Sau khi PR được merge: Xóa ngay nhánh remote trên GitHub và dọn dẹp nhánh local.

## Các quy trình merge khác nhau & Chiến lược áp dụng

Tùy thuộc vào bản chất thay đổi của nhánh, dự án áp dụng các chiến lược và quy trình merge khác nhau:

### 1. Squash and Merge (Chiến lược mặc định cho đa số PR)

- **Khi nào áp dụng**:
  - Mặc định cho hầu hết các nhánh `feat/*`, `fix/*`, `chore/*`, `docs/*`.
- **Cơ chế**:
  - Toàn bộ các commit trên nhánh (bao gồm commit dở dang, fix lint, typo) được gộp (squash) thành duy nhất **1 commit** sạch trên `main`.
- **Lợi ích**:
  - Lịch sử `main` tuyến tính, rõ ràng, dễ theo dõi.
  - Dễ dàng rollback/revert toàn bộ feature chỉ với một lệnh `git revert <commit-hash>` mà không để lại vết lỗi dở dang.
- **Quy tắc commit message khi Squash**:
  - Tiêu đề commit squash phải theo chuẩn: `<type>(<scope>): <mô tả ngắn> (#<PR_NUMBER>)`  
    *(Vd: `feat(order-concurrency): lock items with FOR UPDATE on create (#15)`)*.

### 2. Merge Commit (`--no-ff` - Giữ nguyên lịch sử commit con)

- **Khi nào áp dụng**:
  - Nhánh tính năng quy mô lớn (Epic branch) tích hợp nhiều sub-features từ các nhánh con.
  - Nhánh có chuỗi atomic commits độc lập mang ý nghĩa kiến trúc riêng biệt cần bảo toàn lịch sử phát triển từng bước (vd: chuỗi refactor lớn qua nhiều tầng architectural layers hoặc chuỗi migration DB phức tạp nhiều giai đoạn).
- **Cơ chế**:
  - Git giữ nguyên tất cả các commit con của nhánh và tạo thêm một **Merge commit** nối nhánh vào `main`.
- **Lưu ý bắt buộc**:
  - Từng commit con trên nhánh phải được dọn dẹp sạch sẽ, có commit message chuẩn chỉnh trước khi merge. Tuyệt đối không dùng Merge Commit nếu nhánh chứa các commit rác như "wip", "fix typo", "test".

### 3. Quy trình Merge Hotfix Production (Quy trình khẩn cấp)

- **Khi nào áp dụng**:
  - Sự cố nghiêm trọng (P0/P1) trực tiếp trên production cần khắc phục tức thì (`hotfix/<short>`).
- **Quy trình thực hiện**:
  1. Tạo nhánh `hotfix/<short>` trực tiếp từ HEAD của `main`.
  2. Sửa đổi tối thiểu (minimal diff), không kèm refactor hay tính năng mới.
  3. Chạy kiểm tra bắt buộc: `pnpm run typecheck` + test luồng lỗi cục bộ.
  4. Mở PR, gắn tag/tiêu đề `[HOTFIX]` để ưu tiên duyệt nhanh.
  5. Thực hiện **Squash and Merge** vào `main`.
  6. Kích hoạt auto/manual deploy lên production ngay sau khi merge.
  7. Giám sát logs sau deploy. Nếu lỗi liên quan đến Database, chỉ dùng **forward-fix** (viết migration sửa tiếp), không revert migration phá hủy dữ liệu live.

### 4. Quy trình Merge có phụ thuộc Frontend (Contract-Sync Flow)

- **Khi nào áp dụng**:
  - Bất kỳ PR nào có thay đổi HTTP API contract (`docs/02-api/openapi.yaml`).
- **Thứ tự thực hiện bắt buộc**:
  1. **PR Backend merge trước**: Cập nhật logic, OpenAPI spec và merge vào `main` của backend.
  2. **Deploy Backend**: Đảm bảo backend đã deploy lên staging/production để sẵn sàng phục vụ endpoint mới.
  3. **Đồng bộ Contract sang Frontend**: Copy cập nhật spec sang repo Frontend (`HK Small Store/contracts/openapi.yaml`).
  4. **PR Frontend merge sau**: Frontend kiểm thử tích hợp thực tế với backend staging và merge PR của FE.
  *(Tuyệt đối không merge PR FE trước khi API BE được merge và deploy, tránh lỗi breaking giao diện).*

## Checklist bắt buộc trước khi Merge (Pre-merge Gates)

Trước khi bấm Merge bất kỳ PR nào vào `main`, phải xác nhận:

- [ ] Nhánh đã được rebase/merge cập nhật code mới nhất từ `main` (không bị conflict).
- [ ] Chạy `pnpm run typecheck` đạt kết quả xanh (0 error).
- [ ] Chạy `pnpm run build` thành công.
- [ ] Nếu có thay đổi DB: Đã review file SQL do `pnpm run db:generate` sinh ra, đã chạy thử `pnpm run db:migrate` trên DB cục bộ.
- [ ] Không có file nhạy cảm lọt vào commit (`.env`, secret token, file log, database dump).
- [ ] Các tiêu chí chấp nhận (Acceptance Criteria) trong task/spec đã được đánh dấu hoàn thành.

## Đồng bộ Frontend

- Contract HTTP: BE `docs/02-api/openapi.yaml` ↔ FE `contracts/openapi.yaml`.
- FE phụ thuộc API mới → **merge PR BE trước**, rồi PR FE; link chéo trong body.
- FE SSOT quy trình: `HK Small Store/docs/02-conventions/git-workflow.md` (cùng mô hình trunk + squash + slug).

## Bảo vệ `main` (khuyến nghị GitHub)

Settings → Branches → protect `main`:

- Require pull request before merging
- (Optional) require status checks khi có CI

Agent không cấu hình GitHub settings hộ trừ khi user nhờ.

## Liên hệ deploy

Sau merge `main`: PaaS auto-deploy nếu đã gắn repo. Vẫn chạy migrate trước start — [`deployment.md`](./deployment.md).
