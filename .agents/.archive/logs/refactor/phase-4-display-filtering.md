<!-- tldr ::: Phase 4 CLI refactoring - display modes and filtering ergonomics -->

# Phase 4: Display & Filtering

**Status**: ✅ COMPLETE (2025-09-30)

## Overview

Phase 4 adds advanced display modes, grouping, sorting, context display, and filtering ergonomics to the unified `wm` command.

## Completed Features

### Display Infrastructure

- [x] Created modular display system under `utils/display/`
- [x] Implemented sorting utilities
- [x] Implemented pagination utilities
- [x] Implemented grouping utilities
- [x] Text, long, and tree formatters
- [x] Display orchestration layer

### Module Structure (8 focused files)

- `types.ts` (18 lines) - DisplayOptions and constants
- `sorting.ts` (62 lines) - sortRecords function
- `pagination.ts` (24 lines) - paginateRecords function
- `grouping.ts` (97 lines) - grouping and formatting
- `formatters/text.ts` (82 lines) - text formatting
- `formatters/long.ts` (45 lines) - detailed formatting
- `formatters/tree.ts` (63 lines) - tree view formatting
- `index.ts` (54 lines) - formatRecords orchestration

## Implemented Features

### Display Modes ✅

- [x] `--long, -l` - Extended details showing all properties
- [x] `--tree, -T` - Tree view with TLDRs (good for file overview)
- [x] `--flat, -1` - One waymark per line (default for filtered results)
- [x] `--graph, -g` - Relation graph view showing dependencies

### Filtering Flags ✅

- [x] `--type <m>, -t <m>` - Filter by waymark type (with OR logic)
- [x] `--tag <t>` - Filter by hashtag(s)
- [x] `--mention <handle>, -m <handle>` - Filter by mentions
- [x] Short aliases (`-t`, `-m`, `-r`, `-s`, `-l`, `-g`)

### Context Display (ripgrep-style) ✅

- [x] `--context <n>, -C <n>` - Show N lines before and after
- [x] `--before-context <n>, -B <n>` - Show N lines before
- [x] `--after-context <n>, -A <n>` - Show N lines after
- [x] Context display formatting with line numbers
- [x] Separator lines between waymarks (`--`)

### Output Formats ✅

- [x] `--json` - Compact JSON array
- [x] `--jsonl` - Newline-delimited JSON
- [x] `--pretty` - Pretty-printed JSON
- [x] Default: human-readable text format

### Grouping & Sorting ✅

- [x] `--group <field>` - Group by relation, file, dir, type, signal, mention, tag, property
- [x] `--sort <field>` - Sort by file, line, type, signal, modified, created, added
- [x] `--reverse` - Reverse sort order
- [x] Tree-style output with Unicode box-drawing characters

### Pagination ✅

- [x] `--limit <n>` - Limit output to first N results
- [x] `--page <n>` - Show page N of results

## Deferred Features

These features were identified during Phase 4 but deferred to future work:

- `--refs <token>` - Semantic navigation to find connections
- `--next`, `--prev`, `--first`, `--last` - Stateful pagination
- State persistence via zustand in `~/.cache/waymark/state.json`
- `--property <key[:value]>` - Property-specific filtering
- `--exclude <expr>` - Negative filter shorthand
- Environment variable support (`WM_TYPES`, `WM_TAGS`, etc.)
- Syntax highlighting in context display

## Testing

### Manual Testing ✅

Created `test-display.ts` script that generated test files and verified:

- All display modes (`--long`, `--tree`, `--flat`)
- Context display with various line counts
- Grouping by type/file
- Sorting by file/line
- Pagination with `--limit`
- Signal filters (`--flagged`, `--starred`)
- Complex combinations

### Automated Tests ✅

Added 8 new tests to `packages/cli/src/index.test.ts`:

1. Long display mode
2. Tree display mode
3. Flat display mode
4. Context display
5. Grouping by type
6. Sorting by file
7. Pagination with limit
8. Complex combinations (filter + group + sort + limit)

All 41 tests passing (33 existing + 8 new).

## Success Criteria

✅ All filtering combinations work as documented
✅ Display modes are visually appealing and informative
✅ Performance remains fast with large result sets
✅ Context display enhances code understanding
✅ Pagination makes large codebases manageable

## Implementation Notes

- Display infrastructure was already built in previous refactoring
- Main work was wiring flags to existing utilities
- All flag handlers were already stubbed in `flag-handlers.ts`
- Parser already supported all options in `types.ts`
- Main challenge was ensuring consistent formatting across modes
- Tests verify both individual features and complex combinations
