<!-- tldr ::: comprehensive refactoring plan for renaming marker to type throughout codebase -->

# Marker → Type Refactoring Plan

> **✅ COMPLETED: 2025-09-30**
>
> This refactoring has been fully completed. All phases (1-10) are done.
> See [2025-09-30 worklog](./.agents/logs/20250930-worklog.md) for detailed implementation notes.

## Overview

This document outlines the complete refactoring to rename `marker` to `type` throughout the Waymark codebase. This change improves semantic clarity by distinguishing between:

- **CLI flag**: `--type` (what users interact with)
- **Data field**: `WaymarkRecord.type` (internal representation)
- **Config keys**: `allowTypes`, `typeCase` (configuration)

## Why This Change?

The term "marker" was overloaded:

1. The entire waymark construct (e.g., "a todo marker")
2. The specific type value (e.g., "the marker field contains 'todo'")
3. The blessed list of valid markers

Using `type` resolves this ambiguity and aligns CLI, data model, and configuration.

## Scope of Changes

### Phase 1: Core Type Definitions (Foundation)

These must be done first as everything depends on them.

- [x] `packages/grammar/src/types.ts` - `WaymarkRecord.marker` → `type`
- [x] `packages/grammar/src/builder.ts` - `header.marker` → `header.type`
- [x] `packages/core/src/types.ts` - Config type fields:
  - `markerCase` → `typeCase`
  - `allowMarkers` → `allowTypes`
  - Update `PartialWaymarkConfig` and `WaymarkConfig` types

### Phase 2: Grammar Package (Parser & Utilities)

Update all grammar package files that reference the marker field.

- [x] `packages/grammar/src/parser.ts`
  - Function `isValidMarker(marker: string)` → `isValidType(type: string)`
  - All parameter names: `marker` → `type`
  - Header type definition if present
- [x] `packages/grammar/src/tokenizer.ts`
  - All `.marker` field accesses
  - All `marker` parameter/variable names
- [x] `packages/grammar/src/constants.ts`
  - `MARKERS` constant → keep name (refers to the concept of markers)
  - `MARKER_DEFINITIONS` → keep name
  - Function `isValidMarker()` → `isValidType()`
  - Any other marker-related exports
- [x] `packages/grammar/src/parser.test.ts`
  - All test assertions checking `.marker` field → `.type`
  - Test descriptions mentioning "marker"

### Phase 3: Core Package - Configuration

Update configuration types and defaults.

- [x] `packages/core/src/config.ts`
  - `DEFAULT_CONFIG`:
    - `markerCase: "lowercase"` → `typeCase: "lowercase"`
    - `allowMarkers: [...]` → `allowTypes: [...]`
  - All references to these config keys in functions
  - Update loader/resolver functions if they reference keys
- [x] `packages/core/src/config.test.ts`
  - Config test assertions for `markerCase` → `typeCase`
  - Config test assertions for `allowMarkers` → `allowTypes`

### Phase 4: Core Package - Cache Layer

SQLite schema and cache operations.

- [x] `packages/core/src/cache/schema.ts`
  - SQL column: `marker TEXT` → `type TEXT`
  - All CREATE TABLE statements
  - All index definitions referencing marker column
- [x] `packages/core/src/cache/serialization.ts`
  - `toRow()`: `marker: record.marker` → `type: record.type`
  - `fromRow()`: `marker: row.marker` → `type: row.type`
- [x] `packages/core/src/cache/writes.ts`
  - All SQL INSERT statements: `marker` column → `type`
  - All parameter binding for marker field
- [x] `packages/core/src/cache/queries.ts`
  - All SQL SELECT/WHERE clauses using `marker` column → `type`
  - Function `findByMarker()` → `findByType()`
  - Parameter names in query functions
- [x] `packages/core/src/cache/index.ts`
  - All `.marker` field accesses when building/reading cache
  - Method names if they contain "marker"
- [x] `packages/core/src/cache/index.test.ts`
  - Test assertions checking `.marker` field
  - Cache query tests for marker column

### Phase 5: Core Package - Utilities

Format, normalize, search, map, and graph utilities.

- [x] `packages/core/src/normalize.ts`
  - Function `normalizeMarker()` → `normalizeType()`
  - All parameter/variable names
  - All `.marker` field accesses
- [x] `packages/core/src/normalize.test.ts`
  - Test assertions and descriptions
- [x] `packages/core/src/format.ts`
  - All `.marker` field accesses
  - Variable names related to marker
- [x] `packages/core/src/search.ts`
  - `markers?: string[]` parameter → `types?: string[]`
  - All filter logic checking `.marker` field → `.type`
  - Function/parameter names
- [x] `packages/core/src/search.test.ts`
  - Test assertions and search criteria
- [x] `packages/core/src/map.ts`
  - `markers: Map<string, ...>` → `types: Map<string, ...>`
  - `FileSummary.markers` field → `types`
  - All aggregation logic
  - Function `summarizeMarkerTotals()` → consider renaming to `summarizeTypeTotals()` (or keep for clarity)
- [x] `packages/core/src/map.test.ts`
  - Test assertions checking markers Map → types Map
- [x] `packages/core/src/graph.test.ts`
  - Test assertions checking `.marker` field

### Phase 6: CLI Package

Command-line interface updates.

- [x] `packages/cli/src/index.ts`
  - Lint command: `config.allowMarkers` → `config.allowTypes`
- [x] `packages/cli/src/commands/lint.ts`
  - `lintFiles(paths, allowMarkers)` → `lintFiles(paths, allowTypes)`
  - All references to allowMarkers parameter
- [x] `packages/cli/src/utils/output.ts`
  - All `.marker` field accesses in rendering
- [x] `packages/cli/src/utils/map-rendering.ts`
  - Comments about "markers" (keep if referring to concept)
  - `summary.markers` Map access → `summary.types`
  - Loop variables if named `marker`
- [x] `packages/cli/src/index.test.ts`
  - Test assertions: `.marker` → `.type`
  - Test descriptions mentioning marker field

### Phase 7: MCP Server

Model Context Protocol server updates.

- [x] `apps/mcp/src/types.ts`
  - MCP schema definitions with `marker` field → `type`
- [x] `apps/mcp/src/tools/insert.ts`
  - `marker` parameter in insert tool → `type`
  - Validation logic
- [x] `apps/mcp/src/tools/scan.ts`
  - All `.marker` field handling
- [x] `apps/mcp/src/resources/todos.ts`
  - Filter logic checking `.marker === "todo"` → `.type === "todo"`
- [x] `apps/mcp/src/index.test.ts`
  - MCP test assertions

### Phase 8: Schemas & Documentation

JSON schemas and user-facing documentation.

- [x] `schemas/waymark-record.schema.json`
  - Property: `"marker": { "type": "string" }` → `"type": { "type": "string" }`
  - Update required fields array if needed
  - Update description text
- [x] `schemas/waymark-config.schema.json`
  - Property: `"markerCase"` → `"typeCase"`
  - Property: `"allowMarkers"` → `"allowTypes"`
  - Update descriptions
- [x] `PRD.md`
  - Config example YAML/JSON:
    - `marker_case: lowercase` → `type_case: lowercase`
    - `allow_markers: [...]` → `allow_types: [...]`
  - Any prose mentioning "marker field"
- [x] `.waymark/config.jsonc`
  - `"markerCase": "lowercase"` → `"typeCase": "lowercase"`
  - `"allowMarkers": [...]` → `"allowTypes": [...]`
- [x] `README.md`
  - Check for any references to "marker field" in examples

### Phase 9: Validation & Testing

Ensure everything works after refactoring.

- [x] Run `bun run typecheck`
  - Fix any type errors that surface
  - Document any breaking changes
- [x] Run `bun test`
  - Fix failing tests
  - Verify all 18+ tests pass
- [x] Run `bun run lint`
  - Fix any linting issues
  - Auto-fix with `bunx ultracite fix --unsafe` if needed
- [x] Run `bun scripts/waymark-map.ts`
  - Regenerate waymark map
  - Verify no broken references
- [x] Manual smoke test
  - `waymark scan` - verify output shows `type` field
  - `waymark find --type todo` - verify filtering works
  - `waymark map` - verify aggregation works

### Phase 10: Documentation

Update SCRATCHPAD and finalize.

- [x] Update `SCRATCHPAD.md`
  - Add detailed entry for this refactoring
  - Note: marker → type throughout data model
  - Note: allowMarkers → allowTypes, markerCase → typeCase
  - List all files changed
  - Rationale and benefits

## Strategy

### Recommended Approach: Hybrid (Manual + Batch)

**Manual Changes (Critical Files - Phase 1-3):**

- Type definitions
- Core configuration
- Cache schema (SQL is fragile)

**Batch Changes (Repetitive Updates - Phase 4-8):**
Use careful find-replace with verification:

```bash
# Example pattern (verify each file manually after)
rg "\.marker\b" --type ts -l | while read file; do
  # Show what would change
  rg "\.marker\b" "$file" --color=always
  # Confirm before replacing
done
```

**Post-Batch Verification:**

- Run typecheck after each phase
- Run tests after each phase
- Commit after each successful phase

### Git Strategy

Create commits per phase:

1. `refactor(types): rename WaymarkRecord.marker to type`
2. `refactor(grammar): update parser for type field`
3. `refactor(config): rename markerCase and allowMarkers`
4. `refactor(cache): update SQLite schema for type column`
5. `refactor(core): update utilities for type field`
6. `refactor(cli): update commands for type field`
7. `refactor(mcp): update MCP server for type field`
8. `refactor(docs): update schemas and documentation`

This allows easy rollback if issues surface.

## Risk Mitigation

### High-Risk Areas

1. **SQL Schema Changes**: Cache schema must be migrated carefully
   - Consider adding migration logic to handle existing caches
   - Or document that caches will be invalidated
2. **JSON Schema**: Published schema breaking change
   - Document in changelog
   - Version bump (minor or major?)
3. **MCP Server**: External API surface
   - Check if anyone depends on it
   - Update MCP tool definitions

### Testing Checklist

- [x] All existing tests pass
- [x] CLI commands work: scan, find, map, lint, fmt
- [x] Config loading works for all scopes
- [x] Cache invalidation works (or caches are cleared)
- [x] MCP server responds correctly

## Notes

### What NOT to Change

- `MARKERS` constant name (refers to the concept)
- Comments/docs that say "marker types" or "waymark markers" (grammatically correct)
- Historical references in SCRATCHPAD.md
- Function names where "marker" refers to the concept (e.g., `isValidMarker` → `isValidType` is good, but `getMarkerDefinition` might stay)

### Terminology Going Forward

- **Type**: The value (todo, fix, note, etc.)
- **Waymark**: The entire construct (signals + type + content)
- **Marker**: Use sparingly, only when referring to the historical concept or in blessed marker lists

## Completion Criteria

- [x] All 40 checklist items completed
- [x] `bun run typecheck` passes
- [x] `bun test` passes (all tests green)
- [x] `bun run lint` passes
- [x] Manual CLI smoke test passes
- [x] SCRATCHPAD.md updated
- [x] All phases committed to git
