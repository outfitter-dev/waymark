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
| `<content>` | Yes* | Content text (use `-` to read stdin) |

## Options

| Option | Short | Description | Default |
| --- | --- | --- | --- |
| `--from <file>` |  | Read JSON/JSONL input (use `-` for stdin) | none |
| `--mention <actor>` |  | Add mention(s) | none |
| `--tag <tag>` |  | Add tag(s) | none |
| `--property <kv>` |  | Add property key:value | none |
| `--ref <token>` |  | Set canonical reference | none |
| `--source <token>` |  | Add dependency relation | none |
| `--see <token>` |  | Add reference relation | none |
| `--replaces <token>` |  | Add replaces relation | none |
| `--signal <~\|*>` |  | Add flagged/starred signals | none |
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
