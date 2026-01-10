<!-- tldr ::: command guide for wm find -->

# wm find

## Synopsis

Scan and filter waymarks across files or directories.

## Syntax

```text
wm find [paths...] [options]
wm [paths...] [options]            # default command
```

## Arguments

| Argument | Required | Description |
| --- | --- | --- |
| `paths...` | No | Files or directories to scan (defaults to cwd) |

## Options

| Option | Short | Description | Default |
| --- | --- | --- | --- |
| `--type <types...>` | `-t` | Filter by marker type(s) | all |
| `--tag <tags...>` |  | Filter by tags | all |
| `--mention <mentions...>` |  | Filter by mentions | all |
| `--flagged` | `-F` | Only flagged waymarks | false |
| `--starred` | `-S` | Only starred waymarks | false |
| `--graph` |  | Output relation graph | false |
| `--long` |  | Detailed record output | false |
| `--tree` |  | Group output by directory | false |
| `--flat` |  | Flat output list | true |
| `--compact` |  | Compact output | false |
| `--context <n>` | `-C` | Show N context lines | 0 |
| `--after <n>` | `-A` | Show N lines after | 0 |
| `--before <n>` | `-B` | Show N lines before | 0 |
| `--limit <n>` | `-n` | Limit results | none |
| `--page <n>` |  | Page results | 1 |
| `--json` |  | JSON array output | false |
| `--jsonl` |  | JSON lines output | false |
| `--text` |  | Human readable output | true |
| `--pretty` |  | Pretty JSON output | false |

## Output Formats

| Flag | Format | Use Case |
| --- | --- | --- |
| default | Human text | Terminal viewing |
| `--json` | JSON array | Programmatic parsing |
| `--jsonl` | JSON lines | Streaming |
| `--graph` | Graph edges | Dependency analysis |

## Examples

```bash
wm find src/ --type todo --json
wm find --graph --json > graph.json
wm --flagged --mention @agent
```

## Configuration

Scan behavior respects `.waymark/config.*`:

```toml
[scan]
include_codetags = true
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
| Unknown flag | Invalid option | Check `--help` |
| Config parse error | Invalid config | Fix `.waymark/config.*` |

## See Also

- `wm lint` - validate waymarks
- `wm fmt` - normalize formatting
- `wm skill show schemas`
