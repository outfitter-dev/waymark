---
name: fmt
kind: command
metadata:
  wm-cmd: fmt
---

<!-- tldr ::: command guide for wm fmt -->

# wm fmt

## Synopsis

Format waymarks in files to match configured style rules.

## Syntax

```text
wm fmt <paths...> [options]
```

## Arguments

| Argument | Required | Description |
| --- | --- | --- |
| `paths...` | Yes | Files or directories to format |

## Options

| Option | Short | Description | Default |
| --- | --- | --- | --- |
| `--write` | `-w` | Apply changes to files | false |

## Examples

```bash
wm fmt src/                 # Preview formatted output
wm fmt src/ --write          # Apply formatting
wm fmt src/file.ts -w        # Short form
```

## Notes

- `wm fmt` only touches files containing `:::` waymarks.
- When `--write` is set, the CLI prompts before writing.

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Errors occurred |
| 2 | Usage error |
| 3 | Config error |
| 4 | I/O error |

## See Also

- `wm lint` - validate structure
- `wm find` - scan for waymarks
