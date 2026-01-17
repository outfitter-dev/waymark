<!-- tldr ::: comprehensive ripgrep patterns for waymark discovery -->

# Ripgrep Waymark Patterns

Search for waymarks using ripgrep when the `wm` CLI is unavailable. These patterns work with `rg` (ripgrep) or standard `grep -E`.

## Quick Patterns

### All Waymarks

```bash
rg ':::'
```

### By Marker Type

```bash
# TODOs
rg 'todo\s*:::'

# Fixes
rg 'fix\s*:::'

# TLDRs (file summaries)
rg 'tldr\s*:::'

# Section summaries
rg 'about\s*:::'

# Notes
rg 'note\s*:::'

# Warnings
rg 'warn\s*:::'

# Work in progress
rg 'wip\s*:::'

# Questions
rg 'question\s*:::'
```

### By Signal

```bash
# Starred (high-priority)
rg '\*\w+\s*:::'

# Flagged (in-progress)
rg '~\w+\s*:::'

# Both signals combined
rg '~\*\w+\s*:::'

# Any marker with star
rg '\*(todo|fix|note|warn)\s*:::'
```

### By Mention

```bash
# @agent assignments
rg ':::\s*@agent'

# Any mention
rg ':::\s*@[a-z]\w*'

# Specific person
rg ':::\s*@alice'
```

### By Tag

```bash
# Performance tags
rg ':::.+#perf'

# Security tags
rg ':::.+#sec'

# Documentation tags
rg ':::.+#docs'

# Any tag
rg ':::.+#\w+'
```

## Advanced Patterns

### Combined Filters

```bash
# Starred TODOs
rg '\*todo\s*:::'

# Flagged TODOs (in-progress)
rg '~todo\s*:::'

# TODOs with @agent
rg 'todo\s*:::.*@agent'

# Security-related TODOs
rg 'todo\s*:::.*#sec'

# High-priority fixes
rg '\*fix\s*:::'
```

### Documentation TLDRs

```bash
# All doc TLDRs
rg 'tldr\s*:::.*#docs' -g '*.md'

# Guide docs
rg 'tldr\s*:::.*#docs/guide'

# In HTML comments
rg '<!--\s*tldr\s*:::' -g '*.md'
```

### Canonical References

```bash
# Find canonical anchors
rg ':::.+ref:#'

# Find specific anchor
rg 'ref:#payments/stripe'

# Find references to anchor
rg '(see|from|docs|replaces):#payments'
```

## Pre-merge Audit

**Critical patterns to check before merging:**

```bash
# Flagged items (MUST clear before merge)
rg '~\w+\s*:::'

# Starred items (should address before merge)
rg '\*\w+\s*:::' && echo "Has starred items!"

# Work-in-progress markers
rg 'wip\s*:::' && echo "Has WIP markers!"

# Temporary code
rg '(temp|tmp|hack)\s*:::' && echo "Has temporary code!"
```

## Context and Output

### Multi-line Context

```bash
# Show 2 lines after each match
rg ':::' -A 2

# Show 2 lines before and after
rg ':::' -C 2

# Show file and line numbers
rg -n ':::'

# Show only file names
rg -l ':::'
```

### Output Formats

```bash
# Machine-readable JSON
rg ':::' --json

# Vimgrep format (file:line:col:text)
rg ':::' --vimgrep
```

## File Type Filters

```bash
# TypeScript/JavaScript only
rg ':::' -t ts -t js

# Python only
rg ':::' -t py

# Markdown only
rg ':::' -t md

# Exclude tests
rg ':::' -g '!*test*' -g '!*spec*'

# Source only (exclude node_modules, etc.)
rg ':::' -g '!node_modules' -g '!dist' -g '!.git'
```

## Counting and Reports

```bash
# Count waymarks per file
rg -c ':::'

# Total count
rg ':::' | wc -l

# Count by marker type
rg -c 'todo\s*:::' --sort path
rg -c 'fix\s*:::' --sort path
```

### Generate Summary Report

```bash
echo "=== Waymark Summary ==="
echo "TODOs:    $(rg -c 'todo\s*:::' | awk -F: '{sum+=$2}END{print sum+0}')"
echo "Fixes:    $(rg -c 'fix\s*:::' | awk -F: '{sum+=$2}END{print sum+0}')"
echo "Notes:    $(rg -c 'note\s*:::' | awk -F: '{sum+=$2}END{print sum+0}')"
echo "TLDRs:    $(rg -c 'tldr\s*:::' | awk -F: '{sum+=$2}END{print sum+0}')"
echo "Flagged:  $(rg -c '~\w+\s*:::' | awk -F: '{sum+=$2}END{print sum+0}')"
echo "Starred:  $(rg -c '\*\w+\s*:::' | awk -F: '{sum+=$2}END{print sum+0}')"
```

## Common Tasks

### Find Work Items

```bash
# All actionable items (todos, fixes, wip)
rg '(todo|fix|wip)\s*:::'

# Assigned to anyone
rg '(todo|fix)\s*:::.*@[a-z]\w*'

# Unassigned todos
rg 'todo\s*:::' | rg -v '@[a-z]\w*'
```

### Check TLDR Coverage

```bash
# List files without tldr (TypeScript)
comm -23 \
  <(git ls-files '*.ts' | sort) \
  <(rg -l 'tldr\s*:::' -t ts | sort)
```

### Find by Priority

```bash
# High priority (starred)
rg '\*\w+\s*:::'

# With priority property
rg ':::.*priority:(high|critical)'
```

## Pattern Reference

| Purpose | Pattern |
|---------|---------|
| All waymarks | `:::` |
| Specific marker | `marker\s*:::` |
| Starred | `\*\w+\s*:::` |
| Flagged | `~\w+\s*:::` |
| Both signals | `~\*\w+\s*:::` |
| Mentions | `:::\s*@[a-z]\w*` |
| Tags | `:::.+#\w+` |
| Canonicals | `ref:#\w+` |
| Relations | `(see\|from\|docs\|replaces):#` |

## Grep vs Ripgrep

These patterns work with both `rg` and `grep -E`:

```bash
# Ripgrep (faster)
rg 'todo\s*:::'

# Grep (portable)
grep -rE 'todo\s*:::' .
```

**Ripgrep advantages:**

- Faster on large codebases
- Respects `.gitignore` by default
- Better default behavior
- Built-in file type filters

## When to Use

Use ripgrep patterns when:

- `wm` CLI is not installed
- Working in environment without waymark tooling
- Need quick one-off searches
- Integrating with shell scripts
- CI/CD pipeline checks

For richer features (formatting, graph, IDs, lint), install the `wm` CLI.
