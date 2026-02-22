# Compliance Report: packages/ and apps/

**Date**: 2026-02-21
**Scope**: `packages/` and `apps/` directories
**Status**: FAIL

## Summary

| Severity | Count |
|----------|-------|
| Critical | 118 |
| High | 7 |
| Medium | 6 |
| Low | 5 |

---

## Critical

### 1. Thrown Exceptions in Application Code (118 occurrences across 28 files)

The codebase relies heavily on `throw new Error(...)` and `throw new CliError(...)` for control flow rather than returning `Result` types. This is the single largest compliance gap.

**Breakdown by area:**

| Area | Files | Throws | Worst Offenders |
|------|-------|--------|-----------------|
| `packages/cli/src/commands/` | 13 | 72 | `modify.ts` (15), `add.ts` (13), `init.ts` (7), `parsers.ts` (6) |
| `packages/cli/src/utils/` | 6 | 13 | `fs.ts` (4), `prompts.ts` (3), `properties.ts` (2) |
| `packages/cli/src/program.ts` | 1 | 8 | Top-level command handlers throw `CliError` |
| `packages/cli/src/skills/` | 2 | 13 | `parser.ts` (9), `manifest.ts` (4) |
| `packages/core/src/edit.ts` | 1 | 10 | Every validation path throws |
| `apps/mcp/src/` | 6 | 16 | `tools/add.ts` (9), `utils/filesystem.ts` (3) |

**Key files with throw-heavy patterns:**

| Location | Issue |
|----------|-------|
| `packages/cli/src/commands/modify.ts:89` | Custom `InteractiveCancelError extends Error` class (should use `CancelledError.create()`) |
| `packages/cli/src/commands/modify.ts:526-588` | 7 instances of `throw new InteractiveCancelError()` for prompt cancellation flow |
| `packages/cli/src/commands/add.ts:131-284` | 12 argument validation throws (should return `Result.err(ValidationError.create(...))`) |
| `packages/core/src/edit.ts:134-647` | 10 throws for file/waymark validation (entire module lacks Result returns) |
| `apps/mcp/src/tools/scan.ts:48` | `throw new Error()` after checking `configResult.isErr()` (has Result, then throws instead of propagating) |
| `packages/cli/src/utils/context.ts:28` | `throw createConfigError(result.error.message)` -- unwraps a Result error only to re-throw it |
| `packages/core/src/config.ts:250,280` | `throw result.error` -- extracts Result error and throws it in a config loader |
| `packages/cli/src/program.ts:281-835` | 8 `throw new CliError(...)` in command handlers |

**Fix**: Convert `throw` to `Result.err()` returns. Use `createValidator()` from `@outfitter/contracts` for input validation instead of Zod `.parse()` (which throws). For the transition layer in `program.ts`, the existing `runCommand()` bridge pattern is acceptable -- but the throws should move out of the command modules themselves. See [patterns/conversion.md] and [patterns/results.md].

### 2. try/catch Control Flow (67 occurrences across 27 files)

Most `try/catch` blocks wrap operations that should return `Result` instead.

| Location | Issue |
|----------|-------|
| `packages/cli/src/program.ts` | 8 try/catch blocks catching CliError from sub-commands |
| `packages/cli/src/commands/register.ts` | 18 try/catch blocks in command registration |
| `packages/cli/src/commands/doctor.ts` | 7 try/catch blocks for health checks |
| `packages/core/src/id-index.ts` | 3 try/catch blocks around SQLite operations |
| `packages/core/src/cache/index.ts` | 1 try/catch around database open (already partially migrated) |

**Fix**: Replace `try/catch` with `Result.try()` or `Result.tryPromise()` wrappers. The `program.ts` top-level catch is partially acceptable as a transport boundary, but command-level catches should propagate Results instead. See [patterns/results.md].

### 3. Zod `.parse()` (Throws) Instead of `.safeParse()` or `createValidator()` (3 occurrences)

| Location | Issue |
|----------|-------|
| `apps/mcp/src/tools/add.ts:92` | `addWaymarkInputSchema.parse(input)` -- throws ZodError on invalid input |
| `apps/mcp/src/tools/scan.ts:21` | `scanInputSchema.parse(input)` -- throws ZodError |
| `apps/mcp/src/tools/graph.ts:21` | `graphInputSchema.parse(input)` -- throws ZodError |

**Fix**: Use `createValidator()` from `@outfitter/contracts` which wraps Zod validation into `Result<T, ValidationError>`. See [patterns/handler.md].

---

## High

### 1. Hardcoded Home Directory Paths (5 occurrences in 4 files)

The codebase uses `homedir()` with manual `XDG_CONFIG_HOME`/`XDG_CACHE_HOME` fallback logic instead of using `@outfitter/config` functions (`getConfigDir`, `getCacheDir`).

| Location | Issue |
|----------|-------|
| `packages/core/src/config.ts:270` | `join(homedir(), ".config")` -- manual XDG fallback |
| `packages/core/src/cache/index.ts:240` | `join(homedir(), ".cache")` -- manual XDG fallback |
| `packages/core/src/cache/index.ts:254` | `join(homedir(), ".cache")` -- duplicate manual fallback |
| `packages/cli/src/commands/init.ts:174` | `join(homedir(), ".config")` -- manual XDG fallback |
| `packages/cli/src/commands/doctor.ts:268,318` | `homedir()` for cache and home path resolution |

**Fix**: Replace with `getConfigDir("waymark")` and `getCacheDir("waymark")` from `@outfitter/config` (already a dependency). These functions handle XDG resolution internally. See [patterns/file-ops.md].

### 2. Module-Level Logger Import (No Context Passing) (7 command files)

All CLI command modules import a singleton `logger` rather than receiving it through handler context.

| Location | Issue |
|----------|-------|
| `packages/cli/src/commands/update.ts:8` | `import { logger } from "../utils/logger.ts"` |
| `packages/cli/src/commands/modify.ts:18` | `import { logger } from "../utils/logger.ts"` |
| `packages/cli/src/commands/scan.ts:15` | `import { logger } from "../utils/logger"` |
| `packages/cli/src/commands/init.ts:11` | `import { logger } from "../utils/logger.ts"` |
| `packages/cli/src/commands/doctor.ts:10` | `import { logger } from "../utils/logger"` |
| `packages/cli/src/commands/add.ts:17` | `import { logger } from "../utils/logger.ts"` |
| `packages/cli/src/commands/remove.ts:18` | `import { logger } from "../utils/logger.ts"` |

**Fix**: Add `logger` to `CommandContext` and pass `ctx.logger` through handler calls. The Outfitter handler pattern expects `ctx: HandlerContext` with `logger` as a property. This also enables per-request logger instances with trace correlation. See [patterns/handler.md] and [patterns/logging.md].

---

## Medium

### 1. Custom Error Classes Not Using Taxonomy (2 classes)

| Location | Issue |
|----------|-------|
| `packages/cli/src/errors.ts:5` | `CliError extends Error` -- custom error class with ad-hoc exit codes |
| `packages/cli/src/commands/modify.ts:89` | `InteractiveCancelError extends Error` -- should use `CancelledError` from contracts |

**Fix**: Replace `CliError` with appropriate taxonomy errors (`ValidationError`, `InternalError`, etc.) and use the existing `mapErrorToExitCode()` in `command-runner.ts`. Replace `InteractiveCancelError` with `CancelledError.create("Interactive prompt cancelled")`. See [patterns/errors.md].

### 2. CommandContext Missing Handler Pattern Properties (1 type)

| Location | Issue |
|----------|-------|
| `packages/cli/src/types.ts:16-20` | `CommandContext` has `config`, `globalOptions`, `workspaceRoot` but no `logger`, `signal`, or `requestId` |

**Fix**: Align `CommandContext` with the Outfitter `HandlerContext` pattern by adding `logger`, `signal` (for cancellation), and optionally `requestId` for trace correlation. See [patterns/handler.md].

### 3. Core Functions Not Returning Result (4 functions)

Key core operations return raw values and throw on error instead of returning `Result`:

| Location | Issue |
|----------|-------|
| `packages/core/src/edit.ts:109` | `editWaymark()` returns `Promise<EditResult>` and throws |
| `packages/core/src/insert.ts:97` | `insertWaymarks()` returns `Promise<InsertionResult[]>` and throws |
| `packages/core/src/insert.ts:121` | `bulkInsert()` returns `Promise<BulkInsertResult[]>` and throws |
| `packages/core/src/remove.ts:143` | `removeWaymarks()` returns `Promise<RemovalResult[]>` with internal try/catch |

**Fix**: Convert return types to `Result<T, WaymarkError>` using `Result.tryPromise()` wrappers. Internal validation should return `Result.err()` instead of throwing. See [patterns/results.md].

---

## Low

### 1. `process.exit()` Without `exitWithError()` (4 non-script occurrences)

| Location | Issue |
|----------|-------|
| `apps/mcp/src/index.ts:71` | `process.exit(1)` in top-level catch |
| `packages/cli/src/program.ts:186,189` | `process.exit()` in signal handlers (acceptable for SIGINT/SIGTERM) |
| `packages/cli/src/program.ts:1128,1256` | `process.exit(exitCode)` in CLI entrypoint (acceptable as transport boundary) |

**Fix**: The CLI entrypoint usages are acceptable as the transport boundary. The MCP server could use a more structured shutdown. Low priority.

### 2. Exit Code Duplication (2 systems)

| Location | Issue |
|----------|-------|
| `packages/cli/src/exit-codes.ts` | `ExitCode` enum (0-4) for CLI |
| `packages/core/src/errors.ts:27-34` | `WAYMARK_EXIT_CODES` with different mapping |

**Fix**: Consolidate to a single exit code source derived from the error taxonomy's `getExitCode()`. See [patterns/errors.md].

---

## Migration Guidance

### Installed Versions

| Package | Current | Location |
|---------|---------|----------|
| `@outfitter/cli` | 0.3.0 | packages/cli |
| `@outfitter/config` | 0.3.0 | packages/core |
| `@outfitter/contracts` | 0.2.0 | packages/cli, packages/core, apps/mcp |
| `@outfitter/logging` | 0.3.0 | packages/cli, apps/mcp |
| `@outfitter/mcp` | 0.3.0 | apps/mcp |

### Updates Available

| Package | Current | Available | Type |
|---------|---------|-----------|------|
| `@outfitter/cli` | 0.3.0 | 0.5.2 | BREAKING |
| `@outfitter/config` | 0.3.0 | 0.3.3 | non-breaking |
| `@outfitter/contracts` | 0.2.0 | 0.4.1 | BREAKING |
| `@outfitter/logging` | 0.3.0 | 0.4.1 | BREAKING |
| `@outfitter/mcp` | 0.3.0 | 0.4.2 | BREAKING |

All five `@outfitter/*` packages have updates available. Four are breaking changes. Migration guides were not available from `outfitter upgrade --guide` -- check release notes for each package.

---

## What's Going Well

Before the recommendations, it is worth noting what has already been adopted successfully:

1. **Result types in config and cache layers** -- `packages/core/src/config.ts` returns `Result<WaymarkConfig, ConfigError>` and the cache module (`cache/schema.ts`, `cache/queries.ts`, `cache/writes.ts`) consistently uses `Result` returns (90 `Result.ok/err/try/tryPromise` calls across 30 files).

2. **@outfitter/contracts error re-exports** -- `packages/core/src/errors.ts` cleanly re-exports `ValidationError`, `NotFoundError`, `InternalError`, etc. from contracts. The `WaymarkError` and `WaymarkResult<T>` type aliases are well-designed.

3. **@outfitter/logging adoption** -- The CLI logger is properly built on `createLogger` and `createConsoleSink` from `@outfitter/logging` with `resolveLogLevel()` for environment-aware configuration.

4. **@outfitter/cli theme integration** -- `ANSI` codes and `supportsColor()` from `@outfitter/cli/colors` and `@outfitter/cli/terminal` are in use.

5. **@outfitter/mcp tool registration** -- The MCP server uses `createMcpServer()`, `defineTool()` with annotations, and properly wires `Result` handling for tool invocations.

6. **@outfitter/config for config loading** -- `deepMerge()` and `parseConfigFile()` from `@outfitter/config` are used in core config resolution.

7. **runCommand() bridge pattern** -- `packages/cli/src/utils/command-runner.ts` provides a clean `Result -> CliError` bridge for the transport boundary.

---

## Recommendations

Prioritized by impact and dependency order:

### Phase 1: Foundation (blocks everything else)

1. **Bump @outfitter/contracts 0.2.0 -> 0.4.1** -- This unlocks `createValidator()`, `.create()` factories, and `createContext()`. All downstream work depends on the latest contracts API.

2. **Bump @outfitter/config 0.3.0 -> 0.3.3** -- Non-breaking update, do first as a quick win.

### Phase 2: Core Error Model

3. **Convert `packages/core/src/edit.ts` to Result returns** -- 10 throws in a single file. Convert `editWaymark()` signature to `Promise<Result<EditResult, WaymarkError>>` and replace all throws with `Result.err()`.

4. **Convert `packages/core/src/insert.ts` and `remove.ts`** -- Same pattern as edit.ts. These three files form the core mutation API.

5. **Replace `homedir()` calls with `@outfitter/config` functions** -- 5 occurrences across 4 files. Use `getConfigDir("waymark")` and `getCacheDir("waymark")`.

### Phase 3: CLI Layer

6. **Add `logger` to `CommandContext`** -- Small type change with large impact. Enables per-command logger context instead of module-level singleton.

7. **Replace `CliError` with taxonomy errors** -- Eliminate the custom error class. Use `ValidationError`, `InternalError`, etc. with the existing `mapErrorToExitCode()`.

8. **Convert CLI command modules to Result returns** -- Start with `scan.ts` and `lint.ts` (already partially Result-based), then `add.ts` and `modify.ts` (most throws).

### Phase 4: MCP Layer

9. **Replace Zod `.parse()` with `createValidator()`** -- 3 occurrences in MCP tools. Quick fix that adds proper `Result<T, ValidationError>` wrapping.

10. **Convert MCP tool handlers to eliminate throws** -- 16 throws across 6 files. The tool handler should return `Result.err()` instead of throwing.

### Phase 5: Package Updates

11. **Bump @outfitter/logging 0.3.0 -> 0.4.1** -- Breaking changes, do after logging context is wired through.

12. **Bump @outfitter/cli 0.3.0 -> 0.5.2** -- Breaking changes, do after CLI error model is migrated.

13. **Bump @outfitter/mcp 0.3.0 -> 0.4.2** -- Breaking changes, do after MCP handlers are Result-based.

---

## Pass Criteria

- [ ] 0 critical issues (currently 118 throws + 67 try/catch + 3 unsafe parse)
- [ ] 0 high issues (currently 5 hardcoded paths + 7 singleton logger imports)
- [ ] All handlers return `Result<T, E>`
- [ ] No `throw` in application code (test files excluded)
- [ ] No `console.log` in production code (currently clean -- scripts only)
- [ ] No `homedir()` calls (use `@outfitter/config`)
