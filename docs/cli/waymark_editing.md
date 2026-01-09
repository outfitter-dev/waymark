<!-- tldr ::: current guide to add, edit, and remove waymarks with the CLI -->

# Waymark Editing Guide

## Overview

Waymark editing commands let you add, adjust, and remove `:::` annotations with
consistent previews and JSON-friendly outputs. All editing commands default to
preview mode; pass `--write` to apply changes.

For agent-oriented docs and examples, use `wm skill`.

---

## Add Waymarks (`wm add`)

### Syntax

```text
wm add <file:line> <type> <content> [options]
wm add --from <json-file> [options]
```

### Common Options

- `--type <type>` / `--content <text>`: use flags instead of positional args
- `--position before|after`, `--before`, `--after`: place relative to the line
- `--tag <tag>`, `--mention <actor>`, `--property <kv>`: metadata
- `--continuation <text>`: add continuation lines
- `--flagged` (`-F`), `--starred`: apply signals
- `--order <n>` / `--id <id>`: batch ordering and explicit IDs
- `--write`, `--json`, `--jsonl`: output and apply changes

### Examples

```bash
# Basic insert
wm add src/auth.ts:42 todo "add rate limiting"

# Metadata and signals
wm add src/auth.ts:42 todo "add rate limiting" \
  --flagged --tag "#security" --mention @agent

# Insert above the target line
wm add src/auth.ts:10 note "doc above" --before

# JSON input
wm add --from insertions.json --write
cat insertions.jsonl | wm add --from - --json
```

---

## Edit Waymarks (`wm edit`)

### Syntax

```text
wm edit [file:line] [options]
wm edit --id <id> [options]
```

### Common Options

- `--type <type>`: change marker
- `--content <text>`: replace content
- `--flagged`, `--starred`, `--clear-signals`: adjust signals
- `--no-interactive`: skip prompts when no target is provided
- `--write`, `--json`, `--jsonl`: output and apply changes

### Examples

```bash
wm edit src/auth.ts:42 --type fix
wm edit --id [[a3k9m2p]] --starred --write
wm edit src/auth.ts:42 --content "new text" --write
```

---

## Remove Waymarks (`wm rm`)

### Syntax

```text
wm rm <file:line> [options]
wm rm --id <id> [options]
wm rm --from <json-file> [options]
wm rm --type <type> --file <path> [options]
```

### Filters

- `--type <type>`: match marker
- `--tag <tag>` / `--mention <actor>` / `--property <kv>`
- `--file <path>`: limit matching files
- `--contains <text>` / `--content-pattern <regex>`
- `--flagged` (`-F`) / `--starred` (`-S`)

### Examples

```bash
# Remove a single line (preview)
wm rm src/auth.ts:42

# Remove by ID
wm rm --id [[a3k9m2p]] --write

# Remove by filters
wm rm --type todo --tag "#deprecated" --file src/ --write

# JSON input
wm rm --from removals.json --write
```

---

## Batch JSON Formats

### Insertions

```json
{
  "insertions": [
    {
      "file": "src/auth.ts",
      "line": 42,
      "type": "todo",
      "content": "add rate limiting",
      "tags": ["#security"],
      "mentions": ["@agent"]
    }
  ]
}
```

### Removals

```json
{
  "removals": [
    {
      "files": ["src/**/*.ts"],
      "criteria": { "type": "todo", "contains": "deprecated" }
    }
  ],
  "options": { "write": true, "reason": "cleanup" }
}
```

---

## Output Formats

- Default: human-readable text
- `--json`: JSON array output
- `--jsonl`: JSON lines output

---

## Safety Model

- Preview mode is default; `--write` applies changes.
- Removals track history in `.waymark/history.json` when enabled.

---

## See Also

- `wm help add` / `wm help edit` / `wm help rm`
- `wm skill show add` / `wm skill show edit` / `wm skill show rm`
- `wm skill show workflows` for multi-command recipes
