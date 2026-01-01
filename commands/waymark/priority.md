---
description: Show starred (high-priority) waymarks
allowed-tools: Grep, Read, Bash(wm:*, rg:*)
---

<!-- tldr ::: display starred high-priority waymarks requiring immediate attention -->

# Priority Waymarks Command

Gather all starred (`*`) waymarks which indicate high-priority items requiring attention.

## Context Injection

Starred items: !`wm find . --starred --text 2>/dev/null || rg '\*\w+\s*:::' -n`

## Instructions

Load the `find-waymarks` skill for waymark discovery and filtering.

1. Parse the injected starred waymark data above
2. Categorize by marker type:
   - `*tldr` - Critical files that must be read first
   - `*todo` - High-priority tasks
   - `*fix` - Urgent bugs
   - `*warn` - Important warnings
   - `*review` - Priority review requests
3. For each starred item, provide:
   - File location and line
   - The full waymark content
   - Any mentions or tags
4. Recommend which items need immediate attention

Starred waymarks are reserved for truly important items. If there are many, suggest an audit to ensure the signal stays strong.

If no starred items found, inform the user the priority queue is clear.
