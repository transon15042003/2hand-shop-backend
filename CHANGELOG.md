# Changelog

All notable changes to this project are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [SemVer](https://semver.org/).

## [Unreleased]

### Changed

- Enriched agent-facing documentation under `docs/00-product` … `06-operations` and added Cursor/Claude/Superpowers entry points.
- Reorganized technical documentation into `docs/` tree aligned with agent-friendly layout (`00-product` … `06-operations`, `adr/`, `features/`).
- Added `AGENTS.md` as the entry point for commands and hard rules.

### Added

- OpenAPI contract copy at `docs/02-api/openapi.yaml` (synced from Frontend `HK Small Store/contracts/openapi.yaml`).

## [1.0.0] — 2026-10-04

### Added

- Express + TypeScript API skeleton with 3-layer architecture (Controller → Service → Repository).
- Drizzle schema: `shop_settings`, `batches`, `items`, `customers`, `customer_sessions`, `orders`, `order_items`, `cash_flow_entries`, `reconciliation_sessions`.
- Auth (customer OTP + long-lived session; admin JWT/session).
- Public items & orders endpoints; admin fulfillment & cash-flow summary.
- ADRs 000–007 covering scope, stack, cash flow, API contracts, deposit/return, settings snapshot, session, concurrency.
