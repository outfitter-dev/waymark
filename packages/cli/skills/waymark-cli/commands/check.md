---
name: check
kind: command
metadata:
  wm-cmd: check
---

<!-- tldr ::: command guide for wm check -->

# wm check

## Synopsis

Validate cross-file content integrity for waymarks.

## Syntax

```text
wm check [paths...] [options]
```

## Options

| Option | Description | Default |
| --- | --- | --- |
| `--strict` | CI mode (fail on warnings) | false |
| `--fix` | Auto-repair safe issues (not yet implemented) | false |
| `--json` | Output as JSON | false |

## Integrity Checks

| Rule | Severity | Description |
| --- | --- | --- |
| `duplicate-canonical` | error | Same `ref:#token` defined in multiple files |
| `dangling-relation` | error | Relation pointing to non-existent canonical |
| `multiple-tldr` | error | Multiple TLDRs in same file |
| `tldr-position` | warning | TLDR not near top of file (first 20 lines) |
| `flagged-signal` | warning | Flagged (`~`) waymark should be cleared before merge |
| `file-read-error` | error | Unable to read file (permissions, not found) |
| `parse-error` | error | Failed to parse waymarks in file |

## Examples

```bash
wm check                      # Check current directory
wm check src/                 # Check specific directory
wm check --strict             # CI mode (fail on warnings)
wm check --json               # JSON output for tooling
wm check src/ tests/ --strict # Check multiple directories in CI
```

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | No errors (warnings only if not --strict) |
| 1 | Errors found or warnings in --strict mode |
| 2 | Usage error |

## Command Model

The `check` command is part of a three-tier validation model:

| Command | Purpose |
| --- | --- |
| `wm lint` | Per-file structural validation |
| `wm check` | Cross-file content integrity |
| `wm doctor` | Tool/environment health |

## See Also

- `wm lint` - per-file structural validation
- `wm doctor` - tool and environment health
- `wm find --flagged` - find flagged waymarks
