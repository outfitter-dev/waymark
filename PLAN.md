<!-- tldr ::: execution roadmap and decision log for the Waymark v1 rebuild -->

# Waymark Build Plan

## How to Use This Plan

- Read @PRD.md and this plan before starting any task.
- Work from the shared branch (`gt-v1.0/rewrite`) unless the plan explicitly calls for a feature branch.
- Update checkboxes as work progresses; include brief notes or links next to checked items.
- Record major decisions in the Decisions Log with enough context for future agents.
- Follow the v1 signal grammar: only `^` and a single `*`; never use `^^`, `**`, or other signal variants.
- See @IMPROVEMENTS.md for detailed CLI ergonomics refactoring checklist (short-term working document).

## Phase 1 — Specification & Project Hygiene (Complete)

- [x] Archive superseded specs into `.agents/.archive/20250926-*`.
- [x] Refresh `SCRATCHPAD.md` for current-cycle notes.
- [x] Consolidate the authoritative spec in `PRD.md`.
- [x] Keep `PRD.md` and `PLAN.md` synchronized with new discoveries.

## Phase 2 — `@waymarks/grammar` & `@waymarks/core` Foundations (Complete)

- [x] Scaffold the `@waymarks/grammar` package for minimal, stable parser (Bun/TypeScript setup).
- [x] Scaffold the `@waymarks/core` workspace package with dependency on grammar.
- [x] Move core type definitions (`WaymarkRecord`, `ParseOptions`) to `@waymarks/grammar`.
- [x] Implement basic parser skeleton in grammar package.
- [x] Keep utility types (`WaymarkConfig`, `ScanOptions`) in `@waymarks/core`.
- [x] Implement SQLite cache module using `bun:sqlite` for parsed records and dependency graphs.
- [x] Complete parser implementation with full waymark grammar support.
- [x] Implement normalizer exports (`format`, `search`, `graph`, `map`, `config`) in core.
- [x] Add cache invalidation based on file mtime/size tracking.
- [x] Implement transaction-based batch inserts for cache performance.
- [x] Add search indices for markers, content, and dependency relations.
- [x] Establish shared JSON Schemas under `schemas/`.
- [x] Add unit tests covering grammar edge cases.
- [x] Add unit tests for record normalization (normalize.test.ts).
- [x] Add unit tests for cache operations and invalidation logic.

## Phase 3 — `@waymarks/cli` Implementation (Near Complete)

- [x] Scaffold CLI package with Bun entrypoint and command registry.
- [x] Wire commands (`scan`, `find`, `map`, `fmt`, `lint`, `graph`, `migrate`) to `@waymarks/core`.
- [ ] Wire `tui` command (deferred to Phase 5).
- [x] Implement `--scope` configuration handling and XDG path resolution.
- [x] Provide human-readable, JSONL, and machine-output formats with snapshot tests.

## Phase 3a — Quality Cleanup & Hardening (Complete)

- [x] Restore production normalization module under `@waymarks/core` and ensure tests exercise real exports.
- [x] Persist and hydrate full record metadata in `WaymarkCache` (language, comment leader, indent, raw, etc.).
- [x] Parameterize cache search queries to avoid raw string `LIKE` interpolation and escape wildcards.
- [x] Reconcile JSON schema defaults with runtime `DEFAULT_CONFIG`, updating code or schema plus docs/tests accordingly.

## Phase 4 — Agent Toolkit & MCP Integrations (In Progress)

- [ ] Publish rule packs under `@waymarks/agents/rules` and document installation flow.
- [ ] Generate command/instruction assets for Claude, Cursor, Gemini, etc.
- [ ] Implement `waymark agents install` to sync `.waymark/rules/` and update `AGENTS.md`/`CLAUDE.md` when approved.
- [ ] Scaffold `@waymarks/mcp` package exposing an MCP server that wraps the CLI over stdio.
- [ ] Support core MCP methods (`list_tools`, `call_tool`) by delegating to CLI commands with shared config loading.
- [ ] Add integration/utility tests for MCP server helpers and document server usage for agents.

## Phase 5 — Documentation, QA, and Release Prep (Pending)

- [ ] Create or update guides in `docs/agents/` and broader docs to reflect new tooling.
- [ ] Configure CI (lint/test workflows, publish dry runs) and release automation.
- [ ] Update CLI installation scripts for production use:
  - [ ] Change `install:bin` from symlink to copy for stable installation
  - [ ] Add `install:dev` script with symlink (or use `wmtest` for dev binary name)
  - [ ] Document installation methods in README
- [ ] Draft migration notes and announce availability of the new CLI and agent toolkit.
- [ ] Tag an initial prerelease once acceptance criteria are met.
- [ ] Evaluate terminal UI prototypes (see docs/waymark/tui-ab-plan.md) and select approach.
- [ ] Expose marker categories/aliases in CLI tooling (e.g., `waymark find --category work`, alias normalization).

## Phase 3a — Multi-line Grammar Update (Complete)

- [x] Update multi-line waymark syntax from `...` to markerless `:::`
  - [x] Update PRD.md multi-line section
  - [x] Update docs/waymark/SPEC.md examples
  - [x] Update .waymark/rules/WAYMARKS.md documentation
  - [x] Refactor parser.ts to recognize markerless `:::` as continuation
  - [x] Update parser tests for new continuation syntax
  - [x] Update formatter to handle aligned `:::` continuations
  - [x] Update formatter tests
  - [x] Document decision in PLAN.md log
- [x] Implement property-as-marker in continuation context
  - [x] Parser tracks waymark context (previous line state)
  - [x] Recognize `// property ::: value` pattern in continuations
  - [x] Fold property continuations into parent waymark
  - [x] Update search/indexing to aggregate continuations
- [x] Add formatting configuration
  - [x] Add `format.alignContinuations` config option (default: true)
  - [x] Implement alignment logic in formatter

## Decisions Log

<!-- Add new entries as decisions are made. Example format: `- 2025-09-26: Adopt Bun for CLI runtime (reason…)` -->

- 2025-09-26: Finalize waymark grammar and PRD.md.
- 2025-09-26: Adopt Bun's native SQLite (`bun:sqlite`) for caching layer (zero dependencies, excellent performance, XDG-compliant storage).
- 2025-09-26: Design SQLite schema with WAL mode for concurrent access and prepared statements for sub-millisecond lookups.
- 2025-09-26: Separate `@waymarks/grammar` from `@waymarks/core` for architectural isolation (grammar remains minimal and stable while core can evolve with opinions and utilities).
- 2025-09-26: Landed full v1 parser implementation with multi-line handling, property extraction, and token categorization.
- 2025-09-26: CLI cache handling stays implicit inside `waymark scan`; no standalone cache command planned.
- 2025-09-27: CLI resolves scoped configs via XDG paths with tests covering project/user/default discovery.
- 2025-09-27: Break `@waymarks/cli` entrypoint into per-command modules with shared utilities to keep handlers focused and testable.
- 2025-09-27: Enhanced SQLite cache with batch inserts, search indices on all columns, and optimized search methods.
- 2025-09-27: Created JSON Schemas for waymark-record, waymark-config, and waymark-scan-result in schemas/ directory.
- 2025-09-27: Deferred TUI implementation to Phase 5 to focus on core functionality first.
- 2025-09-29: Multi-line waymark grammar change: Replace `...` continuation prefix with markerless `:::` lines
  - Maintains greppability (all waymarks still findable with `rg ":::"`)
  - Context-sensitive parsing: markerless `:::` only valid after a waymark
  - Properties can act as pseudo-markers in continuation context (`// ref ::: #token`)
  - Formatter aligns continuation `:::` with parent waymark for visual clarity
  - See SCRATCHPAD.md section with `ref:#wip/multiline-update` for full details
- 2025-09-29: Refactored marker constants to include metadata and categories
  - Added `MarkerDefinition` type with name, category, aliases, and descriptions
  - Categories: work, info (shortened from information), caution, workflow, inquiry
  - Added helper functions for canonical marker resolution and category lookup
  - Added `comment` as new blessed marker in info category
- 2025-10-02: Renamed `global` scope to `user` throughout codebase for clarity
  - `user` scope applies to current user across all repos via `~/.config/waymark/config.*`
  - `project` scope (default) applies to specific repo via `.waymark/config.*`
  - Updated all core, CLI, and MCP packages to use consistent terminology
- 2025-10-02: Implemented `wm init` command for bootstrapping waymark configurations
  - Interactive mode: prompts for format (toml/jsonc/yaml/yml), preset (full/minimal), and scope (project/user)
  - Non-interactive mode: accepts flags `--format`, `--preset`, `--scope`, `--force`
  - Auto-updates `.gitignore` with `.waymark/index.db` entry for project scope
  - Integrated Pino logger with pretty-print formatting for clean CLI output
- 2025-10-02: Finalized database architecture for `wm insert` and `wm remove` commands
  - Repo-local databases in `.waymark/` directory (not XDG cache)
  - `index.db` - Active waymarks, IDs (wid column), file metadata, audit log (gitignored, regenerated from source)
  - `history.db` - Tombstoned/removed waymarks for undo capability (optional commit for team history)
  - IDs appear as `wm:a3k9m2p` in waymark content, stored as hash only in database
  - Separation keeps index.db fast for queries, history.db enables restore/audit
  - Each repo maintains its own databases; no cross-repo pollution
