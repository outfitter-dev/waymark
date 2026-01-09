<!-- tldr ::: integration examples for MCP and CI -->

# Integration

## MCP Server

```bash
waymark-mcp
```

## CI Gate for Flagged Waymarks

```bash
count=$(wm find --flagged --json | jq 'length')
if [ "$count" -gt 0 ]; then
  echo "Flagged waymarks must be cleared before merge"
  exit 1
fi
```

## Lint in CI

```bash
wm lint src/ --json > lint.json
```
