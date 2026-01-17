---
name: doctor
kind: command
metadata:
  wm-cmd: doctor
---

<!-- tldr ::: command guide for wm doctor -->

# wm doctor

## Synopsis

Run diagnostics on tool installation, configuration, and environment health.

## Syntax

```text
wm doctor [options]
```

## Options

| Option | Description | Default |
| --- | --- | --- |
| `--strict` | Treat warnings as failures | false |
| `--fix` | Attempt safe repairs | false |
| `--json` | JSON report output | false |

## Health Checks

| Check | Description |
| --- | --- |
| Configuration validity | Config file syntax and value ranges |
| Cache directory | Cache directory writability |
| Index file integrity | Index file health and consistency |
| Git repository | Git repository detection |
| Ignore patterns | Ignore pattern validation |
| Performance | Performance diagnostics |

## Examples

```bash
wm doctor              # Run all health checks
wm doctor --strict     # Fail on warnings
wm doctor --json       # JSON output for tooling
wm doctor --fix        # Attempt safe repairs
```

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Healthy (or warnings without --strict) |
| 1 | Issues found |
| 2 | Usage error |
| 3 | Config error |
| 4 | I/O error |

## Command Model

The `doctor` command focuses on tool/environment health. For content validation, use other commands:

| Command | Purpose |
| --- | --- |
| `wm lint` | Per-file structural validation |
| `wm check` | Cross-file content integrity |
| `wm doctor` | Tool/environment health |

## See Also

- `wm check` - cross-file content integrity
- `wm lint` - per-file structural validation
- `wm config --print` - view merged config
