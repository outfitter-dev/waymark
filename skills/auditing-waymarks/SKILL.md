---
name: Auditing Waymarks
description: This skill should be used when the user asks to "audit waymarks", "check waymark coverage", "verify tldrs", "find missing waymarks", "validate waymark quality", or needs to systematically review waymark completeness and accuracy across files or the entire repository.
version: 0.1.0
---

# Auditing Waymarks

Systematic verification of waymark coverage, quality, and accuracy across a codebase. Use this skill when reviewing waymark health before releases, during code reviews, or for periodic maintenance.

## Audit Types

### TLDR Audit (`--tldr`)

Verify every source file has a proper `tldr :::` waymark:

**Checks performed:**

1. **Presence**: File has exactly one `tldr :::` waymark
2. **Placement**: TLDR is first waymark, after shebang/frontmatter
3. **Quality**: Sentence is 8-14 words, active voice, capability-first
4. **Tags**: Documentation files include `#docs` tag
5. **Accuracy**: Description matches current file purpose

**Quick check with ripgrep:**

```bash
# Files with TLDRs
rg -l 'tldr\s*:::'

# Files without TLDRs (compare against source files)
comm -23 \
  <(git ls-files '*.ts' '*.tsx' '*.js' '*.jsx' | sort) \
  <(rg -l 'tldr\s*:::' -t ts -t js | sort)
```

**With CLI:**

```bash
wm find --type tldr --json | jq -r '.[].file' | sort > has_tldr.txt
git ls-files '*.ts' | sort > all_ts.txt
comm -23 all_ts.txt has_tldr.txt
```

### Full Audit (`--all`)

Comprehensive waymark review across the repository:

**Checks performed:**

1. All TLDR audit checks
2. **Starred items**: Review `*` waymarks for continued relevance
3. **Stale markers**: Check `todo`, `fix`, `wip` for age/validity
4. **Orphaned references**: Verify `ref:#token` anchors are referenced
5. **Broken relations**: Validate `depends:#`, `needs:#` targets exist
6. **Tag consistency**: Ensure tags follow established conventions
7. **Accuracy**: Spot-check waymark descriptions match code behavior

### Path-Scoped Audit

Audit specific directories or files:

```bash
# Audit single directory
wm find src/auth/ --json

# Audit specific file
wm find src/auth/service.ts
```

## Audit Workflow

### 1. Gather Inventory

```bash
# Get all waymarks as JSON for analysis
wm find . --json > waymarks.json

# Or with ripgrep
rg ':::' --json > waymarks.jsonl
```

### 2. Check Coverage

**Source files needing TLDRs:**

- All `.ts`, `.tsx`, `.js`, `.jsx` files
- All `.py` files
- Configuration files (`*.config.*`)
- Entry points and main modules

**Files that may skip TLDRs:**

- Generated files (`*.generated.ts`)
- Type declaration files (`*.d.ts`)
- Index/barrel files with only re-exports
- Test fixtures and mocks

### 3. Validate Quality

For each waymark found, verify:

| Marker | Quality Check |
|--------|---------------|
| `tldr` | Active voice, 8-14 words, matches file purpose |
| `this` | Describes following section accurately |
| `todo` | Still relevant, not stale |
| `fix` | Bug still exists, not already fixed |
| `note` | Information still accurate |
| `warn` | Constraint still applies |
| `deprecated` | Timeline for removal defined |

### 4. Check Consistency

**Tag audit:**

```bash
# List all unique tags
rg ':::.+#\w+' -o | grep -oE '#[A-Za-z0-9._/:%-]+' | sort -u

# Check for similar but inconsistent tags
# (e.g., #perf vs #performance, #doc vs #docs)
```

**Canonical reference audit:**

```bash
# List all canonical anchors
rg 'ref:#[A-Za-z0-9._/:%-]+' -o | sort -u

# Find references to canonicals
rg '(depends|needs|blocks|rel):#'
```

### 5. Report Findings

Categorize issues by severity:

**Critical** (must fix):

- Missing TLDRs on important files
- Inaccurate waymark descriptions
- Broken canonical references

**Warning** (should fix):

- Stale todos/fixes older than 30 days
- Inconsistent tag usage
- Starred items that should be demoted

**Info** (consider):

- Files that could benefit from `this :::` markers
- Opportunities for canonical references
- Tag namespace consolidation

## Audit Commands

### Using CLI

```bash
# Full scan
wm find . --json

# TLDRs only
wm find . --type tldr

# Starred (priority) items
wm find . --starred

# By specific tag
wm find . --tag '#perf'
```

### Using Ripgrep

```bash
# All waymarks with context
rg ':::' -A 2 -B 1

# Count by marker type
echo "TODOs: $(rg -c 'todo\s*:::' | awk -F: '{sum+=$2}END{print sum}')"
echo "Fixes: $(rg -c 'fix\s*:::' | awk -F: '{sum+=$2}END{print sum}')"
echo "TLDRs: $(rg -c 'tldr\s*:::' | awk -F: '{sum+=$2}END{print sum}')"
```

## Spawning Audit Scouts

For large codebases, parallelize auditing:

1. **Partition by directory**: Assign scouts to different top-level directories
2. **Partition by type**: One scout for TLDRs, another for todos/fixes
3. **Consolidate findings**: Merge reports from all scouts

Scout configuration:

- **Conservative mode**: Only report definite issues
- **Thorough mode**: Flag potential improvements too
- **Fix mode**: Propose corrections for issues found

## Quality Gates

### Pre-commit

```bash
# Check staged files have TLDRs
git diff --cached --name-only | xargs -I{} sh -c \
  'rg -l "tldr\s*:::" {} || echo "Missing TLDR: {}"'
```

### Pre-merge

```bash
# No raised waymarks
! rg '\^\w+\s*:::' && echo "OK: No raised waymarks"

# No WIP markers
! rg 'wip\s*:::' && echo "OK: No WIP markers"
```

### Periodic (weekly/monthly)

- Full `--all` audit
- Review starred items
- Check for stale work markers
- Validate canonical reference graph

## Issue Templates

### Missing TLDR

```
File: src/auth/service.ts
Issue: Missing TLDR waymark
Suggested: // tldr ::: handles user authentication and session management #auth
```

### Stale Todo

```
File: src/payments/stripe.ts:45
Marker: // todo ::: implement retry logic
Issue: Todo exists since 2024-03-01 (>90 days)
Action: Complete, remove, or add timeline
```

### Inaccurate Description

```
File: src/utils/format.ts:1
Marker: // tldr ::: date formatting utilities
Issue: File now includes number and currency formatting
Suggested: // tldr ::: formatting utilities for dates, numbers, and currency
```

## Checklist

Before completing an audit:

- [ ] All source files have TLDR waymarks
- [ ] TLDRs accurately describe file contents
- [ ] No raised (`^`) waymarks remain (if auditing for merge)
- [ ] Starred (`*`) items reviewed for continued priority
- [ ] Work markers (todo, fix, wip) are current
- [ ] Tags follow established conventions
- [ ] Canonical references are valid

## Related Skills

- **`waymark-authoring`** - How to write waymarks
- **`waymark-tldrs`** - TLDR-specific patterns
- **`ripgrep-waymarks`** - Search patterns without CLI
