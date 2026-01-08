<!-- tldr ::: modular skill architecture design for waymark CLI agent documentation -->

# Waymark CLI Skill Structure Design

**Created:** 2026-01-08
**Status:** Draft
**Phase:** P3 (Documentation & DX)
**Supersedes:** Previous monolithic `cli.md` approach in `skill-command.md`

---

## Overview

This document defines the modular file structure for waymark CLI skills. The design follows the dev-workflow archetype from agent-kit while optimizing for:

1. **Progressive disclosure** - Core concepts in SKILL.md, details in command docs
2. **On-demand loading** - Agents load only what they need
3. **Maintainability** - Command docs update independently
4. **Discoverability** - Clear structure for both humans and agents

---

## Directory Structure

```text
packages/agents/skills/waymark/
├── SKILL.md                  # Core skill - overview, concepts, quick reference
├── commands/                 # Individual command documentation
│   ├── find.md              # Search and filter waymarks
│   ├── add.md               # Insert new waymarks
│   ├── edit.md              # Modify existing waymarks
│   ├── rm.md                # Remove waymarks
│   ├── fmt.md               # Format waymarks
│   ├── lint.md              # Validate waymark structure
│   ├── init.md              # Initialize waymark config
│   └── doctor.md            # Diagnose configuration issues
├── references/               # Supporting material
│   ├── schemas.md           # JSON input/output schemas
│   ├── exit-codes.md        # Exit code taxonomy
│   └── errors.md            # Error handling patterns
├── examples/                 # Use case examples (replaces *.prompt.txt)
│   ├── workflows.md         # Multi-command workflow recipes
│   ├── agent-tasks.md       # Common agent task patterns
│   ├── batch-operations.md  # Bulk add/edit/remove patterns
│   └── integration.md       # MCP, CI/CD, editor integration
└── index.json               # Manifest for programmatic discovery
```

---

## File Specifications

### SKILL.md (Core Skill)

**Purpose:** Entry point for agents. Provides enough context to understand waymarks and decide which command to use.

**Target size:** 150-250 lines (fits in single context load)

**Structure:**

```markdown
---
name: waymark
version: 1.0.0
description: >
  Structured code annotations using the ::: sigil. Use when finding,
  adding, modifying, or validating waymarks. Supports: scanning waymarks,
  batch insertion, editing signals, removal, formatting, linting.
  Triggers: waymark, wm, code annotations, :::, todo markers, tldr
commands:
  - find
  - add
  - edit
  - rm
  - fmt
  - lint
  - init
  - doctor
---

# Waymark CLI

## What Are Waymarks?

[2-3 sentence explanation of waymarks]

## When to Use This Skill

[Bullet list of trigger conditions]

## Syntax Quick Reference

[Condensed grammar - signals, markers, properties, tags]

## Command Overview

| Command | Purpose | Example |
|---------|---------|---------|
| find    | Search waymarks | `wm --type todo --json` |
| add     | Insert waymarks | `wm add src/auth.ts:42 todo "..."` |
| edit    | Modify waymarks | `wm edit src/auth.ts:42 --flagged` |
| rm      | Remove waymarks | `wm rm src/auth.ts:42 --write` |
| fmt     | Format waymarks | `wm fmt src/ --write` |
| lint    | Validate structure | `wm lint src/ --json` |

## Quick Start Patterns

[3-5 most common patterns with one-liner examples]

## Safety Model

[Preview vs write mode, exit codes overview]

## Getting More Help

- Command details: `wm skill show <command>` or `wm <command> --help`
- JSON schemas: `wm skill --section schemas`
- Workflows: `wm skill --section workflows`
```

---

### Command Documentation Template (commands/*.md)

**Purpose:** Complete reference for a single command. Loaded when agent needs to execute that specific command.

**Target size:** 100-200 lines per command

**Structure:**

````markdown
---
command: <name>
aliases: [<alias1>, <alias2>]  # if any
---

# wm <name>

## Synopsis

<one-line description>

## Syntax

```text

wm <name> <arguments> [options]

```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<arg>` | Yes/No | Description |

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--option` | `-o` | Description | value |

## Output Formats

| Flag | Format | Use Case |
|------|--------|----------|
| (default) | Human text | Terminal viewing |
| `--json` | JSON array | Programmatic parsing |
| `--jsonl` | JSON lines | Streaming processing |

## Examples

### Basic Usage

```bash
wm <name> <example>
```

### With Options

```bash
wm <name> --option value
```

### Agent Pattern

```bash
# Common agent workflow
wm <name> --json | process
```

## Agent Workflows

1. **Workflow Name**
   - When to use
   - Step-by-step commands
   - Expected output

## Configuration

Behavior controlled by `.waymark/config.toml`:

```toml
[section]
key = value
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Failure |

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Error message | Why it happens | How to fix |

## Tips

- Tip 1
- Tip 2

## See Also

- `wm <related>` - Related command
- [schemas.md](../references/schemas.md) - JSON schemas
````

---

### Reference Documents (references/*.md)

#### schemas.md

**Purpose:** Complete JSON input/output schemas for programmatic usage.

**Content:**

- Waymark record output schema
- Add command input schema
- Edit command input schema
- Remove command input schema
- Lint issue schema
- Graph edge schema

#### exit-codes.md

**Purpose:** Exit code taxonomy for CI/CD integration.

**Content:**

- Code definitions (0-4+)
- Per-command exit code specifics
- CI integration patterns

#### errors.md

**Purpose:** Error handling patterns and recovery.

**Content:**

- Common error types
- Error message patterns
- Recovery strategies
- Debugging steps

#### workflows.md

**Purpose:** Multi-command workflow recipes for common tasks.

**Content:**

- Pre-commit validation workflow
- CI integration workflow
- Batch migration workflow
- Codebase audit workflow
- Agent task delegation workflow

---

### index.json (Manifest)

**Purpose:** Machine-readable manifest for programmatic skill discovery.

```json
{
  "name": "waymark",
  "version": "1.0.0",
  "description": "Structured code annotations using the ::: sigil",
  "entry": "SKILL.md",
  "commands": {
    "find": "commands/find.md",
    "add": "commands/add.md",
    "edit": "commands/edit.md",
    "rm": "commands/rm.md",
    "fmt": "commands/fmt.md",
    "lint": "commands/lint.md",
    "init": "commands/init.md",
    "doctor": "commands/doctor.md"
  },
  "references": {
    "schemas": "references/schemas.md",
    "exit-codes": "references/exit-codes.md",
    "errors": "references/errors.md",
    "workflows": "references/workflows.md"
  },
  "triggers": [
    "waymark",
    "wm",
    "code annotations",
    ":::",
    "todo markers",
    "tldr"
  ]
}
```

---

## CLI Command Changes

### Updated `wm skill` Interface

```bash
# Show core skill (SKILL.md)
wm skill

# Show specific command documentation
wm skill show <command>
wm skill show add

# Show reference document
wm skill show schemas
wm skill show workflows

# List available sections
wm skill list

# Output as JSON (parsed structure)
wm skill --json
wm skill show add --json

# Print path to skill directory
wm skill path
```

### Implementation Notes

1. **Skill loading:** `wm skill` reads SKILL.md, `wm skill show <name>` reads from commands/ or references/
2. **Fallback:** If command not found in commands/, check references/
3. **JSON output:** Parse frontmatter + markdown sections into structured JSON
4. **Path command:** Useful for agents that want to read files directly

---

## Content Migration

### From .prompt.txt Files

| Source File | Target |
|-------------|--------|
| `add.prompt.txt` | `commands/add.md` |
| `edit.prompt.txt` | `commands/edit.md` |
| `remove.prompt.txt` | `commands/rm.md` |
| `format.prompt.txt` | `commands/fmt.md` |
| `lint.prompt.txt` | `commands/lint.md` |
| `unified/index.prompt.ts` (syntax section) | `SKILL.md` |

### Content Transformation

1. Convert ALL-CAPS sections to Markdown headings
2. Add YAML frontmatter
3. Convert plain text lists to Markdown tables
4. Add command-specific exit codes
5. Link to reference documents instead of duplicating schemas
6. Remove "For human-facing help..." lines (replaced by structure)

---

## Design Rationale

### Why Modular vs Monolithic?

**Monolithic (previous approach):**

- Single 500+ line file
- Agent loads everything even for simple queries
- All content competes for attention

**Modular (this approach):**

- Core skill is 150-250 lines (fast load)
- Command docs load on-demand
- References shared across commands (DRY)

### Why Markdown with Frontmatter?

1. **Human readable** - Developers can browse in GitHub/editors
2. **Machine parseable** - YAML frontmatter provides structured metadata
3. **Portable** - Can be copied to `.claude/skills/` or other skill loaders
4. **Standard** - Matches Claude skill conventions

### Why index.json?

1. **Programmatic discovery** - MCP server can enumerate commands
2. **Version tracking** - Single source for version number
3. **Fast lookup** - No markdown parsing needed for discovery

---

## Implementation Checklist

### Phase 1: Structure Setup

- [ ] Create `packages/agents/skills/waymark/` directory
- [ ] Create `SKILL.md` with core content
- [ ] Create `commands/` directory
- [ ] Create `references/` directory
- [ ] Create `index.json` manifest

### Phase 2: Content Migration

- [ ] Migrate `add.prompt.txt` to `commands/add.md`
- [ ] Migrate `edit.prompt.txt` to `commands/edit.md`
- [ ] Migrate `remove.prompt.txt` to `commands/rm.md`
- [ ] Migrate `format.prompt.txt` to `commands/fmt.md`
- [ ] Migrate `lint.prompt.txt` to `commands/lint.md`
- [ ] Create `commands/find.md` (new, from unified prompt)
- [ ] Create `commands/init.md` (new)
- [ ] Create `commands/doctor.md` (new)

### Phase 3: Reference Documents

- [ ] Create `references/schemas.md`
- [ ] Create `references/exit-codes.md`
- [ ] Create `references/errors.md`
- [ ] Create `references/workflows.md`

### Phase 4: CLI Integration

- [ ] Update `wm skill` to read from modular structure
- [ ] Implement `wm skill show <command>`
- [ ] Implement `wm skill list`
- [ ] Update JSON output to reflect modular structure

### Phase 5: Cleanup

- [ ] Delete `.prompt.txt` files
- [ ] Delete `.prompt.ts` wrapper files
- [ ] Delete `.help.txt` files
- [ ] Remove `--prompt` flag handling

---

## Open Questions

1. **Should command aliases be in separate files?**
   - Recommendation: No, include aliases in frontmatter of primary command

2. **How to handle graph mode documentation?**
   - Recommendation: Document in `commands/find.md` with `--graph` section

3. **Should we include examples in a separate directory?**
   - Recommendation: No, keep examples inline in command docs. The `references/workflows.md` handles complex multi-command scenarios.

4. **Where does configuration documentation live?**
   - Recommendation: Each command doc references config relevant to it. A future `references/config.md` could provide complete reference.

---

## Related Documents

- @skill-command.md - Original monolithic design (superseded)
- @PLAN.md - Overall v1-RC implementation plan
- @documentation.md - Documentation standards

---

## Appendix A: Complete SKILL.md Template

````markdown
---
name: waymark
version: 1.0.0
description: >
  Structured code annotations using the ::: sigil. Use when finding,
  adding, modifying, or validating waymarks in codebases. Supports:
  scanning, batch insertion, editing signals, removal, formatting, linting.
  Triggers: waymark, wm, code annotations, :::, todo markers, tldr
commands:
  - find
  - add
  - edit
  - rm
  - fmt
  - lint
  - init
  - doctor
---

# Waymark CLI

Waymarks are structured comments using the `:::` sigil that encode intent,
ownership, and constraints directly in code. The `wm` CLI finds, adds,
modifies, and validates these annotations.

## When to Use This Skill

- Finding existing waymarks in a codebase
- Adding new annotations (todos, notes, tldr summaries)
- Editing waymark signals (flagged, starred) or content
- Removing completed or outdated waymarks
- Formatting waymarks for consistency
- Validating waymark structure in CI

## Syntax Quick Reference

```text

[signal][marker] ::: [content] [properties] [#tags] [@mentions]

```

**Signals:**

- `~` (flagged) - Work in progress, must clear before merge
- `*` (starred) - High priority or important

**Common Markers:**

- `todo` - Action items
- `fix` - Bug fixes needed
- `note` - Context or explanation
- `tldr` - File summary (one per file)
- `about` - Section summary
- `warn` - Caution or warning
- `done` - Completed work (remove after merge)

**Examples:**

```typescript
// tldr ::: user authentication service ref:#auth/service
// todo ::: @agent implement OAuth callback #sec
// ~fix ::: validate input before processing
// *note ::: performance hotpath #perf:hotpath
```

## Command Overview

| Command | Purpose | Common Usage |
|---------|---------|--------------|
| `find`  | Search and filter waymarks | `wm --type todo --json` |
| `add`   | Insert new waymarks | `wm add src/auth.ts:42 todo "implement OAuth"` |
| `edit`  | Modify existing waymarks | `wm edit src/auth.ts:42 --flagged --write` |
| `rm`    | Remove waymarks | `wm rm src/auth.ts:42 --write` |
| `fmt`   | Format for consistency | `wm fmt src/ --write` |
| `lint`  | Validate structure | `wm lint src/ --json` |
| `init`  | Initialize config | `wm init` |
| `doctor`| Diagnose issues | `wm doctor` |

## Quick Start Patterns

**Find agent-assigned todos:**

```bash
wm --type todo --mention @agent --json
```

**Check for blocking work before merge:**

```bash
wm --flagged --json | jq 'length'  # Should be 0
```

**Add a file summary:**

```bash
wm add src/newfile.ts:1 tldr "utility functions for date handling"
```

**Batch format before commit:**

```bash
git diff --name-only --cached | xargs wm fmt --write
```

**Validate in CI:**

```bash
wm lint src/ --json | jq 'map(select(.severity == "error")) | length == 0'
```

## Safety Model

Most mutating commands use a **preview/write** pattern:

1. **Preview (default):** Shows what would change without modifying files
2. **Write (`--write`):** Actually applies changes

This prevents accidental modifications. Always preview first, then add `--write`.

## Exit Codes

| Code | Meaning | Example |
|------|---------|---------|
| 0 | Success | Operation completed |
| 1 | Failure | Lint errors found |
| 2 | Usage error | Invalid arguments |
| 3 | Config error | Bad configuration |
| 4 | I/O error | File not found |

## Getting More Help

```bash
wm skill show <command>    # Detailed command documentation
wm skill show schemas      # JSON input/output schemas
wm skill show workflows    # Multi-command workflow recipes
wm skill list              # List all available documentation
wm <command> --help        # Human-readable help
```
````

---

## Appendix B: Complete Command Doc Template (add.md)

````markdown
---
command: add
aliases: []
---

# wm add

## Synopsis

Insert new waymarks into files with automatic formatting and ID management.

## Syntax

```

wm add <file:line> <type> <content> [options]
wm add --from <json-file>
echo '<json>' | wm add --from -

```

## Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<file:line>` | Yes* | Target location (e.g., `src/auth.ts:42`) |
| `<type>` | Yes* | Waymark marker (todo, fix, note, etc.) |
| `<content>` | Yes* | Waymark content text |

*Not required when using `--from` for JSON input.

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--from <path>` | | JSON/JSONL input file (use `-` for stdin) | |
| `--mention <actor>` | | Add mention (repeatable) | |
| `--tag <tag>` | | Add hashtag (repeatable) | |
| `--property <kv>` | | Add property key:value (repeatable) | |
| `--ref <token>` | | Set canonical reference | |
| `--signal <sig>` | | Add signal: `~` or `*` (repeatable) | |
| `--json` | | Output as JSON array | |
| `--jsonl` | | Output as JSON lines | |

## Output Formats

| Flag | Format | Use Case |
|------|--------|----------|
| (default) | Human text | Terminal viewing |
| `--json` | JSON array | Programmatic parsing |
| `--jsonl` | JSON lines | Streaming processing |

## Examples

### Basic Usage

```bash
# Insert simple todo
wm add src/auth.ts:42 todo "implement rate limiting"

# Insert with mentions and tags
wm add src/db.ts:15 note "assumes UTC timestamps" --mention @alice --tag "#time"
```

### With Signals

```bash
# Starred (high priority)
wm add src/api.ts:100 fix "validate input" --signal *

# Flagged (work in progress)
wm add src/refactor.ts:50 wip "refactoring auth flow" --signal ~
```

### Batch Insert

```bash
# From JSON array
cat waymarks.json | wm add --from - --json

# From JSONL (one waymark per line)
cat waymarks.jsonl | wm add --from -
```

## Agent Workflows

### 1. Track Implementation Work

When identifying work during analysis:

```bash
wm add src/auth.ts:42 todo "@agent implement OAuth flow" --tag "#sec"
```

### 2. Add Documentation Breadcrumbs

When creating new files:

```bash
wm add src/newfile.ts:1 tldr "utility functions for date handling"
```

### 3. Batch Insert from Analysis

After analyzing codebase:

```bash
echo '[
  {"file":"src/a.ts","line":10,"type":"todo","content":"add tests"},
  {"file":"src/b.ts","line":20,"type":"fix","content":"handle edge case"}
]' | wm add --from - --json
```

## JSON Input Schema

```json
{
  "file": "src/auth.ts",
  "line": 42,
  "type": "todo",
  "content": "implement OAuth flow",
  "signals": {"flagged": false, "starred": false},
  "mentions": ["@agent"],
  "tags": ["#sec"],
  "properties": {"priority": "high"}
}
```

**Required:** `file`, `line`, `type`, `content`
**Optional:** `signals`, `mentions`, `tags`, `properties`, `relations`

## Configuration

Behavior controlled by `.waymark/config.toml`:

```toml
[ids]
enabled = true          # Enable ID reservation
scope = "repo"          # ID scope: repo or file
format = "base36"       # ID format

[format]
typeCase = "lowercase"  # Marker normalization
alignContinuations = true
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success - waymarks inserted |
| 1 | Failure - insertion failed |
| 2 | Usage error - invalid arguments |
| 4 | I/O error - file not found |

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| File not found | Invalid path | Verify file exists |
| Invalid line number | Out of bounds | Check file length |
| Unknown type | Not in allowlist | Use blessed type or configure |
| Malformed JSON | Syntax error | Validate JSON before piping |

## Tips

- Use `--json` output for programmatic workflows
- Validate file exists and line number is valid before inserting
- Use JSONL format for batch operations (one waymark per line)
- Combine with `wm find` to verify waymarks were added
- Use signals (`~` or `*`) to mark priority or in-progress work

## See Also

- `wm edit` - Modify existing waymarks
- `wm rm` - Remove waymarks
- `wm fmt` - Format waymarks for consistency
- [schemas.md](../references/schemas.md) - Complete JSON schemas
- [workflows.md](../references/workflows.md) - Multi-command recipes
````
