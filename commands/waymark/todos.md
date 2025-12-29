---
description: Show all todo waymarks in the codebase
allowed-tools: Bash(wm:*, rg:*), Read, Grep
---

Gather all `todo :::` waymarks from the codebase and present them to the user.

## Context Injection

Current todos: !`wm find . --type todo --text 2>/dev/null || rg 'todo\s*:::' -n`

## Instructions

1. Parse the injected waymark data above
2. Group todos by file or directory for readability
3. Highlight any starred (`*todo`) items as high-priority
4. Note any with mentions (e.g., `@agent`, `@alice`) for ownership clarity
5. Present a summary count and organized list

If no todos found, inform the user the codebase is clean of todo markers.

If the user provides a path argument, filter results to that scope.
