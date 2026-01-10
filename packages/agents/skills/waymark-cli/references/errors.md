<!-- tldr ::: error handling patterns and recovery guidance -->

# Error Handling

Waymark errors follow a What/Why/How pattern. Use the exit code to determine
whether the issue is usage, config, or I/O related.

## Common Error Types

- Usage errors: invalid flags, missing arguments
- Config errors: bad YAML, missing config file
- I/O errors: file not found, permission denied

## Recovery Steps

1. Re-run with `--help` for usage errors.
2. Validate config with `wm config --print` or `wm doctor`.
3. Check file paths and permissions for I/O issues.

## Tips

- Use `--json` for programmatic workflows.
- In CI, prefer `--no-input` to fail fast.
