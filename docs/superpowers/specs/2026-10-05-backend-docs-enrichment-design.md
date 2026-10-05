# Design: Backend docs enrichment + agent tooling parity

Date: 2026-10-05  
Status: implemented  
Repo: `hk-small-store-backend`

## Goal

Make `hk-small-store-backend` agent-ready like the frontend: start from `AGENTS.md`, rich accurate docs under the existing BE tree, Superpowers workflow (`docs/superpowers/specs|plans`), and Cursor/Claude entry files. Content must match **backend code** as SSOT; note Frontend divergences instead of rewriting BE docs to look like FE.

## Decisions locked with product owner

| # | Choice |
|---|---|
| Scope | **A** — Agent tooling parity + fill all docs content; BE schema + OpenAPI = SSOT; document FE drift |
| Tree | **A** — Keep current BE numbering (`00-product` … `02-api` … `03-database` … `06-operations`) |
| ADRs | **B** — Audit vs code; fix broken links; when real drift exists, add superseding ADR `008+` (do not silently rewrite sealed ADR bodies) |
| Approach | Enrich + ADR audit (not full rewrite from scratch) |

## Current state (baseline)

Already present: `AGENTS.md`, `docs/00`…`06`, `docs/adr/000`–`007`, `docs/features/_template`, `CHANGELOG.md`, `CONTEXT.md` stub → glossary.

Gaps vs FE agent setup:

- No `CLAUDE.md`, no `.cursor/rules/`
- No `docs/superpowers/`
- No `00-product/vision.md` / `personas.md`
- Several guides are thin (DoD ~16 lines, testing ~26, etc.)
- Glossary / enums can drift from FE OpenAPI (BE: 13 `item_category` values; 4 `item_condition` values — from `src/db/schema.ts`)
- Some ADRs link to FE `docs/decisions/` (should be `docs/adr/` after FE restructure)

## Target additions / updates

```
hk-small-store-backend/
├── AGENTS.md                         # refresh docs map if needed
├── CLAUDE.md                         # NEW → @AGENTS.md
├── .cursor/rules/hk-small-store-backend.mdc  # NEW
├── CHANGELOG.md                      # Unreleased note
└── docs/
    ├── README.md                     # refresh index
    ├── 00-product/
    │   ├── glossary.md               # enrich + FE drift table
    │   ├── vision.md                 # NEW
    │   └── personas.md               # NEW
    ├── 01-architecture/              # enrich from real src/
    ├── 02-api/                       # enrich; OpenAPI stays SSOT HTTP
    ├── 03-database/                  # enrich; prisma-conventions stays redirect
    ├── 04-domain/                    # enrich
    ├── 05-quality/                   # enrich
    ├── 06-operations/                # enrich
    ├── adr/                          # link fixes; optional 008+ supersede
    ├── features/                     # clearer templates / README
    └── superpowers/                  # NEW
        ├── specs/
        └── plans/
```

Keep tree numbering. Do not invent wishlist/chat features.

## Content rules

1. **Code SSOT:** `src/db/schema.ts`, controllers/services/repositories, `docs/02-api/openapi.yaml`.
2. **Language:** Code/API English; business docs + client errors Vietnamese (unchanged).
3. **FE drift:** Explicit section in glossary (and data-model if needed). Do not change BE docs to pretend enums match FE if schema differs.
4. **ADRs:** Prefer “Superseded by 00X” header + new ADR over rewriting sealed decisions. Link-only edits to FE paths are allowed on old ADRs.
5. **Features:** Keep slug table; strengthen `_template`; no fake feature folders.

## ADR audit plan

| Step | Action |
|---|---|
| 1 | Diff ADR claims vs schema/services/OpenAPI |
| 2 | Fix FE links `…/docs/decisions/…` → `…/docs/adr/…` |
| 3 | For real mismatches: write `008-*.md` (or next free number) superseding the affected slice |
| 4 | Record audit table in the implementation plan / report |

Likely drift candidates (to verify during implement, not assumed): category/condition enums vs FE contract; any session/auth details; concurrency wording vs `FOR UPDATE` usage.

## Implementation order

1. Scaffold agent tooling + `docs/superpowers/` + CHANGELOG note  
2. ADR audit (links + optional supersede)  
3. Enrich docs `00` → `06` + `features`  
4. Touch `AGENTS.md` / `docs/README.md` if map changes  
5. Internal link check  

Execution: Superpowers writing-plans → task checklist → subagent-driven or inline (owner choice). **No commit unless owner asks.**

## Explicit non-goals

- Changing application code / schema to match Frontend  
- Renumbering folders to mirror FE (`02-conventions`, etc.)  
- Full deletion/rewrite of all existing markdown  
- Push/PR unless requested  

## Success criteria

- [ ] `AGENTS.md` reaches every major topic  
- [ ] Glossary + data-model match `schema.ts`; FE drift documented  
- [ ] `CLAUDE.md`, `.cursor/rules/`, `docs/superpowers/` exist  
- [ ] ADR links to FE use `docs/adr/`; supersedes used when needed  
- [ ] Folder numbering unchanged; no wishlist/chat feature dirs  
- [ ] CHANGELOG Unreleased mentions docs enrichment  

## Follow-up after approval

1. Owner reviews this file  
2. writing-plans → `docs/superpowers/plans/2026-10-05-backend-docs-enrichment.md`  
3. Execute plan (docs + agent tooling only)
