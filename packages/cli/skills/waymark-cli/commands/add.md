---
name: add
kind: command
metadata:
  wm-cmd: add
---

<!-- tldr ::: command guide for wm add -->

# wm add

## Synopsis

Insert waymarks into files with optional JSON input and automatic formatting.

## Syntax

```text
wm add <file:line> <type> <content> [options]
wm add --from <json-file>
```

## Arguments

| Argument | Required | Description |
| --- | --- | --- |
| `<file:line>` | Yes* | Target location (required unless `--from`) |
| `<type>` | Yes* | Waymark type (todo, fix, note, tldr, etc.) |
| `<content>` | Yes* | Content text |

## Options

| Option | Short | Description | Default |
| --- | --- | --- | --- |
| `--from <file>` |  | Read JSON/JSONL input (use `-` for stdin) | none |
| `--type <type>` |  | Set type when not provided positionally | none |
| `--content <text>` |  | Set content when not provided positionally | none |
| `--position <before\|after>` |  | Insert relative to the line | none |
| `--before` |  | Shorthand for `--position before` | false |
| `--after` |  | Shorthand for `--position after` | false |
| `--mention <actor>` |  | Add mention(s) | none |
| `--tag <tag>` |  | Add tag(s) | none |
| `--property <kv>` |  | Add property key:value | none |
| `--continuation <text>` |  | Add continuation line | none |
| `--flagged` | `-F` | Add flagged signal | false |
| `--starred` |  | Add starred signal | false |
| `--order <n>` |  | Insertion order (batch) | none |
| `--id <id>` |  | Reserve specific ID | none |
| `--write` | `-w` | Apply changes (default preview) | false |
| `--json` |  | JSON array output | false |
| `--jsonl` |  | JSON lines output | false |

## Input Modes

- Inline arguments: `wm add src/a.ts:10 todo "add tests"`
- JSON file: `wm add --from waymarks.json`
- JSONL stdin: `cat waymarks.jsonl | wm add --from -`

## Output Formats

| Flag | Format | Use Case |
| --- | --- | --- |
| default | Human text | Terminal viewing |
| `--json` | JSON array | Programmatic parsing |
| `--jsonl` | JSON lines | Streaming |

## Examples

```bash
wm add src/auth.ts:42 todo "implement OAuth" --mention @agent --tag "#sec"
wm add src/db.ts:1 tldr "database helpers" --write
cat waymarks.jsonl | wm add --from - --json
```

## Configuration

```toml
[ids]
mode = "auto"
length = 7

[format]
normalizeCase = true
alignContinuations = true
```

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Errors occurred |
| 2 | Usage error |
| 3 | Config error |
| 4 | I/O error |

## Common Errors

| Error | Cause | Fix |
| --- | --- | --- |
| Invalid JSON | Malformed input | Validate JSON before piping |
| Unknown type | Marker not allowed | Update `allowTypes` config |
| File not found | Bad path | Check file path |

## See Also

- `wm find` - verify inserted waymarks
- `wm skill show schemas`
