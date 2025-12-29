---
description: Show file-level TLDR waymarks across the codebase
allowed-tools: Grep, Read, Bash(wm:*, rg:*)
---

Gather all `tldr :::` waymarks to provide a high-level overview of the codebase structure.

## Context Injection

File summaries: !`wm find . --type tldr --text 2>/dev/null || rg 'tldr\s*:::' -n`

## Instructions

Load the `find-waymarks` skill for waymark discovery and filtering.

1. Parse the injected TLDR data above
2. Organize by directory structure for navigation clarity
3. Highlight starred (`*tldr`) items as critical/must-read files
4. Note any canonical references (`ref:#token`) for cross-referencing
5. Present as a scannable codebase map

This provides an instant overview of what each file does - useful for onboarding or getting context before diving into code.

If the user provides a path argument, filter results to that scope.
