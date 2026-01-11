---
name: update
kind: command
metadata:
  wm-cmd: update
---

<!-- tldr ::: command guide for wm update -->

# wm update

## Synopsis

Update the globally installed Waymark CLI.

## Syntax

```text
wm update [options]
```

## Options

| Option | Short | Description | Default |
| --- | --- | --- | --- |
| `--dry-run` | `-n` | Print the update command without running | false |
| `--force` | `-f` | Run even if install method is unknown | false |
| `--yes` | `-y` | Skip the confirmation prompt | false |
| `--command <command>` |  | Override update command (npm\|pnpm\|bun\|yarn) | npm |

## Examples

```bash
wm update
wm update --yes
wm update --dry-run
wm update --command pnpm --force
```

## Notes

- `wm update` targets npm global installs by default.
- Workspace installs require `--force` to run.

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Errors occurred |
