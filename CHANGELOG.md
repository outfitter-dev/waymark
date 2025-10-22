<!-- tldr ::: Release log for Waymark CLI and core libraries -->

# Waymark Changelog

## 1.0.0-beta.1 — 2025-10-03

### Highlights

- Hardened cache directory enforcement so SQLite paths cannot escape the sandboxed `waymark` cache tree.
- Refactored `wm add` and `wm remove` into composable helpers with strict state objects, reducing cognitive complexity across CLI handlers.
- Rebuilt `@waymarks/core` insert/remove pipelines with deterministic ordering, top-level regex constants, and ID reservation helpers that respect strict optional typing.
- Split CLI output into dedicated JSON and text formatters, aligning insert/remove summaries and enabling future transport reuse.
- Hardened tests by eliminating non-null assertions, normalizing async helpers, and covering JSON/JSONL flows for insert/remove/update commands.
- Verified workspace health with `bun run check:all` (lint, typecheck, tests) to certify the prerelease.

### Breaking Changes

- CLI flag parsing for `wm remove` now enforces explicit criteria or file scopes; positional handling routes through structured state to prevent ambiguous removals.
- Insert/remove function exports in `@waymarks/core` now return richer result metadata (header, continuations, summaries) and expect normalized options objects.

### Migration Notes

- Update internal tooling to consume the new `ParsedRemoveArgs` shape if it relied on implicit `any` values.
- Move any regex literals used inside hot paths to module-level constants to match lint expectations enforced in this release.
