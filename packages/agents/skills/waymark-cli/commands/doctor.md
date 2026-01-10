<!-- tldr ::: command guide for wm doctor -->

# wm doctor

## Synopsis

Run diagnostics on configuration, cache, and waymark integrity.

## Syntax

```text
wm doctor [paths...] [options]
```

## Options

| Option | Short | Description | Default |
| --- | --- | --- | --- |
| `--strict` |  | Treat warnings as failures | false |
| `--fix` |  | Attempt safe repairs | false |
| `--json` |  | JSON report output | false |

## Examples

```bash
wm doctor
wm doctor src/ --strict
wm doctor --json
```

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Healthy (or warnings without --strict) |
| 1 | Issues found |
| 2 | Usage error |
| 3 | Config error |
| 4 | I/O error |

## See Also

- `wm lint` - lint waymarks
- `wm config --print` - view config
