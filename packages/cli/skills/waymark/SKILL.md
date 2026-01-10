<!-- tldr ::: core skill documentation for waymark CLI agents -->

# Waymark CLI Skill

Waymarks are structured comments that capture intent, ownership, and constraints
in code. The `wm` CLI scans, adds, edits, removes, and validates these
annotations across a codebase.

## When to Use This Skill

- Find existing waymarks and summarize project status.
- Add new TODOs, TLDRs, or notes while implementing changes.
- Edit signals (flagged/starred) or content in place.
- Remove completed waymarks with audit history.
- Format or lint waymarks for consistency in CI.

## Syntax Quick Reference

```text
[signal][marker] ::: [content] [properties] [#tags] [@mentions]
```

Signals:

- `~` flagged (in-progress; must clear before merge)
- `*` starred (high priority)

Markers (examples):

- Work: todo, fix, wip, done, review, test, check
- Info: note, context, tldr, about, example, idea, comment
- Caution: warn, alert, deprecated, temp
- Workflow: blocked, needs
- Inquiry: ask

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
