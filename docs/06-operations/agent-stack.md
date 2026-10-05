# Agent stack (backend)

Stack agent cho repo này — lấy từ bản đồ [`agent-notes`](../../../agent-notes/) (harness / skills / memory / tools / cost). Chỉ một methodology chính.

## Đang dùng

| Lớp | Công cụ | Việc |
|---|---|---|
| Methodology | **superpowers** | Brainstorm → design → plan trước khi code; ghi vào [`../features/`](../features/) và [`../superpowers/`](../superpowers/) |
| Độ dài code | **ponytail** | Diff ngắn; giữ Controller → Service → Repository; không abstraction mới |
| Plan trên đĩa | `docs/features/` + `docs/superpowers/` | Sống sau `/clear`; template: [`../features/_template/`](../features/_template/) |
| Luật repo | [`AGENTS.md`](../../AGENTS.md) + `.cursor/rules/` | SSOT hành vi agent trong project |

## P1 — cách bật

| Khi | Công cụ | Cách |
|---|---|---|
| Align trước ticket domain / concurrency | **grill** / **diagnosing-bugs** | Skill sẵn: `~/.agents/skills/grilling/SKILL.md`, `~/.agents/skills/diagnosing-bugs/SKILL.md` — đọc và follow **trước** khi sửa `FOR UPDATE`, snapshot policy, state machine |
| Repo phình, cần map impact | **codegraph** hoặc **graphify** | Chưa cài MVP; bật khi schema/service khó grep tay |
| PR / sync OpenAPI FE↔BE | **github-mcp** | MCP GitHub đã có trên Cursor khi cần PR/review contract |
| Session debug dài | **caveman** hoặc **claude-hud** | `npx skills add JuliusBrussee/caveman -g` khi output dài đốt token |

## Không dùng (MVP)

ECC, gstack, ui-ux-pro-max, playwright (trừ E2E full-stack có chủ đích), firecrawl — đừng chồng methodology hoặc MCP catalog.

## Gate tối thiểu

Feature đụng domain, tồn kho, hoặc API: có `docs/features/<name>/spec.md` (hoặc cập nhật `04-domain` / ADR) trước khi merge — cũng nằm trong [`../05-quality/definition-of-done.md`](../05-quality/definition-of-done.md). Đổi endpoint → [`../02-api/openapi.yaml`](../02-api/openapi.yaml) cùng PR và đồng bộ `2hand-shop/contracts/openapi.yaml`.

**Ship**: feature xong → commit trên `feat/<slug>` → push → PR → merge `main` (xem [`git-workflow.md`](./git-workflow.md) + [`.cursor/rules/feature-ship.mdc`](../../.cursor/rules/feature-ship.mdc)); không mở feature kế khi chưa merge.
