---
name: cli-testing
description: CLI testing guidance and patterns. Loaded by /ops/test/cli command or subagents for comprehensive testing.
compatibility: Requires Bun runtime and wm CLI installed (bun install && bun install:bin)
allowed-tools: Read Glob Grep Skill TodoWrite Bash(./.claude/scripts/run-tests.sh *) Bash(wm *) Bash(wm-dev *)
metadata:
  author: outfitter-dev
  version: "1.0"
---
<!-- tldr ::: CLI integration test runner skill with markdown reporting #test/cli -->

# Waymark CLI Testing Skill

This skill provides guidance for running and extending the Waymark CLI integration test suite.

## Quick Start

```bash
# Ensure CLI is installed
bun install && bun install:bin

# Run all tests
./.claude/scripts/run-tests.sh --all

# Run specific category
./.claude/scripts/run-tests.sh parse
./.claude/scripts/run-tests.sh lint
```

Or use the Claude command:

```bash
/ops/test/cli --all
/ops/test/cli parse
```

## Test Categories Reference

| Category | Command | What It Tests |
|----------|---------|---------------|
| `parse` | `wm lint -` | Grammar parsing via stdin, signals, properties |
| `scan` | `wm find` | File scanning, type/tag filtering, JSON output |
| `format` | `wm fmt` | Formatting detection, --write flag, idempotency |
| `lint` | `wm lint` | Lint rules: multiple-tldr, unknown-marker, codetag |
| `cli` | `wm --help` | Help text, version, argument validation, exit codes |
| `integration` | Multiple | End-to-end workflows combining commands |
| `config` | `wm config` | Config printing, JSON output, --print requirement |
| `check` | `wm doctor` | Health diagnostics, JSON output, path filtering |

## Output Structure

Test results are written to `.scratch/testing/`:

```text
.scratch/testing/
  20260116-1705432800-parse.md          # Markdown report
  20260116-1705432800-parse-debug.log   # Full command output
  20260116-1705432800-scan.md
  20260116-1705432800-scan-debug.log
  ...
```

### Report Format

```markdown
# Waymark CLI Test Report

**Category**: parse
**Run ID**: 1705432800
**Date**: 2026-01-16T15:00:00Z
**Debug Log**: 20260116-1705432800-parse-debug.log

---

## Results

| # | Test | Status | Details |
|---|------|--------|---------|
| 1 | Parse valid waymark syntax | PASS | Output matched expected pattern |
| 2 | Parse waymark with properties | PASS | Output matched expected pattern |
...

## Summary

| Metric | Count |
|--------|-------|
| Total | 5 |
| Passed | 5 |
| Warnings | 0 |
| Failed | 0 |
```

## Adding New Tests

### Step 1: Choose the Right Category

- **Grammar/parsing behavior**: `run_parse_tests()`
- **File scanning/filtering**: `run_scan_tests()`
- **Formatting rules**: `run_format_tests()`
- **Lint rules**: `run_lint_tests()`
- **CLI argument handling**: `run_cli_tests()`
- **Multi-command workflows**: `run_integration_tests()`
- **Configuration**: `run_config_tests()`
- **Health checks**: `run_check_tests()`

### Step 2: Use the `run_test` Function

```bash
run_test NUM "Test name" "command" "expected_pattern" [expect_fail]
```

**Parameters**:

- `NUM`: Test number (increment from existing tests)
- `"Test name"`: Human-readable description
- `"command"`: Command to execute (use `$TEMP_DIR` for fixtures)
- `"expected_pattern"`: Regex pattern to match in output
- `expect_fail`: Optional, set to `"true"` if expecting non-zero exit

### Step 3: Add Test Fixtures (if needed)

Add fixtures to `setup_temp_fixtures()`:

```bash
setup_temp_fixtures() {
  # ... existing fixtures ...

  # Add your fixture
  cat > "$TEMP_DIR/my-fixture.ts" << 'EOF'
// tldr ::: fixture for testing XYZ
// todo ::: test waymark
export const x = 1;
EOF
}
```

### Example: Adding a New Parse Test

```bash
run_parse_tests() {
  # ... existing tests ...

  # Add new test
  run_test 6 "Parse waymark with multiple tags" \
    "echo '// todo ::: implement #perf #security' | wm lint -" \
    "no issues|0 issues" \
    false
}
```

### Example: Adding an Expected Failure Test

```bash
run_lint_tests() {
  # ... existing tests ...

  # Test that detects a specific error
  run_test 6 "Detect duplicate property" \
    "wm lint '$TEMP_DIR/duplicate-prop.ts'" \
    "duplicate.*property|same key" \
    true  # Expect non-zero exit
}
```

## Exit Code Reference

| Code | Meaning | When |
|------|---------|------|
| 0 | Success | All tests passed |
| 1 | Failure | One or more tests failed |
| 2 | Setup Error | CLI not found, invalid category |

## Debugging Failures

1. **Check the debug log**: Full command output is captured in the `-debug.log` file

2. **Run command manually**: Copy the command from the debug log and run it directly

3. **Check fixtures**: Ensure test fixtures are created correctly in `setup_temp_fixtures()`

4. **Verify pattern**: The `expected_pattern` is a regex - test it with `grep -E`

### Common Issues

**"wm not found"**:

```bash
bun install && bun install:bin
# Or for development:
bun dev:cli
```

**Pattern not matching**:

- Check debug log for actual output
- Use `|` for alternatives: `"pattern1|pattern2"`
- Escape special regex chars: `\.` `\[` `\]`

**Fixture file issues**:

- Fixtures are created in a temp directory per run
- Check `$TEMP_DIR` path in debug log
- Fixtures are cleaned up after each category

## CI Integration

Add to `package.json`:

```json
{
  "scripts": {
    "test:cli": "./.claude/scripts/run-tests.sh --all"
  }
}
```

Run in CI:

```bash
bun install
bun install:bin
bun test:cli
```

## Test Assertion Patterns

### Success with Pattern Match

```bash
run_test 1 "Description" "wm command" "expected.*output" false
```

- Expects exit code 0
- Expects output to match pattern
- PASS if both conditions met
- WARN if exit 0 but pattern not found

### Expected Failure

```bash
run_test 2 "Description" "wm invalid-command" "error|invalid" true
```

- Expects non-zero exit code
- Expects output to match error pattern
- PASS if both conditions met
- FAIL if exit code is 0

### Multi-Command Workflow

```bash
run_test 3 "Workflow" "wm fmt file.ts --write && wm lint file.ts" "no issues" false
```

- Commands chained with `&&`
- Uses `eval` internally to handle complex commands
- Check both commands succeeded and final output matches
