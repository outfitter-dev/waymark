---
name: seed
kind: command
metadata:
  wm-cmd: seed
---

<!-- tldr ::: command guide for wm seed -->

# wm seed

## Synopsis

Auto-generate TLDR waymarks from module-level docstrings.

## Syntax

```text
wm seed [paths...] [options]
```

## Arguments

| Argument | Required | Description |
| --- | --- | --- |
| `[paths...]` | No | Files or directories to seed (defaults to cwd) |

## Options

| Option | Short | Description | Default |
| --- | --- | --- | --- |
| `--write` | `-w` | Apply changes (default preview) | false |
| `--json` |  | JSON array output | false |
| `--jsonl` |  | JSON lines output | false |

## Behavior

1. Scans files for module-level docstrings (JSDoc, Python, etc.)
2. Extracts summary text (first sentence or paragraph)
3. Generates `tldr ::: <summary>` waymark
4. Inserts at appropriate location (after shebang, directives)
5. Skips files that already have a TLDR waymark
6. Skips files without detectable docstrings

## Supported Languages

| Language | Docstring Format |
| --- | --- |
| TypeScript/JavaScript | `/** ... */` (JSDoc) |
| Python | `""" ... """` (module docstring) |

## Output Formats

| Flag | Format | Use Case |
| --- | --- | --- |
| default | Human text | Terminal viewing |
| `--json` | JSON array | Programmatic parsing |
| `--jsonl` | JSON lines | Streaming |

## Examples

```bash
# Preview what would be inserted
wm seed src/

# Apply TLDR insertions
wm seed src/ --write

# Seed a single file
wm seed src/auth.ts --write

# JSON output for tooling
wm seed src/ --json

# Seed entire project
wm seed . --write
```

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Errors occurred |
| 2 | Usage error |
| 3 | Config error |
| 4 | I/O error |

## Use Cases

- **Onboarding**: Quickly document a codebase for new developers
- **Agent context**: Give AI agents file-level summaries
- **Documentation audit**: Find files missing TLDRs

## See Also

- `wm find --type tldr` - find existing TLDRs
- `wm add <file:line> tldr "..."` - manually add a TLDR
