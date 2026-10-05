# Backend Docs Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich all `hk-small-store-backend` docs and add FE-parity agent tooling (`CLAUDE.md`, `.cursor/rules`, `docs/superpowers/`) so agents can develop from `AGENTS.md` with BE-accurate content.

**Architecture:** Keep existing BE folder numbering. Expand thin markdown from live code (`src/db/schema.ts`, services, OpenAPI). Audit ADRs; fix FE links; add superseding ADR `008+` only when code truly diverges. Document FE drift without changing BE schema.

**Tech Stack:** Markdown docs only. Runtime stack documented (not changed): Express, Drizzle, Neon/Postgres, Zod, JWT/session per ADR 001/006.

## Global Constraints

- Scope A: tooling + fill content; BE `schema.ts` + `docs/02-api/openapi.yaml` = SSOT; note FE drift.
- Tree A: do not renumber folders (`00`…`06` stay).
- ADRs B: link fixes OK; real drift → new ADR supersede; do not silently rewrite sealed ADR bodies.
- Vietnamese business docs; English code/API names.
- No app/schema code changes. No wishlist/chat feature folders.
- **Do not `git commit` unless the human explicitly asks.**
- Spec: `docs/superpowers/specs/2026-10-05-backend-docs-enrichment-design.md`.
- Prefer working **in-repo** (avoid full-project worktree unless working tree is dangerously dirty).

## File map

| Path | Action |
|---|---|
| `CLAUDE.md` | Create `@AGENTS.md` |
| `.cursor/rules/hk-small-store-backend.mdc` | Create alwaysApply rule |
| `CHANGELOG.md` | Unreleased enrichment note |
| `AGENTS.md`, `docs/README.md` | Refresh if map grows |
| `docs/00-product/{vision,personas}.md` | Create |
| `docs/00-product/glossary.md` | Enrich + FE drift |
| `docs/01-architecture/*` | Enrich |
| `docs/02-api/*` | Enrich |
| `docs/03-database/*` | Enrich |
| `docs/04-domain/*` | Enrich |
| `docs/05-quality/*` | Enrich |
| `docs/06-operations/*` | Enrich |
| `docs/features/*` | Strengthen templates/README |
| `docs/adr/*` | Link fixes; optional `008+` |
| `docs/superpowers/plans/…` | This plan (already) |

---

### Task 1: Agent tooling scaffold

**Files:**
- Create: `CLAUDE.md`
- Create: `.cursor/rules/hk-small-store-backend.mdc`
- Modify: `CHANGELOG.md`
- Ensure: `docs/superpowers/specs/` and `plans/` exist (design already there)

**Interfaces:**
- Produces: agent entry parity with FE

- [ ] **Step 1: Write `CLAUDE.md`**

```markdown
@AGENTS.md
```

- [ ] **Step 2: Write `.cursor/rules/hk-small-store-backend.mdc`**

```markdown
---
description: hk-small-store-backend rules for agents
alwaysApply: true
---

# hk-small-store-backend

Read [`AGENTS.md`](../../AGENTS.md) before editing. Details under [`docs/`](../../docs/).

- Schema SSOT: `src/db/schema.ts`. HTTP SSOT: `docs/02-api/openapi.yaml`.
- Layering: Controller → Service → Repository.
- 1-of-1 + transactions: see `docs/04-domain/order-flow.md` and `docs/03-database/transactions.md`.
- Code/API = English; client errors + business docs = Vietnamese.
- Do not log PII. Do not rewrite sealed ADRs without supersede.
```

- [ ] **Step 3: Append CHANGELOG Unreleased**

Under `## [Unreleased]` / `### Changed` (create sections if missing):

```markdown
- Enriched agent-facing documentation under `docs/00-product` … `06-operations` and added Cursor/Claude/Superpowers entry points.
```

- [ ] **Step 4: Verify**

```bash
test -f CLAUDE.md && test -f .cursor/rules/hk-small-store-backend.mdc
grep -q 'Enriched agent-facing' CHANGELOG.md
test -f docs/superpowers/specs/2026-10-05-backend-docs-enrichment-design.md
```

- [ ] **Step 5: Commit only if human asked**

---

### Task 2: ADR audit (links + optional supersede)

**Files:**
- Modify: `docs/adr/000`…`007` headers only for FE link paths and optional “Superseded by” notes
- Create (if needed): `docs/adr/008-*.md`, update `docs/adr/README.md`

**Interfaces:**
- Consumes: `src/db/schema.ts`, OpenAPI, existing ADR text
- Produces: accurate ADR index + fixed FE links

- [ ] **Step 1: Build audit table** (write into report / end of `adr/README.md` short “Audit 2026-10-05” section)

Compare at minimum:

| Claim area | Check against |
|---|---|
| Categories / conditions | `itemCategoryEnum`, `itemConditionEnum` in `schema.ts` |
| Order / deposit / payment enums | schema enums |
| Session | ADR 006 vs auth/session code |
| Concurrency | ADR 007 vs order services + `transactions.md` |
| OpenAPI authority | ADR 003 vs `docs/02-api/openapi.yaml` |

- [ ] **Step 2: Fix FE links** in ADR 000, 002, 004, 005, 006 (and any others):

Replace  
`../../../HK Small Store/docs/decisions/<file>.md`  
with  
`../../../HK Small Store/docs/adr/<file>.md`  
(FE ADR 003 filename may be `003-ui-mock-completion.md` — do not invent backend’s API ADR on FE.)

- [ ] **Step 3: If audit finds real sealed-ADR vs code conflict**

- Add `docs/adr/008-<slug>.md` with Context / Decision / Consequences / “Supersedes: 00N §…”
- Add one-line header on old ADR: `Trạng thái: Superseded by 008-…`
- Update `docs/adr/README.md` index

If no conflict: skip 008; note “no supersede needed” in verify report.

- [ ] **Step 4: Verify**

```bash
! grep -R 'docs/decisions/' docs/adr/*.md || true
# expect no FE decisions links remaining (stubs on FE still ok to mention historically)
grep -n 'docs/adr/' docs/adr/000-pham-vi.md docs/adr/006-customer-session.md | head
```

- [ ] **Step 5: Commit only if human asked**

---

### Task 3: Product docs (`00-product`)

**Files:**
- Create: `docs/00-product/vision.md`, `personas.md`
- Modify: `docs/00-product/glossary.md`

**Interfaces:**
- Consumes: ADR 000, schema enums, existing glossary
- Produces: product entry + ubiquitous language SSOT for BE

- [ ] **Step 1: `vision.md`**

Single-owner thrift API backend; authority of truth for inventory/orders/money; contrast multi-seller marketplace. Link ADR 000.

- [ ] **Step 2: `personas.md`**

Customer (phone/email OTP, orders) + Admin/shop owner (`/admin` via API). No multi-seller.

- [ ] **Step 3: Enrich `glossary.md`**

Paste/verify enums from schema (categories 13 values; conditions `like_new|excellent|good|fair`; item/order/payment/deposit statuses as in schema). Add section:

```markdown
## Lệch Frontend (cố ý ghi nhận)

| Chủ đề | Backend (SSOT repo này) | Frontend (tham chiếu) |
|---|---|---|
| category | 13 giá trị `t_shirts`…`accessories` | Contract FE historically fewer groups (`tops`…) |
| condition | 4 giá trị | FE may include `new`, `attention_required` |
```

Fill FE column from current FE glossary/OpenAPI when reading sibling repo; do not “fix” BE to match.

- [ ] **Step 4: Verify**

```bash
grep -q 't_shirts' docs/00-product/glossary.md
grep -q 'Lệch Frontend' docs/00-product/glossary.md
test -f docs/00-product/vision.md && test -f docs/00-product/personas.md
```

- [ ] **Step 5: Commit only if human asked**

---

### Task 4: Architecture + API + Database

**Files:**
- Modify: `docs/01-architecture/{overview,tech-stack,layering,folder-structure}.md`
- Modify: `docs/02-api/{api-guidelines,error-handling,auth}.md`
- Modify: `docs/03-database/{data-model,drizzle-conventions,migrations,transactions}.md`
- Leave: `prisma-conventions.md` as redirect

**Interfaces:**
- Consumes: `src/app.ts`, `src/server.ts`, folder list under `src/`, schema
- Produces: accurate BE system docs

- [ ] **Step 1: Architecture** — document Express entry, layering Controller→Service→Repository, real folders (`controllers/`, `services/`, `repositories/`, `db/`, `dtos/`, `middlewares/`, `routes/`).

- [ ] **Step 2: API** — REST conventions, Zod middleware, AppError codes, customer vs admin auth, OpenAPI sync rule with FE `HK Small Store/contracts/openapi.yaml`.

- [ ] **Step 3: Database** — table list from schema; Drizzle generate/migrate commands; transaction + `FOR UPDATE` rules aligned with ADR 007 / order-flow.

- [ ] **Step 4: Verify**

```bash
grep -q 'Controller' docs/01-architecture/layering.md
grep -q 'openapi.yaml' docs/02-api/api-guidelines.md
grep -q 'FOR UPDATE' docs/03-database/transactions.md
grep -q 'Drizzle' docs/03-database/prisma-conventions.md
```

- [ ] **Step 5: Commit only if human asked**

---

### Task 5: Domain + Quality + Operations + Features

**Files:**
- Modify: `docs/04-domain/{listing-rules,order-flow,payment}.md`
- Modify: `docs/05-quality/{testing,security,performance,definition-of-done}.md`
- Modify: `docs/06-operations/{setup,deployment,observability}.md`
- Modify: `docs/features/README.md`, `_template/*`
- Modify: `AGENTS.md`, `docs/README.md` if needed
- Modify: design status → `implemented` when done

**Interfaces:**
- Consumes: domain services, quality scripts (typecheck), setup `.env.example`
- Produces: complete agent surface

- [ ] **Step 1: Domain** — Item visibility/1-of-1; order state machine + hold/deposit; COD/bank_transfer + reconciliation. Opening of listing-rules: domain term **Item**.

- [ ] **Step 2: Quality** — Expand DoD checklist; testing = current `typecheck` + future Vitest/supertest goals (no fake coverage %); security = no PII logs, authZ, secrets; performance = query/index notes for hot paths.

- [ ] **Step 3: Operations** — env vars from `.env.example`; migrate/deploy notes; observability (structured logs without PII).

- [ ] **Step 4: Features** — keep slug table; templates require Problem/Scope/AC + plan file touches + ordered tasks.

- [ ] **Step 5: Refresh `docs/README.md`** to include vision/personas and superpowers pointers.

- [ ] **Step 6: Verify**

```bash
find docs/00-product docs/01-architecture docs/02-api docs/03-database docs/04-domain docs/05-quality docs/06-operations docs/adr docs/features -name '*.md' | wc -l
test -f CLAUDE.md && test -f .cursor/rules/hk-small-store-backend.mdc
grep -q 'Item' docs/04-domain/listing-rules.md
# AGENTS map paths exist
for p in docs/00-product/glossary.md docs/04-domain/order-flow.md docs/03-database/transactions.md docs/05-quality/security.md; do test -f "$p" || echo MISS $p; done
```

- [ ] **Step 7: Set design Status: implemented**

- [ ] **Step 8: Commit only if human asked**

---

## Spec coverage checklist

| Spec item | Task |
|---|---|
| CLAUDE + cursor rules + superpowers | 1 |
| CHANGELOG | 1 |
| ADR links + optional supersede | 2 |
| vision/personas/glossary + FE drift | 3 |
| architecture/api/database enrich | 4 |
| domain/quality/ops/features | 5 |
| AGENTS/docs README refresh | 5 |
| No renumber / no app code | Global |
| No commit unless asked | Every task |

## Placeholder scan

No TBD steps; verification commands concrete; ADR 008 conditional with explicit skip path.
