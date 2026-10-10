# AGENTS.md — hk-small-store-backend

Hướng dẫn bắt buộc cho agent/developer khi làm việc với repo này.
Chi tiết nằm trong [`docs/`](docs/). Đọc đúng mục trước khi sửa code.

## Commands

```bash
pnpm install
cp .env.example .env          # điền DATABASE_URL, JWT_SECRET, ADMIN_SESSION_TOKEN
pnpm run db:generate          # drizzle-kit generate (tạo migration từ schema)
pnpm run db:migrate           # drizzle-kit migrate (apply migration)
pnpm run db:studio            # Drizzle Studio
pnpm run dev                  # tsx watch src/server.ts
pnpm run typecheck
pnpm run build
pnpm run start
```

Health check: `GET /api/health`

## Hard rules

1. **Schema là SSOT data model**: `src/db/schema.ts`. Không sửa SQL migration đã apply trên môi trường dùng chung.
2. **API contract là SSOT HTTP**: [`docs/02-api/openapi.yaml`](docs/02-api/openapi.yaml) (đồng bộ với Frontend `HK Small Store/contracts/openapi.yaml`). Endpoint mới/đổi phải cập nhật OpenAPI trước hoặc cùng PR.
3. **Layering**: Controller → Service → Repository. Controller không query DB. Repository không chứa business rule. Service không set HTTP status.
4. **1-of-1 invariant**: Tạo/hủy/trả đơn đụng tồn kho phải trong `db.transaction` + `SELECT ... FOR UPDATE`. Xem [`docs/04-domain/order-flow.md`](docs/04-domain/order-flow.md) và [`docs/03-database/transactions.md`](docs/03-database/transactions.md).
5. **Snapshot chính sách**: Cọc, phí ship, return fee, hold, `policy_version` snapshot vào `orders` lúc tạo. Không đọc lại `shop_settings` để tính đơn cũ.
6. **Validation**: Mọi body/query/params qua Zod middleware trước controller.
7. **Ngôn ngữ**: Code/DB/API = English. Thông điệp lỗi trả client + docs nghiệp vụ = tiếng Việt.
8. **Không log PII** (SĐT, email, địa chỉ, token thô). Xem [`docs/05-quality/security.md`](docs/05-quality/security.md).
9. **Không thêm dependency** nếu stdlib / package đã có đủ việc.
10. **Không sửa** `docs/adr/` đã chốt trừ khi viết ADR mới supersede.
11. **Git workflow & branching/merge rules**:
    - **Không commit thẳng `main`** (trừ hotfix khẩn cấp có user duyệt). Luôn bắt đầu từ `main` mới nhất (`git checkout main && git pull`).
    - **Tạo nhánh đúng trường hợp**: `feat/<slug>` (tính năng mới theo feature folder), `fix/<short>` (bugfix), `hotfix/<short>` (vá lỗi khẩn cấp prod), `chore/<short>` (tooling/deps/CI), `docs/<short>` (tài liệu/quy tắc), `refactor/<short>` (tái cấu trúc code).
    - **Quy trình merge khác nhau**:
      - *Squash and Merge* (mặc định) cho hầu hết PRs để giữ `main` sạch sẽ, tuyến tính, dễ revert.
      - *Merge Commit (`--no-ff`)* chỉ dùng khi gộp nhánh lớn (Epic) hoặc nhánh có chuỗi atomic commits quan trọng cần lưu vết lịch sử.
      - *Hotfix flow*: Review ưu tiên → Squash merge → Deploy prod ngay → Forward-fix DB nếu có.
      - *Đồng bộ FE*: PR Backend merge và deploy trước → sync OpenAPI sang FE repo → PR Frontend merge sau.
    - **Feature ship gate**: 1 nhánh/PR xong → commit → push → PR → merge `main` trước khi mở feature tiếp theo.
    - SSOT: [`docs/06-operations/git-workflow.md`](docs/06-operations/git-workflow.md), [`.cursor/rules/git-workflow.mdc`](.cursor/rules/git-workflow.mdc), [`.cursor/rules/feature-ship.mdc`](.cursor/rules/feature-ship.mdc).

## Docs map

| Mục | Nội dung |
|---|---|
| [`docs/00-product/`](docs/00-product/) | Vision, personas, glossary (+ lệch FE) |
| [`docs/01-architecture/`](docs/01-architecture/) | Overview, stack, layering, folder structure |
| [`docs/02-api/`](docs/02-api/) | REST guidelines, errors, auth, OpenAPI |
| [`docs/03-database/`](docs/03-database/) | Data model, `drizzle-conventions.md`, migrations, transactions |
| [`docs/04-domain/`](docs/04-domain/) | Item rules, order state machine, payment/COD |
| [`docs/05-quality/`](docs/05-quality/) | Testing, security, performance, DoD |
| [`docs/06-operations/`](docs/06-operations/) | Setup, [git workflow](docs/06-operations/git-workflow.md), deploy, observability, [agent stack](docs/06-operations/agent-stack.md) |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records (000–008+) |
| [`docs/features/`](docs/features/) | Spec / plan / tasks theo feature |
| [`docs/superpowers/`](docs/superpowers/) | Design specs & implementation plans (agent workflow) |

## Out of scope (MVP)

Không tích hợp cổng thanh toán tự động, API GHN/GHTK, Redis/BullMQ, WebSocket. Chi tiết: [`docs/adr/000-pham-vi.md`](docs/adr/000-pham-vi.md).
