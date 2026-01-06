<!-- tldr ::: CLI refactoring work log organized by implementation phases -->

# CLI Refactoring Log

This directory tracks the CLI ergonomics refactoring work organized by implementation phases. Each phase focuses on a specific set of improvements to make the waymark CLI more user-friendly and powerful.

## Phase Overview

### ✅ [Phase 1: Core Refactoring](./phase-1-core-refactoring.md)

**Status**: COMPLETE (2025-09-30)

Binary rename from `waymark` to `wm`, version flag addition, and `fmt` → `format` command rename.

**Key Changes**:

- Binary: `waymark` → `wm` (with `waymark` alias)
- Added `--version` / `-v` flag
- Renamed `fmt` → `format` (kept `fmt` alias)

### ✅ [Phase 2: Unified Command](./phase-2-unified-command.md)

**Status**: COMPLETE (2025-09-30)

Merged `scan`, `find`, `map`, `graph` into single intelligent `wm` command with intent detection.

**Key Changes**:

- Removed discrete `scan`, `find`, `map`, `graph` commands
- Created unified command with `--map` and `--graph` flags
- Added `--flagged` and `--starred` signal filters
- Only standalone commands: `format`, `lint`, `migrate`, `help`

### 📍 [Phase 3: Intelligent Query Parsing](./phase-3-query-parsing.md)

**Status**: PENDING

Natural language query parsing for intuitive search syntax.

**Planned Features**:

- `wm "todo @agent #perf"` → automatic filter extraction
- Fuzzy type matching (`todos` → `todo`)
- Property search (`owner:@alice`)
- Exclusion syntax (`!@alice`)
- Boolean operators (`(todo OR fix) @agent`)

### 🔄 [Phase 4: Display & Filtering](./phase-4-display-filtering.md)

**Status**: PARTIALLY COMPLETE

Advanced display modes, grouping, sorting, context display, and filtering ergonomics.

**Completed**:

- Modular display system with formatters
- Sorting and pagination utilities
- JSON output formats

**Pending**:

- Display mode flags (`--long`, `--tree`, `--flat`, `--graph`)
- Context display (`--context`, `--before-context`, `--after-context`)
- Advanced grouping and sorting
- Semantic navigation (`--refs`)
- Pagination with state persistence

### ⏸️ [Phase 5: Interactive TUI](./phase-5-interactive-tui.md)

**Status**: DEFERRED

Interactive terminal UI with keyboard navigation and fzf integration.

**Planned Features**:

- Ink-based or OpenTUI terminal interface
- Keyboard navigation and real-time filtering
- fzf integration for fuzzy matching
- Preview pane with context and syntax highlighting

**Deferred**: Focus on non-interactive CLI first before adding interactive features.

## Cross-Phase Concerns

### Testing

- Phase 1: 18 tests passing
- Phase 2: 103 tests passing (added 13 new tests)
- Phase 3: Pending query parsing tests
- Phase 4: Pending display/filter tests
- Phase 5: Pending TUI tests

### Documentation

- Phase 1 & 2: README.md, PRD.md updated
- Phase 3: Will need query syntax documentation
- Phase 4: Will need display mode documentation
- Phase 5: Will need TUI usage documentation

### Performance Considerations

- Cache waymark results for repeated queries
- Lazy load file contents for tree view
- Stream results for `--jsonl` output
- Parallel file processing where possible
- Context line retrieval optimization (Phase 4)
- Zustand state persistence <10ms (Phase 4)

## Migration Notes

### Breaking Changes

- Binary name: `waymark` → `wm` (alias provided)
- Command structure: discrete commands → unified `wm` with flags
- No backward compatibility for `scan`/`find`/`map`/`graph` commands

### User Impact

- Users must update scripts using old command names
- New unified syntax may require learning curve
- But: simpler mental model with single command

## Success Criteria

- [x] Phase 1: Binary works, version flag functional, format command renamed
- [x] Phase 2: Unified command handles all use cases, tests passing
- [ ] Phase 3: Query parsing feels natural and predictable
- [ ] Phase 4: Display modes enhance understanding, filters work intuitively
- [ ] Phase 5: TUI provides excellent interactive experience

## Reference

See `IMPROVEMENTS.md` in repository root for detailed feature checklist and examples.
