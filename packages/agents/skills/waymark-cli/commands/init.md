<!-- tldr ::: command guide for wm init -->

# wm init

## Synopsis

Create a waymark configuration file interactively or via flags.

## Syntax

```text
wm init [options]
```

## Options

| Option | Short | Description | Default |
| --- | --- | --- | --- |
| `--format <format>` | `-f` | Config format (toml\|jsonc\|yaml\|yml) | toml |
| `--preset <preset>` | `-p` | Preset (full\|minimal) | full |
| `--scope <scope>` | `-s` | Scope (project\|user) | project |
| `--force` |  | Overwrite existing config | false |

## Examples

```bash
wm init
wm init --format toml --scope project
wm init --preset minimal --force
```

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Errors occurred |
| 2 | Usage error |
| 3 | Config error |
| 4 | I/O error |

## See Also

- `wm config --print` - inspect merged config
- `wm doctor` - validate config
