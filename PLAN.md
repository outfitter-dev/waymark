<!-- tldr ::: execution roadmap and decision log for the Waymark v1 rebuild -->

# Waymark Build Plan

## How to Use This Plan

- Read @PRD.md and this plan before starting any task.
- Work from the shared branch (`gt-v1.0/rewrite`) unless the plan explicitly calls for a feature branch.
- Update checkboxes as work progresses; include brief notes or links next to checked items.
- Record major decisions in the Decisions Log with enough context for future agents.
- Follow the v1 signal grammar: only `*` and a single `!`; never use `!!` or other signal variants.

## Phase 1 — Specification & Project Hygiene (In Progress)

- [x] Archive superseded specs into `.agents/.archive/20250926-*`.
- [x] Refresh `SCRATCHPAD.md` for current-cycle notes.
- [x] Consolidate the authoritative spec in `PRD.md`.
- [ ] Keep `PRD.md` and `PLAN.md` synchronized with new discoveries.

## Phase 2 — `@waymarks/grammar` & `@waymarks/core` Foundations (In Progress)

- [x] Scaffold the `@waymarks/grammar` package for minimal, stable parser (Bun/TypeScript setup).
- [x] Scaffold the `@waymarks/core` workspace package with dependency on grammar.
- [x] Move core type definitions (`WaymarkRecord`, `ParseOptions`) to `@waymarks/grammar`.
- [x] Implement basic parser skeleton in grammar package.
- [x] Keep utility types (`WaymarkConfig`, `ScanOptions`) in `@waymarks/core`.
- [x] Implement SQLite cache module using `bun:sqlite` for parsed records and dependency graphs.
- [ ] Complete parser implementation with full waymark grammar support.
- [ ] Implement normalizer exports (`format`, `search`, `graph`, `map`, `config`) in core.
- [ ] Add cache invalidation based on file mtime/size tracking.
- [ ] Implement transaction-based batch inserts for cache performance.
- [ ] Add search indices for markers, content, and dependency relations.
- [ ] Establish shared JSON Schemas under `schemas/`.
- [ ] Add unit tests covering grammar edge cases and record normalization.
- [ ] Add unit tests for cache operations and invalidation logic.

## Phase 3 — `@waymarks/cli` Implementation (Pending)

- [ ] Scaffold CLI package with Bun entrypoint and command registry.
- [ ] Wire commands (`scan`, `find`, `map`, `fmt`, `lint`, `graph`, `migrate`, `tui`) to `@waymarks/core`.
- [ ] Implement `--scope` configuration handling and XDG path resolution.
- [ ] Provide human-readable, JSONL, and machine-output formats with snapshot tests.

## Phase 4 — Agent Toolkit & MCP Integrations (Pending)

- [ ] Publish rule packs under `@waymarks/agents/rules` and document installation flow.
- [ ] Generate command/instruction assets for Claude, Cursor, Gemini, etc.
- [ ] Implement `waymark agents install` to sync `.waymark/rules/` and update `AGENTS.md`/`CLAUDE.md` when approved.
- [ ] Prototype the thin `@waymarks/mcp` server that shells out to the CLI and respects repo config.

## Phase 5 — Documentation, QA, and Release Prep (Pending)

- [ ] Create or update guides in `docs/agents/` and broader docs to reflect new tooling.
- [ ] Configure CI (lint/test workflows, publish dry runs) and release automation.
- [ ] Draft migration notes and announce availability of the new CLI and agent toolkit.
- [ ] Tag an initial prerelease once acceptance criteria are met.

## Decisions Log

<!-- Add new entries as decisions are made. Example format: `- 2025-09-26: Adopt Bun for CLI runtime (reason…)` -->

- 2025-09-26: Finalize waymark grammar and PRD.md.
- 2025-09-26: Adopt Bun's native SQLite (`bun:sqlite`) for caching layer (zero dependencies, excellent performance, XDG-compliant storage).
- 2025-09-26: Design SQLite schema with WAL mode for concurrent access and prepared statements for sub-millisecond lookups.
- 2025-09-26: Separate `@waymarks/grammar` from `@waymarks/core` for architectural isolation (grammar remains minimal and stable while core can evolve with opinions and utilities).
