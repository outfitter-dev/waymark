<!-- tldr ::: running log of agent activities and recent work #docs/rules -->

# Scratchpad

Keep this log current while working. Recent activity only; historical logs archived in `.agents/.archive/`.

## Active Notes

<!-- note ::: Track milestones and tasks in Linear; keep this scratchpad as an ephemeral worklog snapshot -->

- The `:::` sigil placement:
  - Placed after the marker intentionally for backwards compatibility with existing TODO-style tooling
  - When converted to AI tokens, it's just a single token (efficient)
  - Visually distinct and easy to type

## Recent Activity

### 2025-10-23

- **WAY-58: Remove underline styling from filename headers**
  - Modified `styleFilePath()` in `packages/cli/src/utils/display/formatters/styles.ts`
  - Removed `chalk.underline()` and replaced with `chalk.bold()` for lighter visual weight
  - Maintains clear file boundaries without heavy underline styling
  - All lint checks passing; no new type errors introduced

- **WAY-56: Fix grammar-level property parsing to handle spaces and backticks**
  - Modified `PROPERTY_REGEX` in `packages/grammar/src/properties.ts` to reject unquoted properties with space after colon
  - Changed regex from `\s*:\s*` to `\s*:` (no space after colon for unquoted values)
  - Added `maskBackticks()` and `unmaskBackticks()` functions to prevent property extraction inside inline code
  - Updated `extractPropertiesAndRelations()` to mask backtick content before property matching
  - Added 7 comprehensive test cases covering space handling and backtick masking scenarios
  - All 23 grammar tests passing; no type errors introduced

- **WAY-55: Replace underlines with background colors for signal indicators**
  - Modified `styleType()` in `packages/cli/src/utils/display/formatters/styles.ts`
  - Replaced `chalk.bold.underline(color(type))` with `chalk.bgYellow(chalk.bold(color(signalStr + type)))`
  - Background colors provide better visual weight and hierarchy without cluttering output
  - Tested with `^todo`, `*fix`, `^wip`, and `^*todo` signal combinations
  - Visual output confirmed working across terminal themes

### 2025-10-16

- **WAY-20: HTML Property Continuation Formatting** (Lock down HTML closure)
  - Created unified `applyHtmlClosure()` helper to centralize HTML comment closure logic
  - Refactored `formatMultiLine()` to apply closure via single `.map()` call instead of dual code paths
  - Removed `ensureHtmlClosure()` function and inline closure logic from `renderContinuationLines()`
  - Eliminated duplication: property continuations now handled consistently with text continuations
  - Added comprehensive test suite covering all continuation types
  - All 298 tests passing, full `bun check:all` green

### 2025-10-07

- **Cache Schema Migration Strategy**
  - Added `CACHE_SCHEMA_VERSION = 2` constant with metadata table storage
  - Implemented automatic cache invalidation on schema version mismatch
  - Breaking change: `marker` column → `type` column (from 2025-09-30 refactoring)
  - Migration strategy: drop all tables and regenerate from source (caches are ephemeral)
  - All 71 core tests passing, full CI pipeline green

- **PR #7 Review Feedback & Archive Cleanup**
  - Used `logbooks snapshot` to capture CodeRabbit feedback (34 comments)
  - Archived 15 completed log/planning files to `.agents/.archive/` (gitignored)
  - Removed orphaned links in `IMPROVEMENTS.md` referencing archived refactor docs
  - All critical/minor CodeRabbit issues addressed

### 2025-10-03

- Refactored `wm insert`/`wm remove` handlers into shared parsing/output helpers
- Aligned `@waymarks/core` implementations with new ID reservation and formatting helpers
- Authored `CHANGELOG.md`, updated README/PRD/docs for **1.0.0-beta.1** prerelease
- **Performance: wyhash ID generation** (7.3x faster than SHA-256)
  - Replaced SHA-256 with `Bun.hash.wyhash()` for ID generation
  - Kept SHA-256 for content/context fingerprints (cryptographic properties needed)
  - All tests passing, ID format unchanged (`wm:[base36]`)

### 2025-10-02

- **Config Standardization**: TOML as preferred format, removed `.json` support
- **Pino Logger Integration**: Structured logging with `--verbose`, `--debug`, `--quiet` flags
- **Enhanced CLI Output**: ripgrep-style formatting with type-specific colors and aligned output
- **JSON Output Optimization**: Removed empty fields (~42% size reduction)
- **Interactive Init**: Inquirer prompts for `wm init` when no flags provided

### Earlier (Archived)

Detailed historical logs available in `.agents/.archive/`:

- [2025-09-26](./.agents/.archive/20250926-worklog.md) - Initial project setup, SQLite caching, grammar package
- [2025-09-27](./.agents/.archive/20250927-worklog.md) - Quality review, MCP server, config alignment
- [2025-09-28](./.agents/.archive/20250928-worklog.md) - Formatting remediation, CLI modularization
- [2025-09-29](./.agents/.archive/20250929-worklog.md) - Multi-line grammar change, marker refactoring
- [2025-09-30](./.agents/.archive/20250930-worklog.md) - Type terminology refactoring, CLI phases 1 & 2

---

## Historical Context

See `.agents/.archive/` for complete historical logs. Current prerelease: **1.0.0-beta.1** (2025-10-03).
