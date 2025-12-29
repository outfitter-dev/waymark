---
name: Ripgrep Waymarks
description: This skill should be used when the user asks to "find waymarks with grep", "search waymarks without CLI", "ripgrep waymark patterns", or when the `wm` CLI tool is not available and waymarks need to be searched using ripgrep (rg) or grep. Provides grep patterns for waymark discovery.
version: 0.1.0
---

# Ripgrep Waymarks

Search for waymarks using ripgrep when the `wm` CLI is unavailable. These patterns work with `rg` (ripgrep) or standard `grep`.

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
rg 'this\s*:::'

# Notes
rg 'note\s*:::'

# Warnings
rg 'warn\s*:::'
```

### By Signal

```bash
# Starred (high-priority)
rg '\*\w+\s*:::'

# Any marker with star
rg '\*(todo|fix|note|warn)\s*:::'
```

### By Mention

```bash
# @agent assignments
rg ':::\s*@agent'

# Any mention
rg ':::\s*@\w+'

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
rg '(depends|needs|fixes|blocks|rel):#payments'
```

### Multi-line Context

```bash
# Show 2 lines after each match
rg ':::'  -A 2

# Show file and line numbers
rg -n ':::'

# Show only file names
rg -l ':::'
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

## Output Formats

### JSON-like Output

```bash
# Machine-readable with file, line, content
rg ':::' --json

# Vimgrep format (file:line:col:text)
rg ':::' --vimgrep
```

### Counting

```bash
# Count waymarks per file
rg -c ':::'

# Total count
rg ':::' | wc -l

# Count by marker type
rg -c 'todo\s*:::' --sort path
```

## Common Tasks

### Check for Missing TLDRs

```bash
# List files without tldr
comm -23 \
  <(git ls-files '*.ts' '*.js' | sort) \
  <(rg -l 'tldr\s*:::' -t ts -t js | sort)
```

### Find Work Items

```bash
# All actionable items (todos, fixes, wip)
rg '(todo|fix|wip)\s*:::'

# Assigned to anyone
rg '(todo|fix)\s*:::.*@\w+'

# Unassigned todos
rg 'todo\s*:::' | rg -v '@\w+'
```

### Audit Before Merge

```bash
# Check for starred items (should address before merge)
rg '\*\w+\s*:::' && echo "Has starred items!"

# Check for work-in-progress markers
rg 'wip\s*:::' && echo "Has WIP markers!"
```

### Generate Waymark Report

```bash
# Summary by marker type
echo "=== Waymark Summary ==="
echo "TODOs: $(rg -c 'todo\s*:::' | awk -F: '{sum+=$2}END{print sum}')"
echo "Fixes: $(rg -c 'fix\s*:::' | awk -F: '{sum+=$2}END{print sum}')"
echo "Notes: $(rg -c 'note\s*:::' | awk -F: '{sum+=$2}END{print sum}')"
echo "TLDRs: $(rg -c 'tldr\s*:::' | awk -F: '{sum+=$2}END{print sum}')"
```

## Pattern Reference

| Purpose | Pattern |
|---------|---------|
| All waymarks | `:::` |
| Specific marker | `marker\s*:::` |
| Starred | `\*\w+\s*:::` |
| Mentions | `:::\s*@\w+` |
| Tags | `:::.+#\w+` |
| Canonicals | `ref:#\w+` |
| Relations | `(depends|needs|fixes):#` |

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

## When to Use

Use ripgrep patterns when:

- `wm` CLI is not installed
- Working in environment without waymark tooling
- Need quick one-off searches
- Integrating with shell scripts

For richer features (formatting, graph, insert), install the `wm` CLI.
