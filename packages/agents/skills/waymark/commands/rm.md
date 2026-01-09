<!-- tldr ::: command guide for wm rm -->

# wm rm

## Synopsis

Remove waymarks by location, ID, or filters. Preview by default.

## Syntax

```text
wm rm <file:line> [options]
wm rm --id <id> [options]
wm rm --from <json-file> [options]
wm rm --type <type> --file <path> [options]
```

## Options

| Option | Short | Description | Default |
| --- | --- | --- | --- |
| `--id <id>` |  | Remove by ID | none |
| `--from <file>` |  | Read JSON input (use `-` for stdin) | none |
| `--type <type>` |  | Filter by type | none |
| `--mention <mention>` |  | Filter by mention | none |
| `--tag <tag>` |  | Filter by tag | none |
| `--property <kv>` |  | Filter by property | none |
| `--file <path>` |  | Filter by file path | none |
| `--content-pattern <regex>` |  | Filter by content regex | none |
| `--contains <text>` |  | Filter by content substring | none |
| `--flagged` | `-F` | Filter flagged | false |
| `--starred` | `-S` | Filter starred | false |
| `--reason <text>` |  | Record removal reason | none |
| `--write` | `-w` | Apply removal | false |
| `--json` |  | JSON array output | false |
| `--jsonl` |  | JSON lines output | false |

## Examples

```bash
wm rm src/auth.ts:42
wm rm src/auth.ts:42 --write --reason "cleanup"
wm rm --id [[a3k9m2p]] --write
wm rm --type done --file src/ --write
cat removals.json | wm rm --from - --write --json
```

## Safety Model

- Preview by default; add `--write` to apply.
- Removals update `.waymark/history.json` when tracking is enabled.

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
| No matches | Filter too narrow | Broaden filters |
| Unknown ID | Not in index | Verify ID exists |
| File not found | Bad path | Check file path |

## See Also

- `wm find` - locate targets
- `wm edit` - adjust waymarks without removing
