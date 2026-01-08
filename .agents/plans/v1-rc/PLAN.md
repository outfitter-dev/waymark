<!-- tldr ::: phased implementation roadmap for v1.0-rc with clear milestones ref:#docs/plan/v1-rc #docs/plan #docs -->

# Waymark v1.0-RC Implementation Plan

**Created:** 2026-01-08
**Derived from:** SPEC.md, gold-standard-synthesis, fresh-eyes-review
**Status:** Ready for execution

## Overview

This plan synthesizes findings from three independent senior developer reviews and validated fresh-eyes analysis. All reviewers converged on the same critical blockers, providing high confidence in prioritization.
<!-- note ::: incorporates 2026-01-08 plan review deltas and opportunity backlog ref:#docs/plan/v1-rc/review #docs/plan #docs -->

## Phase Summary

| Phase | Focus | Duration | Deliverable |
|-------|-------|----------|-------------|
| **P0** | Correctness Blockers | 2-3 days | All spec violations fixed |
| **P1** | Contract Stability | 2-3 days | Schema/runtime aligned |
| **P2** | CLI Citizenship | 2-3 days | Semantic exit codes, flags |
| **P3** | Documentation | 2-3 days | Quickstart, accurate docs |

**Total estimated time:** 1.5-2 weeks

---

## Phase 0: Correctness Blockers (P0)

**Goal:** Fix issues that cause incorrect behavior or break the spec contract.

**Milestone:** All P0 items fixed with tests proving correctness.

### Tasks

| Task | File | Effort | Assignee |
|------|------|--------|----------|
| Remove `Date.now()` from ID generation | `packages/core/src/ids.ts:166` | S | |
| Change ID default length to 7 | `packages/core/src/config.ts:53` | S | |
| Add `/*` to comment leaders | `packages/grammar/src/tokenizer.ts:5` | S | |
| Handle trailing `*/` in block comments | `packages/grammar/src/tokenizer.ts` | S | |
| Align block comment metadata with tests | `packages/grammar/src/tokenizer.test.ts` | S | |
| Update schema relation kinds | `schemas/waymark-record.schema.json:79` | S | |
| Add ID determinism test | `packages/core/src/ids.test.ts` | S | |
| Add block comment parse tests | `packages/grammar/src/tokenizer.test.ts` | S | |
| Add MCP concurrency limits + result cap | `apps/mcp/src/resources/todos.ts` | M | |
| Add MCP limit tests | `apps/mcp/src/resources/todos.test.ts` | S | |

### Definition of Done

- [ ] `bun test` passes on all packages
- [ ] ID generation produces identical output across fresh manager instances
- [ ] `/* todo ::: test */` parses to `{ type: "todo", content: "test" }`
- [ ] MCP todos resource returns `truncated: true` when hitting MAX_RESULTS

### Detailed Requirements

See @blockers.md for implementation details and code samples.
<!-- note ::: block comment tests must assert `commentLeader === "/*"` or add `commentStyle` to ParsedHeader ref:#docs/plan/v1-rc/p0-block-comments #docs/plan #docs -->

---

## Phase 1: Contract Stability (P1)

**Goal:** Align all contracts (schema, spec, runtime) and ensure atomic operations.

**Milestone:** External tools can trust schema; remove operations are safe.

### Tasks

| Task | File | Effort | Assignee |
|------|------|--------|----------|
| Implement transactional remove | `packages/core/src/remove.ts` | M | |
| Restore `wm complete` alias | `packages/cli/src/index.ts` | S | |
| Fix mention pattern in schema | `schemas/waymark-record.schema.json:104` | S | |
| Create spec alignment CI check | `scripts/check-spec-alignment.ts` | M | |
| Add schema conformance tests | `packages/core/src/` | M | |
| **Schema Coverage** | | | |
| Create lint report schema | `schemas/lint-report.schema.json` | S | |
| Create doctor report schema | `schemas/doctor-report.schema.json` | S | |
| Create scan result schema | `schemas/scan-result.schema.json` | S | |
| **Output Consistency** | | | |
| Create unified output adapter | `packages/cli/src/utils/output.ts` | M | |
| Migrate commands to output adapter | Multiple files | M | |

### Definition of Done

- [ ] `wm complete zsh` outputs shell completions (not scan results)
- [ ] Remove with simulated write failure leaves index unchanged
- [ ] `@Alice` rejected by schema (must be lowercase-first)
- [ ] CI script validates schema enum matches runtime constants
- [ ] All `--json` outputs validate against their schemas
- [ ] `createOutput()` adapter handles result/status/error/warn/debug

### Detailed Requirements

**Transactional remove pattern:**

```text
1. Write file to temp path (same directory as target to keep rename atomic)
2. Atomic rename temp -> original
3. Only then update ID index/history
4. On any failure, no state changes
```

---

## Phase 2: CLI Citizenship (P2)

**Goal:** Make CLI behave like a well-designed Unix tool.

**Milestone:** Scripts can reliably use exit codes; CI works without TTY; Commander patterns consistent.

### Tasks

| Task | File | Effort | Assignee |
|------|------|--------|----------|
| Define exit code constants | `packages/cli/src/exit-codes.ts` | S | |
| Wire exit codes into all commands | Multiple files | M | |
| Add `--no-input` global flag | `packages/cli/src/index.ts` | S | |
| Add `--quiet` global flag | `packages/cli/src/index.ts` | S | |
| Centralize TTY/color detection | `packages/cli/src/utils/terminal.ts` | M | |
| Document exit codes in `--help` | `packages/cli/src/index.ts` | S | |
| Decide Commander error/exit contract + align SPEC | `packages/cli/src/index.ts`, `.agents/plans/v1-rc/SPEC.md` | S | |
| Clarify manual argv parsing requirement in SPEC | `.agents/plans/v1-rc/SPEC.md` | S | |
| **Commander Quick Wins** | | | |
| Use `.hideCommand()` for fmt/lint | `packages/cli/src/index.ts` | S | |
| Add `.choices()` to `--scope` | `packages/cli/src/index.ts` | S | |
| Add SIGINT/SIGTERM handlers | `packages/cli/src/index.ts` | S | |
| Respect `NO_COLOR` env var | `packages/cli/src/utils/output.ts` | S | |
| Use `program.error()` consistently | Multiple files | M | |
| Sanitize ANSI/control chars in human output | `packages/cli/src/utils/output.ts` | S | |
| Harden `wm update --command` (warn + allowlist) | `packages/cli/src/commands/update.ts` | S | |
| Define `--quiet` precedence with JSON output | `packages/cli/src/utils/output.ts` | S | |
| **Contract Tests** | | | |
| Create contracts test directory | `packages/core/src/__tests__/contracts/` | S | |
| Add ID stability contract tests | `packages/core/src/__tests__/contracts/ids.test.ts` | M | |
| Add relation contract tests | `packages/core/src/__tests__/contracts/relations.test.ts` | M | |
| Add parse/format roundtrip tests | `packages/grammar/src/__tests__/roundtrip.test.ts` | M | |

### Definition of Done

- [ ] `wm lint bad-file.ts; echo $?` returns 1
- [ ] `wm find --help; echo $?` returns 0
- [ ] `wm find --invalid-flag; echo $?` returns 2
- [ ] `wm --no-input` fails fast when input required
- [ ] `wm find | cat` produces no ANSI codes
- [ ] `NO_COLOR=1 wm find` produces no ANSI codes
- [ ] `wm find --json --quiet` still emits JSON (quiet only affects human output)
- [ ] Ctrl+C exits cleanly with code 130
- [ ] Contract tests prevent regressions in ID generation and relations

### Detailed Requirements

See @cli-improvements.md for exit code taxonomy, TTY handling, and Commander migration details.

---

## Phase 3: Documentation & DX (P3)

**Goal:** New contributors can onboard in 30 minutes; docs match reality; agent documentation consolidated.

**Milestone:** README quickstart works; no outdated claims; `wm skill` provides unified agent docs.

### Tasks

| Task | File | Effort | Assignee |
|------|------|--------|----------|
| Add development quickstart to README | `README.md` | S | |
| Document Bun version requirement | `README.md` | S | |
| Fix outdated architecture claims | Various | S | |
| Create CONTRIBUTING.md | `CONTRIBUTING.md` | M | |
| Enhance `wm doctor` checks | `packages/cli/src/commands/doctor.ts` | M | |
| Add help text snapshot tests | `packages/cli/src/__tests__/` | M | |
| **Config & Troubleshooting** | | | |
| Add `wm config --print` command | `packages/cli/src/commands/config.ts` | S | |
| Document config precedence | `README.md` | S | |
| Add troubleshooting section | `README.md` | S | |
| **Agent Documentation Consolidation** | | | |
| Create modular skill structure | `packages/agents/skills/waymark/` | M | |
| Canonicalize skill layout + manifest shape | `.agents/plans/v1-rc/skill-structure.md` | S | |
| Align `wm skill` docs to `show` subcommand | `.agents/plans/v1-rc/skill-command.md` | S | |
| Create SKILL.md core document | `packages/agents/skills/waymark/SKILL.md` | M | |
| Create command docs | `packages/agents/skills/waymark/commands/*.md` | M | |
| Create reference docs | `packages/agents/skills/waymark/references/*.md` | S | |
| Create example workflows | `packages/agents/skills/waymark/examples/workflows.md` | M | |
| Create agent task patterns | `packages/agents/skills/waymark/examples/agent-tasks.md` | M | |
| Create batch operations guide | `packages/agents/skills/waymark/examples/batch-operations.md` | S | |
| Create integration guide | `packages/agents/skills/waymark/examples/integration.md` | M | |
| Create index.json manifest | `packages/agents/skills/waymark/index.json` | S | |
| Implement skill parser | `packages/cli/src/skills/parser.ts` | S | |
| Implement `wm skill` command | `packages/cli/src/commands/skill.ts` | M | |
| Ensure skill assets ship in CLI package | `packages/cli/package.json`, build scripts | S | |
| Delete `.prompt.txt` and `.help.txt` files | `packages/cli/src/commands/` | S | |
| Remove `--prompt` flag handling | Various | S | |

### Definition of Done

- [ ] Fresh clone + README steps = working CLI in <5 minutes
- [ ] `rg "thin dispatcher" docs/` returns no false claims
- [ ] CONTRIBUTING.md covers: setup, testing, PR process
- [ ] `wm doctor` reports cache status and completion state
- [ ] `wm config --print` shows merged configuration
- [ ] README troubleshooting covers Bun/npm registry issues
- [ ] `wm skill` outputs core SKILL.md content
- [ ] `wm skill show add` outputs command-specific documentation
- [ ] `wm skill show workflows` outputs example workflows
- [ ] `wm skill --json` parses modular structure correctly
- [ ] `wm skill list` shows available commands, references, and examples
- [ ] Skill directory structure includes examples/ with all four files
- [ ] No `.prompt.txt` or `.help.txt` files remain in codebase
- [ ] CLI package includes skill assets in published artifact

### Detailed Requirements

See @documentation.md for specific claims to fix.
See @skill-structure.md for modular skill architecture.
See @skill-command.md for CLI interface design.
<!-- note ::: standardize on `wm skill show <section>`; remove `--section` references across docs/tests ref:#docs/plan/v1-rc/skills-cli #docs/plan #docs -->

---

## Future Phases (Post-RC)

These are explicitly deferred but documented for planning:

### P4: Commander.js Full Migration

Migrate `add` and `rm` commands from custom parsing to full Commander.js integration. The `edit` command already demonstrates the target pattern.

| Task | File | Effort | Rationale for Deferral |
|------|------|--------|------------------------|
| Define all `add` options in Commander | `packages/cli/src/index.ts` | M | Works, help text improvement |
| Define all `rm` options in Commander | `packages/cli/src/index.ts` | M | Works, help text improvement |

### P5: Post-RC Opportunities (Tracked, not required for v1.0-RC)

| Task | File | Effort | Rationale for Deferral |
|------|------|--------|------------------------|
| Add scan performance instrumentation + cache toggle | `packages/cli/src/commands/scan.ts` | M | Perf improvement, not correctness |
| Extend spec-alignment CI to mention pattern + enums | `scripts/check-spec-alignment.ts` | S | Guardrail, not blocking |
| Replace argv extraction with Commander values | `add.ts`, `remove.ts` | M | Risk vs benefit for RC |
| Remove `allowUnknownOption(true)` | `packages/cli/src/index.ts` | M | Depends on above |
| Add custom FILE:LINE argument parser | `packages/cli/src/utils/` | S | Supporting infrastructure |
| Remove `parseAddArgs()` custom parser | `packages/cli/src/commands/add.ts` | M | Final cleanup |
| Remove `parseRemoveArgs()` custom parser | `packages/cli/src/commands/remove.ts` | M | Final cleanup |
| Use `InvalidArgumentError` for validation | Multiple files | S | Better error messages |
| Add progress spinners (`ora`) | Multiple files | M | Polish, not critical |
| Add update notifications | `packages/cli/src/index.ts` | S | Polish, not critical |

**Migration phases:**

1. Phase 1 (Low risk): Define options in Commander, keep custom parser
2. Phase 2 (Medium risk): Use Commander's parsed values
3. Phase 3 (Higher risk): Remove custom parsers entirely

See @cli-improvements.md for detailed migration strategy.

### P6: Architecture Improvements

| Task | File | Effort | Rationale for Deferral |
|------|------|--------|------------------------|
| Reduce CLI entry to <500 lines | `packages/cli/src/index.ts` | L | Commands already modular |
| Modularize commands with `.addCommand()` | `packages/cli/src/commands/*/index.ts` | L | Works, code organization |
| Wire cache into scan path | `packages/core/src/scan.ts` | L | Works without, perf optimization |
| Multi-line block comment support | `packages/grammar/src/parser.ts` | L | Single-line covers most cases |
| Extract shared constants | `packages/grammar/src/constants.ts` | M | Not blocking |
| Property-based tests | Test files | M | Nice to have |

See @file-structure.md for detailed split recommendations.

---

## Execution Guidelines

### Work Order

Phases must be completed in order (P0 before P1, etc.) because:

1. P0 fixes correctness that P1 tests depend on
2. P1 stabilizes contracts that P2 CLI changes expose
3. P3 documents behavior that earlier phases implement

### Per-Task Workflow

1. Graphite-synced repos: start with `gt log`; non-Graphite: `git checkout -b fix/p0-deterministic-ids`
2. Write failing test first (TDD red phase)
3. Implement fix (TDD green phase)
4. Run `bun check:all` before commit
5. Stage changes, then commit (`gt create` for Graphite; conventional commit otherwise)
6. PR with reference to this plan

### Commit Guidelines

```text
fix(core): make ID generation deterministic

Remove Date.now() from hash seed to ensure identical IDs
for identical metadata across runs.

Fixes P0-1 in v1-rc plan.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

## Tracking

### Progress Dashboard

| Phase | Status | Completion |
|-------|--------|------------|
| P0 | Not Started | 0/10 tasks |
| P1 | Not Started | 0/10 tasks |
| P2 | Not Started | 0/20 tasks |
| P3 | Not Started | 0/25 tasks |

### Blockers

*None currently identified*

### Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-08 | ID length: 7 chars | Spec compliance, sufficient collision space |
| 2026-01-08 | Exit code taxonomy: 0-4 | POSIX-friendly, covers common cases |
| 2026-01-08 | Defer CLI refactor | Commands already modular, entry size is P4 |
| 2026-01-08 | Commander hybrid approach | Keep custom parsing for waymark content, use Commander for standard flags |
| 2026-01-08 | Quick wins in P2, full migration in P4 | Quick wins are low-risk improvements; full migration needs careful testing |
| 2026-01-08 | `edit` as migration model | Already uses Commander properly, demonstrates target pattern |
| 2026-01-08 | `wm skill` for agent docs | Single source of truth; deprecate `--prompt` flag and delete `.prompt.txt`/`.help.txt` files |
| 2026-01-08 | Modular skill structure | Progressive disclosure; core SKILL.md (~200 lines) + command docs on-demand; supersedes monolithic cli.md |
| 2026-01-08 | Add examples/ directory | Replaces .prompt.txt use cases with structured examples; workflows, agent-tasks, batch-operations, integration docs |
| 2026-01-08 | `wm skill show <section>` interface | Resolve `show` vs `--section` ambiguity across docs and tests |
| 2026-01-08 | MCP concurrency limits (P0) | Memory safety in large repos; added after fresh-eyes review |
| 2026-01-08 | Schema coverage for all outputs (P1) | External tools need stable programmatic contracts |
| 2026-01-08 | Unified output adapter (P1) | Consistent stdout/stderr routing, JSON/quiet mode enforcement |
| 2026-01-08 | Contract test suite (P2) | Prevent regressions in IDs/relations across releases |

### Open Decisions (Require Resolution)

| Decision | Options | Status |
|----------|---------|--------|
| Cache integration | Wire into scan vs remove docs claim | Pending investigation |
| Spec as source of truth | Formalize derivations (schema/types/help) in CI | Pending design |
| Mention parsing edge cases | Align mention parsing to spec to avoid false triggers | Pending spec review |
| Skill manifest shape | `index.json` top-level vs `structure` wrapper | Pending alignment |
| `wm skill path` output | Return directory vs SKILL.md file path | Pending decision |

---

## References

- @SPEC.md - Quality bar and requirements
- @blockers.md - P0 blocker details
- @cli-improvements.md - P2 CLI details and agent documentation consolidation
- @file-structure.md - Deferred architecture work
- @documentation.md - P3 documentation fixes
- @skill-command.md - `wm skill` command design (problem analysis, CLI interface)
- @skill-structure.md - Modular skill file structure (supersedes monolithic approach)
- `/Users/mg/Developer/outfitter/waymark/.scratch/gold-standard-synthesis.md` - Source synthesis
- `/Users/mg/Developer/outfitter/waymark/.scratch/20260108-fresh-eyes-review.md` - Fresh-eyes review notes
- `/Users/mg/Developer/outfitter/waymark/.scratch/gold-standard-recommendations-a.md` - Review recommendations (A)
- `/Users/mg/Developer/outfitter/waymark/.scratch/gold-standard-recommendations-b.md` - Review recommendations (B)
- `/Users/mg/Developer/outfitter/waymark/.scratch/gold-standard-recommendations-c.md` - Review recommendations (C)
- `/Users/mg/Developer/outfitter/waymark/.scratch/20260108-rc-plan-review.md` - Plan review deltas
- `/Users/mg/Developer/outfitter/waymark/.scratch/20260108-rc-plan-opportunities.md` - Additional opportunity backlog
