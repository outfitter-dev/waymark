---
name: Waymark CLI
description: This skill should be used when the user asks about "wm command", "waymark cli", "wm find", "wm add", "wm edit", "wm rm", "wm fmt", "wm lint", or needs to use waymark tooling. Requires `using-waymarks` skill for syntax fundamentals. Provides comprehensive CLI command reference and workflows.
version: 1.0.0
---

<!-- tldr ::: core skill documentation for waymark CLI agents -->

# Waymark CLI Skill

## Prerequisite

Load the `using-waymarks` skill first for grammar and syntax fundamentals. This skill focuses on CLI commands and workflows, assuming familiarity with waymark syntax.

> **Load first:** `using-waymarks` covers grammar, markers, TLDRs, and ripgrep patterns.

## When to Use This Skill

- Find existing waymarks and summarize project status.
- Add new TODOs, TLDRs, or notes while implementing changes.
- Edit signals (flagged/starred) or content in place.
- Remove completed waymarks with audit history.
- Format or lint waymarks for consistency in CI.

## Command Overview

| Command | Purpose | Example |
| --- | --- | --- |
| find | Scan and filter | `wm find src/ --type todo --json` |
| add | Insert waymarks | `wm add src/auth.ts:42 todo "add retry"` |
| edit | Modify waymarks | `wm edit src/auth.ts:42 --flagged` |
| rm | Remove waymarks | `wm rm src/auth.ts:42 --write` |
| fmt | Format waymarks | `wm fmt src/ --write` |
| lint | Validate structure | `wm lint src/ --json` |
| init | Write config | `wm init --format toml` |
| doctor | Diagnose config | `wm doctor --json` |

## Quick Start Patterns

- Find open work:
  `wm find src/ --type todo --json`
- Add a tldr for a new file:
  `wm add src/new.ts:1 tldr "summary"`
- Flag a waymark during a refactor:
  `wm edit src/auth.ts:42 --flagged --write`
- Remove completed work safely:
  `wm rm src/auth.ts:42 --write`

## Output Formats

- Default: human-readable text
- `--json`: JSON array (best for parsing)
- `--jsonl`: JSON lines (streaming)

## Safety Model

- Most commands preview by default.
- Use `--write` to apply changes.
- `--no-input` fails fast in CI if prompts are required.

## Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Waymark error |
| 2 | Usage error |
| 3 | Configuration error |
| 4 | I/O error |

## Getting More Help

- Command docs: `wm skill show <command>`
- References: `wm skill show schemas` or `wm skill show exit-codes`
- Skill format: `wm skill show skill-format`
- Project-specific skills: `wm skill show project-skills`
- Examples: `wm skill show workflows`
- CLI help: `wm <command> --help`

## Related Skills

- **`using-waymarks`** - Grammar, syntax, markers, TLDRs, and ripgrep patterns (load first)
