<!-- tldr ::: phased Outfitter Stack adoption plan for the Waymark monorepo #docs/plan -->

# Outfitter Stack Adoption Plan

## Overview

Adopt `@outfitter/*` packages in the Waymark monorepo to replace ad-hoc error handling (103 throws, 34 process.exit calls, 21 try/catch files) with structured Result types, typed errors, and transport-agnostic handler contracts.

**Packages to adopt:**

| Package | Purpose | Where it applies |
|---------|---------|------------------|
| `@outfitter/contracts` | Result types, error taxonomy, handler contracts | All packages |
| `@outfitter/cli` | Output contracts, terminal detection, input parsing | `@waymarks/cli` |
| `@outfitter/logging` | Structured logging with redaction | All packages |
| `@outfitter/config` | XDG config loading with Zod validation | `@waymarks/core` |

**Packages NOT needed (Waymark already covers):**

- `@outfitter/mcp` - Waymark has its own MCP server; contracts suffice for Result wiring
- `@outfitter/index` - Waymark uses `bun:sqlite` directly; no FTS5 needed
- `@outfitter/state` - No pagination cursor needs
- `@outfitter/file-ops` - Waymark has its own file handling; too much overlap

## Current State (Scan Results)

```text
Anti-Pattern                 Count    Files
─────────────────────────────────────────────
throw statements             103      ~30 files
try/catch blocks              21      21 files
process.exit() calls          34      2 files (cli/index.ts, mcp/index.ts)
console.* in lib code          6      apps/mcp/
process.cwd() hardcoded       27      scattered
Custom error handling         ad-hoc   no error taxonomy
```

**Clean package:** `@waymarks/grammar` — zero throws, zero side effects, pure parser. No changes needed.

## Architecture Decision

### Handler Pattern

Waymark commands will become handlers with the `Handler<TInput, TOutput, TError>` signature from `@outfitter/contracts`. The CLI entry point becomes a thin transport layer that:

1. Parses flags → validated input
2. Creates `HandlerContext` (logger, config, signal)
3. Calls handler → receives `Result<TOutput, TError>`
4. Maps Result to output format + exit code

This makes every command testable without CLI, reusable from MCP, and type-safe end-to-end.

### Error Taxonomy Mapping

| Current Pattern | Outfitter Error | Category |
|----------------|-----------------|----------|
| `throw new Error("File not found: ...")` | `NotFoundError` | `not_found` |
| `throw new Error("Invalid config...")` | `ValidationError` | `validation` |
| `throw new Error("--json and --jsonl...")` | `ValidationError` | `validation` |
| `throw new Error("ID not reserved...")` | `ConflictError` | `conflict` |
| `throw new Error("Cache error...")` | `InternalError` | `internal` |
| `process.exit(1)` on lint errors | Exit code from error category | automatic |
| `process.exit(2)` on internal errors | `InternalError.exitCode()` → 3 | automatic |

### Exit Code Alignment

Waymark PRD defines: 0=success, 1=lint/parse errors, 2=internal errors.
Outfitter defaults: validation→1, not_found→2, internal→3, etc.

We'll use a custom exit code map to preserve Waymark's convention:

```typescript
const waymarkExitCodes = {
  validation: 1,    // lint/parse errors
  not_found: 1,     // missing file = lint error context
  conflict: 1,      // duplicate canonical = lint error
  internal: 2,      // internal/tooling error
  cancelled: 130,   // Ctrl+C
} as const;
```

---

## Phase 1: Install Dependencies & Scaffold (Low Risk)

**Goal:** Install packages, create shared error types, convert 4 core utility files.

### 1.1 Install packages

```bash
bun add @outfitter/contracts @outfitter/logging
```

Note: `@outfitter/cli` and `@outfitter/config` deferred to later phases to keep initial scope small. Waymark's existing config and CLI code is extensive; replacing it all at once is too risky.

### 1.2 Create shared error module

Create `packages/core/src/errors.ts`:

```typescript
import { ValidationError, NotFoundError, ConflictError, InternalError } from "@outfitter/contracts";
export { ValidationError, NotFoundError, ConflictError, InternalError };

// Waymark-specific exit code map (preserves PRD conventions)
export const WAYMARK_EXIT_CODES = {
  validation: 1,
  not_found: 1,
  conflict: 1,
  internal: 2,
  cancelled: 130,
} as const;
```

### 1.3 Convert core utilities

| File | Current | Target |
|------|---------|--------|
| `packages/core/src/config.ts` | throws on invalid config | `Result<WaymarkConfig, ValidationError>` |
| `packages/core/src/ids.ts` | throws on invalid ID | `Result<string, ValidationError \| ConflictError>` |
| `packages/core/src/insert.ts` | returns `{status, error?}` | `Result<InsertionRecord, ValidationError \| NotFoundError>` |
| `packages/core/src/remove.ts` | returns `{status, error?}` | `Result<RemovalRecord, ValidationError \| NotFoundError>` |

**Approach:** Inside-out. Convert return types first, update callers second. `insert.ts` and `remove.ts` already return structured results — they just need wrapping.

### 1.4 Update tests

Each converted function gets its test updated to assert on `Result.isOk()` / `Result.isErr()` instead of try/catch or status field checks.

**Estimated scope:** ~4 files, ~200 LOC changes, ~8 test updates.

---

## Phase 2: Cache Layer (Medium Risk)

**Goal:** Convert `WaymarkCache` class methods to return Results.

### 2.1 Convert cache methods

| Method | Current | Target |
|--------|---------|--------|
| `WaymarkCache.open()` | throws on DB errors | `Result<WaymarkCache, InternalError>` |
| `WaymarkCache.insert()` | throws on write errors | `Result<void, InternalError>` |
| `WaymarkCache.search()` | throws on query errors | `Result<WaymarkRecord[], InternalError>` |
| `WaymarkCache.invalidate()` | throws | `Result<void, InternalError>` |

### 2.2 Transaction wrapper

Create a `withTransaction` helper that returns `Result`:

```typescript
function withTransaction<T>(
  db: Database,
  fn: () => T
): Result<T, InternalError> {
  try {
    db.run("BEGIN");
    const result = fn();
    db.run("COMMIT");
    return Result.ok(result);
  } catch (error) {
    db.run("ROLLBACK");
    return Result.err(new InternalError({
      message: `Transaction failed: ${error}`,
      cause: error,
    }));
  }
}
```

Note: `bun:sqlite` operations are synchronous and can legitimately throw (disk full, corruption). The try/catch here is at the boundary — it captures the external error and converts it to a Result.

**Estimated scope:** ~3 files, ~150 LOC changes, ~12 test updates.

---

## Phase 3: CLI Commands (High Impact)

**Goal:** Convert all command handlers to handler functions returning Results. Create centralized exit/output handling.

### 3.1 Create handler types

```typescript
// packages/cli/src/types.ts
import type { Handler, HandlerContext } from "@outfitter/contracts";
import type { OutfitterError } from "@outfitter/contracts";

export type CommandHandler<TInput, TOutput> =
  Handler<TInput, TOutput, OutfitterError>;

export type CommandResult<T> = Result<T, OutfitterError>;
```

### 3.2 Create centralized result-to-exit mapper

```typescript
// packages/cli/src/utils/exit.ts
import { WAYMARK_EXIT_CODES } from "@waymarks/core/errors";

export function handleResult<T>(
  result: Result<T, OutfitterError>,
  options?: { format?: "json" | "jsonl" | "text" }
): never | void {
  if (result.isOk()) {
    // Output result.value in requested format
    process.exit(0);
  }

  const code = WAYMARK_EXIT_CODES[result.error.category] ?? 1;
  // Format error for display
  process.exit(code);
}
```

### 3.3 Convert commands (8 files)

Each command module gets extracted from the monolithic `index.ts` into a handler + CLI adapter:

1. **Handler function** (pure, testable, Result-returning)
2. **CLI adapter** (flag parsing → handler call → exit code)

| Command | Input Schema | Output Type | Error Types |
|---------|-------------|-------------|-------------|
| `add` | `AddInput` | `InsertionRecord` | `ValidationError`, `NotFoundError` |
| `remove` | `RemoveInput` | `RemovalRecord` | `ValidationError`, `NotFoundError` |
| `modify` | `ModifyInput` | `ModifyRecord` | `ValidationError`, `NotFoundError` |
| `init` | `InitInput` | `InitResult` | `ValidationError`, `ConflictError` |
| `doctor` | `DoctorInput` | `DiagnosticReport` | `InternalError` |
| `format` | `FormatInput` | `FormatResult` | `ValidationError` |
| `lint` | `LintInput` | `LintReport` | `ValidationError` |
| `migrate` | `MigrateInput` | `MigrateResult` | `ValidationError` |

**Estimated scope:** ~8 command files, ~600 LOC changes, ~20 test updates.

---

## Phase 4: MCP Server (Medium Risk)

**Goal:** Convert MCP tool handlers to use Results; replace custom logger.

### 4.1 Replace MCP logger

Current: `apps/mcp/src/utils/logger.ts` uses `console.error` with string concatenation.
Target: `@outfitter/logging` with `createLogger` + `createConsoleSink` (stderr for MCP).

### 4.2 Convert tool handlers

MCP tools (`waymark.scan`, `waymark.map`, `waymark.graph`, `waymark.insert`) call core functions that now return Results. Map Results to MCP responses:

```typescript
const result = await scanHandler(input, ctx);
if (result.isErr()) {
  return { content: [{ type: "text", text: result.error.message }], isError: true };
}
return { content: [{ type: "text", text: JSON.stringify(result.value) }] };
```

**Estimated scope:** ~8 files, ~200 LOC changes.

---

## Phase 5: Entry Points & Verification (High Impact)

**Goal:** Convert main entry points, remove all `process.exit` sprawl, verify compliance.

### 5.1 CLI entry point

`packages/cli/src/index.ts` (1,787 lines) has 34 `process.exit` calls. Convert to:

- Single `handleResult()` call at the top-level
- Command dispatch returns `Result`
- One `process.exit` at the very end

### 5.2 MCP entry point

`apps/mcp/src/index.ts` has startup/shutdown errors. Wrap in Result pattern.

### 5.3 Compliance check

Run `kit:outfitter-check` to verify:

- Zero throws in domain code (boundary try/catch for bun:sqlite is acceptable)
- Zero unhandled process.exit (only in entry point exit handler)
- All handlers return Result types
- Error taxonomy correctly applied
- Structured logging throughout

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking existing tests | Convert tests alongside code; run full suite after each file |
| `bun:sqlite` throws | Keep try/catch at DB boundary only; convert to Result immediately |
| CLI flag parsing complexity | Keep Commander.js; convert only the handler logic |
| MCP SDK compatibility | Result → MCP response mapping at transport boundary |
| Large diff size | Phase by phase; each phase is a separate PR |

## Success Criteria

| Metric | Before | After |
|--------|--------|-------|
| `throw` in domain code | 103 | 0 |
| `try/catch` in domain code | 21 files | boundary only (bun:sqlite, JSON.parse) |
| `process.exit` | 34 calls | 1 centralized handler |
| Error taxonomy | ad-hoc strings | 10 typed error classes |
| Handler contract | mixed returns | `Result<T, OutfitterError>` |
| Logging | console.error / Pino mix | `@outfitter/logging` |

## Branch Strategy

Work on a feature branch off `gt/v1.0/rewrite`:

```bash
gt create 'feat/outfitter-stack-adoption'
```

Each phase is a stacked PR:

- `feat/outfitter-phase-1-contracts`
- `feat/outfitter-phase-2-cache`
- `feat/outfitter-phase-3-commands`
- `feat/outfitter-phase-4-mcp`
- `feat/outfitter-phase-5-entry-points`
