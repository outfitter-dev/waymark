<!-- tldr ::: scan results for Outfitter Stack adoption candidates in Waymark -->

# Outfitter Stack Adoption Scan Results

Scanned: 2026-02-06
Branch: `gitbutler/workspace`

## Summary

| Anti-Pattern | Count | Priority |
|-------------|-------|----------|
| `throw` statements | 103 | HIGH |
| `process.exit()` calls | 34 | HIGH |
| `try/catch` blocks | 21 files | HIGH |
| `console.*` in lib code | 6 | MEDIUM |
| `process.cwd()` hardcoded | 27 | MEDIUM |
| Custom error handling | ad-hoc | HIGH |

## Package Assessment

### @waymarks/grammar (CLEAN - No changes needed)

- Zero throws, zero side effects
- Pure parser with no I/O
- Tests are self-contained

### @waymarks/core (HIGH PRIORITY)

- `config.ts` - throws on invalid config, uses process.cwd()
- `cache/index.ts` - throws on DB errors, try/catch around bun:sqlite
- `cache/writes.ts` - transaction error handling via throws
- `cache/queries.ts` - query errors via throws
- `insert.ts` - already returns `{status, error?}` (easy Result wrap)
- `remove.ts` - already returns `{status, error?}` (easy Result wrap)
- `ids.ts` - throws on invalid/unreserved IDs

### @waymarks/cli (HIGHEST PRIORITY - largest surface)

- `index.ts` (1,787 lines) - 34 process.exit calls, monolithic command dispatch
- `commands/add.ts` - throws on validation, file not found
- `commands/remove.ts` - throws on validation
- `commands/modify.ts` - throws on validation
- `commands/init.ts` - throws on existing config, permission errors
- `commands/doctor.ts` - throws on diagnostic failures
- `commands/unified/` - complex flag parsing with throws

### @waymarks/mcp (MEDIUM PRIORITY)

- `utils/logger.ts` - console.error for all logging levels
- Tool handlers catch and re-throw errors
- No structured error responses

### @waymarks/agents (LOW PRIORITY)

- Mostly configuration and rule files
- Minimal code to convert

## Existing Patterns to Preserve

1. **insert.ts / remove.ts** already return structured results:

   ```typescript
   type InsertionResult = { status: "success" | "error"; error?: string; }
   ```

   These just need `Result` wrapping.

2. **Pino logger** exists in CLI for structured logging - can be replaced by `@outfitter/logging`.

3. **XDG path resolution** exists in config.ts - aligns well with `@outfitter/config` patterns.

4. **JSON/JSONL/text output modes** already implemented - aligns with `@outfitter/cli` output contracts.
