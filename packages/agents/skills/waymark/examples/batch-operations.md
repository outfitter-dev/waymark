<!-- tldr ::: batch insert/remove workflows for waymark CLI -->

# Batch Operations

## Batch Insert from JSONL

```bash
cat waymarks.jsonl | wm add --from - --json
```

## Batch Remove from JSON

```bash
cat removals.json | wm rm --from - --write --json
```

## Generate and Insert Waymarks

```bash
python scripts/generate_waymarks.py | wm add --from - --json
```
