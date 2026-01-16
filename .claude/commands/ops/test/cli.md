---
name: ops-test-cli
description: Run Waymark CLI validation tests
argument-hint: "[category|--all]"
allowed-tools: Read Glob Grep Skill TodoWrite Bash(./.claude/scripts/run-tests.sh *) Bash(wm *)
---

# CLI Validation Tests

Load the `cli-testing` skill for detailed testing guidance.

## Quick Run

```bash
./.claude/scripts/run-tests.sh [category|--all]
```

## Categories

| Category | Tests | Focus |
|----------|-------|-------|
| `parse` | Grammar parsing | Validates waymark syntax via `wm lint -` stdin |
| `scan` | File scanning | Tests `wm find` filtering, JSON/JSONL output |
| `format` | Formatting | Tests `wm fmt` consistency and idempotency |
| `lint` | Validation rules | Tests lint rule detection and reporting |
| `cli` | CLI basics | Help text, version, exit codes, argument parsing |
| `integration` | E2E workflows | Add, edit, remove waymarks in sequence |
| `config` | Configuration | Tests `wm config --print` and config merging |
| `check` | Health checks | Tests `wm doctor` diagnostics |

## Output

Results written to `.scratch/testing/`:

- `{date}-{id}-{category}.md` - Markdown report
- `{date}-{id}-{category}-debug.log` - Debug output

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests passed |
| 1 | One or more tests failed |
| 2 | Setup or usage error |

## Result Classifications

| Result | Meaning |
|--------|---------|
| **PASS** | Behaves as expected |
| **WARN** | Works but unexpected output |
| **FAIL** | Broken behavior or wrong exit code |

## When to Use

- After modifying CLI option parsing
- Before releases
- To validate error handling
- CI pipelines (deterministic, fast)
