<!-- tldr ::: waymark audit workflows for coverage and quality verification -->

# Auditing Waymarks

Systematic verification of waymark coverage, quality, and accuracy across a codebase. Use these workflows when reviewing waymark health before releases, during code reviews, or for periodic maintenance.

## Pre-Merge Audit

Before merging any branch, verify no work-in-progress waymarks remain:

```bash
# Check for flagged waymarks (must be cleared before merge)
wm find --flagged --json

# Check for WIP markers
wm find --type wip --json
```

**Quality gate script:**

```bash
# Fail if any flagged waymarks exist
! wm find --flagged --json | jq -e 'length > 0' && echo "OK: No flagged waymarks"

# Fail if any WIP markers exist
! wm find --type wip --json | jq -e 'length > 0' && echo "OK: No WIP markers"
```

## Codebase Health Audit

Comprehensive waymark review across the repository.

### Review Starred Items

Check `*` waymarks for continued relevance:

```bash
wm find --starred --json
```

### Check Stale Work Markers

Review `todo`, `fix`, `wip` for age and validity:

```bash
# Get all work markers
wm find --type todo,fix,wip --json

# Count by type
echo "TODOs: $(wm find --type todo --json | jq 'length')"
echo "Fixes: $(wm find --type fix --json | jq 'length')"
```

### Validate Tag Consistency

List all unique tags to check for inconsistencies:

```bash
# List all waymarks and extract unique tags
wm find --json | jq -r '.[].tags[]?' | sort -u
```

### Check Canonical References

Verify `ref:#token` anchors are referenced:

```bash
# List all canonical anchors
wm find --json | jq -r '.[].properties.ref // empty' | sort -u

# Check for broken relations
wm find --graph --json | jq '.edges[] | select(.target | startswith("#"))'
```

## TLDR Coverage Audit

Verify every source file has a proper `tldr :::` waymark.

### Find Files with TLDRs

```bash
wm find --type tldr --json | jq -r '.[].file' | sort > has_tldr.txt
```

### Find Files Missing TLDRs

```bash
# List TypeScript files without TLDRs
git ls-files '*.ts' | sort > all_ts.txt
comm -23 all_ts.txt has_tldr.txt
```

### TLDR Quality Checks

For each TLDR found, verify:

| Check | Criteria |
| --- | --- |
| Presence | File has exactly one `tldr :::` waymark |
| Placement | TLDR is first waymark, after shebang/frontmatter |
| Quality | Sentence is 8-14 words, active voice, capability-first |
| Tags | Documentation files include `#docs` tag |
| Accuracy | Description matches current file purpose |

### Files That May Skip TLDRs

- Generated files (`*.generated.ts`)
- Type declaration files (`*.d.ts`)
- Index/barrel files with only re-exports
- Test fixtures and mocks

## Audit Checklist

Before completing an audit:

- [ ] All source files have TLDR waymarks
- [ ] TLDRs accurately describe file contents
- [ ] No flagged (`~`) waymarks remain (if auditing for merge)
- [ ] Starred (`*`) items reviewed for continued priority
- [ ] Work markers (todo, fix, wip) are current
- [ ] Tags follow established conventions
- [ ] Canonical references are valid

## Issue Templates

### Missing TLDR

```text
File: src/auth/service.ts
Issue: Missing TLDR waymark
Suggested: // tldr ::: handles user authentication and session management #auth
```

### Stale Todo

```text
File: src/payments/stripe.ts:45
Marker: // todo ::: implement retry logic
Issue: Todo exists since 2024-03-01 (>90 days)
Action: Complete, remove, or add timeline
```

### Inaccurate Description

```text
File: src/utils/format.ts:1
Marker: // tldr ::: date formatting utilities
Issue: File now includes number and currency formatting
Suggested: // tldr ::: formatting utilities for dates, numbers, and currency
```
