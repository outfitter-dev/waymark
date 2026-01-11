---
name: skill
kind: command
metadata:
  wm-cmd: skill
---

<!-- tldr ::: command guide for wm skill -->

# wm skill

## Synopsis

Show agent-facing documentation for Waymark CLI skills.

## Syntax

```text
wm skill [options]
wm skill show <section> [options]
wm skill list
wm skill path
```

## Options

| Option | Short | Description | Default |
| --- | --- | --- | --- |
| `--json` |  | Output structured JSON | false |

## Examples

```bash
wm skill
wm skill show add
wm skill show schemas
wm skill show workflows --json
wm skill list
wm skill path
```

## Notes

- Section names map to files in `commands/`, `references/`, or `examples/`.
- Use `wm skill show core` or `wm skill show skill` for `SKILL.md`.
- Override the skill directory with `WAYMARK_SKILL_DIR`.

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 2 | Usage error |
| 4 | I/O error |
