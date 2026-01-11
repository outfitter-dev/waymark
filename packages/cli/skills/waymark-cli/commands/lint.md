---
name: lint
kind: command
metadata:
  wm-cmd: lint
---

<!-- tldr ::: command guide for wm lint -->

# wm lint

## Synopsis

Validate waymark structure and marker rules.

## Syntax

```text
wm lint <paths...> [options]
```

## Arguments

| Argument | Required | Description |
| --- | --- | --- |
| `paths...` | Yes | Files or directories to lint |

## Options

| Option | Short | Description | Default |
| --- | --- | --- | --- |
| `--json` |  | JSON array output | false |

## Examples

```bash
wm lint src/ --json
wm lint src/auth.ts
```

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | No lint errors |
| 1 | Lint errors found |
| 2 | Usage error |
| 3 | Config error |
| 4 | I/O error |

## Common Errors

| Error | Cause | Fix |
| --- | --- | --- |
| Unknown marker | Not in blessed list | Add to config allowTypes |
| Duplicate property | Same key repeated | Remove duplicates |

## See Also

- `wm fmt` - normalize formatting
- `wm find` - scan and filter
