<!-- tldr ::: v1-rc quality bar definition and non-negotiable requirements -->

# Waymark v1.0 Release Candidate Specification

**Created:** 2026-01-08
**Status:** Active
**Target:** v1.0.0-rc.1

## What "Release Candidate" Means

A release candidate (RC) is feature-complete and believed to be production-ready. It may become the final release unchanged if no critical issues emerge during validation. The v1-rc phase focuses on **correctness, contract stability, and polish** rather than new features.

## Quality Bar Definition

### Correctness (Non-Negotiable)

1. **Deterministic behavior**: Same inputs produce identical outputs across runs
2. **Spec compliance**: Implementation matches documented grammar and behavior
3. **No silent failures**: Errors surface clearly with actionable messages
4. **Data integrity**: State mutations (IDs, history, index) are transactional

### Contract Stability (Non-Negotiable)

1. **Schema/runtime alignment**: JSON schemas match actual output structures
2. **Spec/implementation alignment**: Documentation accurately describes behavior
3. **Backward compatibility**: Documented aliases and flags work as promised
4. **Stable IDs**: Waymark identifiers are reproducible and spec-compliant

### Polish (Expected)

1. **CLI citizenship**: Proper exit codes, TTY handling, flag consistency
2. **Error UX**: Messages follow What/Why/How pattern
3. **Documentation**: Quickstart works, examples are accurate
4. **Maintainability**: No file exceeds 500 lines (aspirational for entry files)
5. **Commander citizenship**: Consistent use of Commander.js patterns (see below)

## Non-Negotiable Requirements Before v1.0 Final

### P0 Blockers (Must Fix for RC)

| Issue | Impact | Evidence |
|-------|--------|----------|
| Non-deterministic ID generation | IDs change across runs, breaking references | `Date.now()` in `packages/core/src/ids.ts:166` |
| ID length mismatch | Default 8 chars vs spec 7 chars | `packages/core/src/config.ts:53` |
| Block comment support missing | CSS waymarks silently ignored | `/*` missing from `packages/grammar/src/tokenizer.ts:5` |
| Schema/runtime relation drift | External tools reject valid output | Schema has old kinds, runtime has new |

### P1 Contract Stability (Must Fix Before Final)

| Issue | Impact | Evidence |
|-------|--------|----------|
| Transactional remove missing | Orphaned IDs on write failure | `packages/core/src/remove.ts:420-437` |
| `wm complete` alias broken | Falls through to scan | `packages/cli/src/index.ts` |
| Mention pattern mismatch | Schema allows invalid patterns | Schema vs spec pattern differs |

### P2 CLI Citizenship (Should Fix)

| Issue | Impact |
|-------|--------|
| No semantic exit codes | Scripts cannot distinguish error types |
| No `--no-input` flag | CI environments may hang |
| TTY detection inconsistent | Color output in pipes |
| No SIGINT/SIGTERM handlers | Ungraceful shutdown in scripts |
| `NO_COLOR` env var not respected | Color output where user disabled it |

## Commander Citizenship Definition

"Commander citizenship" means the CLI follows Commander.js best practices consistently across all commands. This is the quality bar for v1-rc:

### Required for RC

| Pattern | Description | Rationale |
|---------|-------------|-----------|
| `program.error()` | Use Commander's error method instead of manual `writeStderr()` + `process.exit()` | Consistent error handling, better testing |
| Exit code constants | Define `EXIT_CODES` object instead of magic numbers | Maintainable, documented |
| `.hideCommand()` | Use Commander's native method instead of custom `HIDDEN_COMMANDS` array | Standard pattern |
| `.choices()` | Use for constrained options like `--scope` | Automatic validation, better help |
| Signal handlers | Handle SIGINT/SIGTERM gracefully | Unix convention (exit 128+signal) |
| `NO_COLOR` respect | Check env var alongside `--no-color` flag | Standard (no-color.org) |

### Commander Error/Exit Contract (RC)

To keep CLI behavior consistent across commands, Commander must use a single
error/exit contract during the RC phase:

- **Usage errors** (unknown option/command, missing arguments) must exit with
  code **2** (`ExitCode.usageError`). This is enforced via `program.exitOverride`
  and mapping all `commander.*` errors to usage error.
- **Handled runtime errors** must call `program.error()` with the appropriate
  `ExitCode` (1/3/4) and a stable error `code` string for tests.
- `--help`/`--version` exits remain **0**.

### Deferred to Post-RC (P4)

| Pattern | Description | Why Deferred |
|---------|-------------|--------------|
| Full Commander parsing for `add`/`rm` | Remove `allowUnknownOption(true)` bypass | Risk vs benefit; works currently |
| `.addCommand()` modularity | Extract commands to separate files | Code organization, not correctness |
| `InvalidArgumentError` | Use Commander's error type in custom parsers | Better error messages, not critical |
| `.env()` for options | Support `WAYMARK_SCOPE` etc. | Polish |
| `.implies()` | Related option implications | Polish |
| Progress spinners (`ora`) | Visual feedback for long operations | Polish |
| Update notifications | Notify of new versions | Polish |

### Anti-Patterns to Avoid

These patterns violate Commander citizenship and should be fixed:

| Anti-Pattern | Current Location | Correct Pattern |
|--------------|------------------|-----------------|
| Manual argv parsing | `add.ts`, `remove.ts` | **RC exception**: keep manual parsing until P4 migration |
| `allowUnknownOption(true)` bypass | `index.ts` | Define all options in Commander |
| Hardcoded exit codes | Multiple files | Use `EXIT_CODES` constants |
| Custom hidden command array | `index.ts` | Use `.hideCommand()` |
| Manual `process.exit()` | Multiple files | Use `program.error()` |

### Migration Path

The `edit` command demonstrates the target pattern - it uses Commander properly without bypass. The migration for `add` and `rm` follows three phases:

1. **Phase 1** (RC): Define all options in Commander for help text (low risk)
2. **Phase 2** (P4): Use Commander's parsed values instead of argv extraction
3. **Phase 3** (P4): Remove custom parsers entirely

For RC, `add` and `rm` may continue manual argv parsing as long as help output
is defined in Commander and behavior matches the existing contract.

See @cli-improvements.md for implementation details.

## Verification Checklist

Use before tagging any RC:

### Correctness

- [ ] ID generation test passes (same input = same output across fresh instances)
- [ ] ID length is 7 characters by default
- [ ] CSS waymarks (`/* todo ::: */`) parse correctly
- [ ] Schema validates against actual CLI output

### Contract Stability

- [ ] `wm complete` works as alias for `wm completions`
- [ ] Remove operations are atomic (no orphaned IDs on failure)
- [ ] Spec alignment CI check passes (if implemented)

### CLI Citizenship

- [ ] Exit codes are semantic (0=success, 1=failure, 2=usage, 3=config, 4=io)
- [ ] `--help` shows accurate information
- [ ] Color disabled when not TTY or `NO_COLOR` set
- [ ] SIGINT exits with code 130, SIGTERM with 143
- [ ] `--scope` validates choices (default, project, user)

### Commander Citizenship

- [ ] `EXIT_CODES` constants defined and used
- [ ] `.hideCommand()` used instead of `HIDDEN_COMMANDS` array
- [ ] `.choices()` used for `--scope` option
- [ ] `program.error()` used instead of manual exit (P2 goal)
- [ ] No hardcoded exit codes in action handlers

### Documentation

- [ ] README has development quickstart
- [ ] All claims in docs match implementation
- [ ] Examples work when copy-pasted

## Success Criteria

The v1.0-rc is ready when:

1. **All P0 blockers resolved** with tests proving correctness
2. **All P1 issues resolved** or explicitly deferred with rationale
3. **P2 issues addressed** or documented as known limitations
4. **Verification checklist passes** on clean environment
5. **No regressions** in existing test suite

## Out of Scope for RC

These are explicitly deferred to post-v1.0:

- Performance optimization (cache integration with scan)
- Multi-line block comment support (single-line `/* */` only)
- CLI entry file refactoring below 500 lines
- Property-based testing infrastructure
- MCP bounded concurrency (documented as limitation)

## References

- @blockers.md - Detailed P0 blocker analysis
- @PLAN.md - Phased implementation roadmap
- @cli-improvements.md - CLI citizenship improvements (includes Commander migration)
- @file-structure.md - File structure recommendations
- @documentation.md - Documentation alignment plan
- `.scratch/commander-gap-analysis.md` - Commander.js best practices gap analysis
- `.scratch/commander-migration-add-rm-edit.md` - Migration analysis for add/rm/edit commands
