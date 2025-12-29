<!-- tldr ::: archived summary of completed CLI improvement phases; active tracking in Linear #docs/plan -->

# CLI Improvements Checklist (Archived)

This page now serves as a historical snapshot of the v1.0 CLI rewrite. Active planning, backlog, and progress are tracked in Linear (Waymark team, project `Waymark v1.0.0-beta.1`).

> **Updated Oct 9, 2025** · For current guidance see [docs/cli/](docs/cli/) and [LINEAR.md](.agents/rules/LINEAR.md). Interactive TUI/fzf work remains deferred and should be managed through Linear issues.

## Implementation Phases

All phases (1-4) are complete and their detailed notes live in `.agents/.archive/`. Phase 5 remains deferred.

### ✅ Phase 1: Core Refactoring

**Status**: COMPLETE (2025-09-30)

Binary renamed to `wm`, version flag added, `fmt` → `format` command renamed.

**Key Achievements**:

- Binary: `waymark` → `wm` (with `waymark` alias)
- Added `--version` / `-v` flag reading from package.json
- Renamed `fmt` → `format` (kept `fmt` as alias)
- All 18 tests passing

### ✅ Phase 2: Unified Command

**Status**: COMPLETE (2025-09-30)

Merged `scan`, `find`, `map`, `graph` into single intelligent `wm` command.

**Key Achievements**:

- Created unified command handler with intent detection
- Added `--raised` / `-r` and `--starred` / `-s` signal filters
- Delivered dedicated commands for `format`, `lint`, `migrate`, `help`, `init`, `insert`, `modify`, `remove`, `update`, plus compatibility entry points (`map`, `graph`, `scan`)
- All 103 tests passing (added 13 new tests)

### ✅ Phase 3: Intelligent Query Parsing

**Status**: COMPLETE (2025-09-30)

Natural language query parsing like `wm "todo @agent #perf"` → structured filters.

**Key Achievements**:

- Created modular query-parser.ts with tokenization and parsing logic
- Fuzzy type matching (`todos` → `todo`, `fixme` → `fix`)
- Property search syntax (`owner:@alice`, `depends:`)
- Exclusion syntax (`!@alice`, `!todo`, `!#perf`)
- File path detection heuristic for automatic query vs file distinction
- 20 parser unit tests + 7 integration tests
- All 48 tests passing (33 existing + 8 Phase 4 + 7 Phase 3)

**Note**: Boolean operators (AND, OR, NOT) deferred to future work - current implementation sufficient for v1.0

### ✅ Phase 4: Display & Filtering

**Status**: COMPLETE (2025-09-30)

Advanced display modes, grouping, sorting, context display, filtering ergonomics.

**Key Achievements**:

- All display modes working (`--long`, `--tree`, `--flat`)
- Context display with ripgrep-style output (`--context`, `-C`, `-A`, `-B`)
- Grouping by type/file/etc (`--group`)
- Sorting by file/line/type/etc (`--sort`)
- Pagination with `--limit` and `--page`
- All 8 new automated tests passing
- Manual testing verified all features

**Note**: Semantic navigation (`--refs <token>`) and stateful pagination (`--next`, `--prev`) deferred to future work

### ⏸️ Phase 5: Interactive TUI

**Status**: DEFERRED

Interactive terminal UI with keyboard navigation and fzf integration.

**Planned Features**:

- Ink-based or OpenTUI terminal interface
- Keyboard navigation and real-time filtering
- fzf integration for fuzzy matching
- Preview pane with context and syntax highlighting

**Rationale for Deferral**: Focus on non-interactive CLI first.

## Quick Reference

### Current CLI Usage

```bash
# Default: scan and display
wm src/

# Filter by type, tags, mentions
wm src/ --type todo
wm src/ --tag perf
wm src/ --mention @agent

# Signal filters
wm src/ --raised       # Only ^ waymarks
wm src/ --starred      # Only * waymarks

# Graph mode: relation edges
wm src/ --graph
wm src/ --graph --json

# Output formats
wm src/ --json         # Compact JSON array
wm src/ --jsonl        # Newline-delimited JSON
wm src/ --text         # Human-readable formatted text

# Standalone commands
wm format <file> --write
wm lint <file...>
wm migrate <file> --write
wm help
wm init --scope project --format toml
wm add <file:line> <type> <content> --write
wm modify <file:line> --type fix --raise --write
wm remove <file:line> --write
wm update           # metadata refresh / migrations
wm graph <path> --json
```

### Query Syntax (Phase 3 - Complete)

```bash
# Natural language queries
wm "todo @agent #perf"              # Finds TODOs for @agent tagged with #perf
wm "cache fix !@alice"              # Finds FIX about cache, excluding @alice
wm "depends: owner:@bob"            # Has depends property, owned by @bob

# Fuzzy type matching
wm "todos"                          # Matches "todo" type
wm "fixme"                          # Matches "fix" type

# Exclusions
wm "!fix"                           # All except fix type
wm "@agent !todo"                   # Agent mentions excluding todos
```

### Display Features (Phase 4 - Complete)

```bash
# Context display (ripgrep-style)
wm "todo" --context 3               # 3 lines before/after
wm "fix" -C 5                       # 5 lines of context

# Grouping and sorting
wm "todo" --group dir --sort modified

# Pagination
wm "todo" --limit 10

# Note: --refs (semantic navigation) and --next/--prev (stateful pagination) deferred
```

## Documentation & Tracking

- **Current references**: [docs/README.md](docs/README.md), [docs/cli/](docs/cli/), [docs/GRAMMAR.md](docs/GRAMMAR.md)
- **Issue tracking**: Manage new improvements in Linear (`WAY-*`), not in this checklist
- **Scratchpad usage**: Use `SCRATCHPAD.md` for in-progress worklogs only; archive durable decisions in Linear or PRD

## Success Criteria

- [x] Phase 1: Binary works, version flag functional, format command renamed
- [x] Phase 2: Unified command handles all use cases, tests passing
- [x] Phase 3: Query parsing feels natural and predictable
- [x] Phase 4: Display modes enhance understanding, filters work intuitively
- [ ] Phase 5: TUI provides excellent interactive experience (DEFERRED)
