---
name: help
kind: command
metadata:
  wm-cmd: help
---

<!-- tldr ::: command guide for wm help -->

# wm help

## Synopsis

Show help for a command or documentation topic.

## Syntax

```text
wm help [command|topic]
```

## Arguments

| Argument | Required | Description |
| --- | --- | --- |
| `command\|topic` | No | Command name or help topic to display |

## Examples

```bash
wm help
wm help add
wm help syntax
wm help tags
```

## Notes

- Use `wm <command> --help` for full command options.
- If a topic is unknown, `wm help` prints available topics.

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 2 | Usage error |
