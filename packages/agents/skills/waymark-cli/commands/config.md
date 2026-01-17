---
name: config
kind: command
metadata:
  wm-cmd: config
---

<!-- tldr ::: command guide for wm config -->

# wm config

## Synopsis

Print the resolved Waymark configuration.

## Syntax

```text
wm config --print [options]
```

## Options

| Option | Short | Description | Default |
| --- | --- | --- | --- |
| `--print` |  | Print merged configuration | false |
| `--json` |  | Output compact JSON | false |
| `--scope <scope>` | `-s` | Config scope (project\|user\|default) | default |
| `--config <path>` |  | Load additional config file | none |

## Examples

```bash
wm config --print
wm --scope user config --print
wm --config ./custom.yaml config --print
wm config --print --json
```

## Notes

- `wm config` requires `--print`; it does not write configuration files.
- Use `wm init` to create a default config file.

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Errors occurred |
| 2 | Usage error |
| 3 | Config error |
| 4 | I/O error |
