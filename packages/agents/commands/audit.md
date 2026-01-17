---
description: Audit waymark coverage and quality
argument-hint: [path] [--all] [--tldr]
allowed-tools: Glob, Grep, Read, Task, Bash(wm:*, rg:*, git:*)
---

<!-- tldr ::: audit waymark coverage quality and accuracy across codebase files -->

# Audit Waymarks Command

Audit waymarks for coverage, accuracy, and quality.

## Arguments

- `$1` - Optional path to scope audit (default: current directory)
- `--all` - Full repository audit across all directories
- `--tldr` - Focus only on TLDR waymark coverage

## Context Injection

Current waymarks: !`wm find ${1:-.} --json 2>/dev/null || rg ':::' ${1:-.} --json`
Source files: !`git ls-files '*.ts' '*.tsx' '*.js' '*.jsx' '*.py' '*.rs' '*.go' ${1:-.} 2>/dev/null | head -50`

## Instructions

Load the `auditing-waymarks` skill for detailed audit methodology.

### TLDR Audit (default or `--tldr`)

1. Compare source files against files with TLDRs
2. Identify files missing `tldr :::` waymarks
3. Check TLDR quality:
   - Active voice, 8-14 words
   - Capability-first phrasing
   - Proper tag usage (`#docs` on documentation)
4. Report coverage percentage and specific gaps

### Full Audit (`--all`)

1. All TLDR checks above
2. Review starred items for continued relevance
3. Check for stale work markers (old todos/fixes)
4. Validate canonical references exist and are referenced
5. Ensure tag consistency across the codebase
6. Spot-check waymark accuracy against code

### Spawning Scouts

For large codebases with `--all`:

- Launch `waymarker` agents to parallelize audit
- Partition by top-level directories
- Consolidate findings into single report

## Output

Provide categorized findings:

- **Critical**: Missing TLDRs on important files, broken references
- **Warning**: Stale markers, inconsistent tags
- **Info**: Improvement opportunities

End with actionable recommendations.
