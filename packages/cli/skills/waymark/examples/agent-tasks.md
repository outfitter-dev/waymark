<!-- tldr ::: common agent task patterns using waymarks -->

# Agent Tasks

## Add TLDRs for New Files

```bash
wm add src/new.ts:1 tldr "summary of file" --write
```

## Mark In-Progress Work

```bash
wm edit src/auth.ts:42 --flagged --write
```

## Annotate Performance Hotspots

```bash
wm add src/query.ts:120 note "perf hotspot" --tag "#perf" --write
```
