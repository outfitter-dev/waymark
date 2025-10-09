<!-- tldr ::: Phase 2 CLI refactoring - unified wm command with intent detection -->

# Phase 2: Unified Command

**Status**: ✅ COMPLETE (2025-09-30)

## Overview

Phase 2 merged `scan`, `find`, `map`, and `graph` into a single intelligent `wm` command that detects intent based on flags and arguments.

## Goal

Create a unified command interface that handles all listing/searching operations without requiring users to remember multiple command names.

## Completed Tasks

### Core Implementation

- [x] Created `packages/cli/src/commands/unified/` module structure
- [x] Implemented intent detection logic (map/graph/filter modes)
- [x] Added `--raised` / `-r` signal filter for `^` waymarks
- [x] Added `--starred` / `-s` signal filter for `*` waymarks
- [x] Updated CLI entry point to route to unified handler by default

### Backward Compatibility Removal

- [x] **Removed all backward compatibility** per user directive
- [x] Deleted discrete `scan`, `find`, `map`, `graph` command handlers
- [x] Only standalone commands remaining: `format`, `lint`, `migrate`, `help`
- [x] All scanning/filtering now happens through unified interface

### Module Structure

Created focused modules under `commands/unified/`:

- `types.ts` (51 lines) - Type definitions
- `parsers.ts` (57 lines) - Value parsing utilities
- `flag-handlers.ts` (152 lines) - Flag handling functions
- `filters.ts` (46 lines) - Filter application
- `parser.ts` (174 lines) - Argument parsing
- `index.ts` (67 lines) - Orchestration and execution

### Testing

- [x] Added comprehensive test suite (13 new tests)
- [x] All 103 tests passing after completion
- [x] Manual testing verified all modes working:
  - Basic scan/filter mode (default)
  - Map mode (`--map`)
  - Graph mode (`--graph`)
  - Signal filters (`--raised`, `--starred`)
  - Type/tag/mention filters
  - JSON output

## Usage Examples

```bash
# Default: scan and display
wm src/

# Filter by type
wm src/ --type todo

# Signal filters
wm src/ --raised       # Only ^ waymarks
wm src/ --starred      # Only * waymarks

# Map mode
wm src/ --map

# Graph mode
wm src/ --graph

# Combinations
wm src/ --type todo --mention @agent --json
```

## Files Modified

- `packages/cli/src/commands/unified/` - New module
- `packages/cli/src/index.ts` - Updated routing logic
- `packages/cli/src/index.test.ts` - Updated tests
- `README.md` - Updated usage documentation

## Breaking Changes

- Users can no longer call `wm scan`, `wm find`, `wm map`, or `wm graph` directly
- All functionality accessible via flags on base `wm` command
- User explicitly confirmed: "we DONT NEED BACKWARDS COMPATIBILITY"

## Documentation Updates

- [x] Updated README.md with new command structure
- [x] Updated usage strings
- [x] Updated test expectations
