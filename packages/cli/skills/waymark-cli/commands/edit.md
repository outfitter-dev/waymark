---
name: edit
kind: command
metadata:
  wm-cmd: edit
---

<!-- tldr ::: command guide for wm edit -->

# wm edit

## Synopsis

Edit an existing waymark by location or ID. Preview by default; apply with `--write`.

## Syntax

```text
wm edit [target] [options]
```

## Arguments

| Argument | Required | Description |
| --- | --- | --- |
| `target` | No | Waymark location `file:line` (or use `--id`) |

## Options

| Option | Short | Description | Default |
| --- | --- | --- | --- |
| `--id <id>` |  | Target by ID (`[[abc123]]`) | none |
| `--type <marker>` |  | Change marker type | none |
| `--content <text>` |  | Replace content (`-` reads stdin) | none |
| `--flagged` | `-F` | Add flagged signal | false |
| `--starred` |  | Add starred signal | false |
| `--clear-signals` |  | Remove all signals | false |
| `--write` | `-w` | Apply changes | false |
| `--no-interactive` |  | Skip prompts when no target | false |
| `--json` |  | JSON array output | false |
| `--jsonl` |  | JSON lines output | false |

## Examples

```bash
wm edit src/auth.ts:42 --type fix
wm edit --id [[a3k9m2p]] --clear-signals --write
printf "validate JWT" | wm edit src/auth.ts:42 --content - --write
wm edit --no-interactive
```

## Notes

- Provide either `file:line` or `--id`.
- When no target is provided, interactive mode runs unless `--no-interactive`.

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Errors occurred |
| 2 | Usage error |
| 3 | Config error |
| 4 | I/O error |

## See Also

- `wm find` - locate waymarks
- `wm rm` - remove waymarks
