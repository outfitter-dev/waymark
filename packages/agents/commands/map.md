---
description: Inject all waymarks as JSON for full codebase context
allowed-tools: Grep, Read, Bash(wm:*, rg:*)
---

<!-- tldr ::: gather all waymarks as JSON for comprehensive codebase context -->

# Map Waymarks Command

Gather all waymarks from the codebase as structured JSON for comprehensive context.

## Context Injection

All waymarks: !`wm find . --json 2>/dev/null || rg ':::' --json`

## Instructions

Load the `waymark-cli` skill for waymark discovery and filtering.

1. Parse the injected JSON waymark data above
2. Summarize the waymark landscape:
   - Total count by marker type (tldr, todo, fix, note, etc.)
   - Files with most waymarks
   - Common tags and namespaces
   - Active mentions (@agent, @person)
3. Identify patterns:
   - Areas with high todo/fix density (potential tech debt)
   - Well-documented areas (tldr + this coverage)
   - Cross-references via canonical tokens
4. Present key insights without overwhelming detail

This command gives full waymark context for understanding codebase state, planning work, or preparing for larger tasks.

If the user provides a path argument, scope the map to that directory.
