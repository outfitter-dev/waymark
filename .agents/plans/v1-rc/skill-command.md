<!-- tldr ::: design document for wm skill command consolidating agent documentation -->

# `wm skill` Command Design

**Created:** 2026-01-08
**Status:** Draft (Superseded by modular structure)
**Phase:** P3 (Documentation & DX)

> **NOTE:** This document's monolithic `cli.md` approach has been superseded by the modular structure defined in @skill-structure.md. The problem analysis and `wm skill` command interface remain valid; the file structure has been redesigned.

---

## Problem Statement

The CLI currently maintains multiple sources of agent-facing documentation:

1. **`.prompt.txt` files** (5 files, ~800 lines total) - Detailed agent usage guides
2. **`.help.txt` files** (3 files) - Human help text that duplicates Commander output
3. **`.prompt.ts` files** - TypeScript wrappers that export `.prompt.txt` content
4. **`--prompt` flag** - Per-command flag that outputs agent guidance

This creates maintenance burden and risks documentation drift. The `--prompt` flag is also awkward - agents must know which command they want help with before asking.

### Current .prompt.txt Content Analysis

The existing `.prompt.txt` files contain:

| Section | Purpose | Example |
|---------|---------|---------|
| PURPOSE | One-line description | "Programmatically add waymarks into files" |
| COMMAND SYNTAX | Usage patterns | `wm add <file:line> <type> <content>` |
| INPUT MODES | Data input patterns | Inline, JSON, JSONL, stdin |
| FLAGS | All options with descriptions | `--mention`, `--tag`, `--property` |
| OUTPUT FORMATS | Structured output options | `--json`, `--jsonl`, text |
| AGENT WORKFLOWS | Numbered workflow recipes | "Track implementation work", "Batch insert" |
| JSON SCHEMA | Input/output contracts | Required/optional fields |
| AUTOMATIC BEHAVIORS | Implicit actions | ID management, formatting |
| TIPS FOR AGENTS | Best practices | "Always use --json for parsing" |
| ERROR HANDLING | Common errors and fixes | "File not found -> Check path" |
| COMBINING COMMANDS | Integration patterns | `wm add && wm find --type todo` |

---

## Design Goals

1. **Single Source of Truth** - One skill file contains all agent documentation
2. **DRY** - No duplication between help and skill content
3. **Discoverable** - Agents can ask "what can waymark do?" without knowing commands
4. **Structured** - Machine-parseable sections for agent consumption
5. **Versioned** - Ships with CLI, matches CLI version

---

## Proposed Solution

> **Updated:** See @skill-structure.md for the finalized modular structure.

### 1. Skill File Location & Format

Create a modular skill structure that ships with the CLI package:

```text
packages/agents/skills/waymark/
├── SKILL.md           # Core skill - overview, when to use, key concepts
├── commands/          # Individual command documentation
│   ├── find.md
│   ├── add.md
│   ├── edit.md
│   ├── rm.md
│   ├── fmt.md
│   ├── lint.md
│   ├── init.md
│   └── doctor.md
├── references/        # Supporting material
│   ├── schemas.md
│   ├── exit-codes.md
│   └── errors.md
├── examples/          # Use case examples (replaces *.prompt.txt)
│   ├── workflows.md
│   ├── agent-tasks.md
│   ├── batch-operations.md
│   └── integration.md
└── index.json         # Manifest for programmatic discovery
```

This structure uses Markdown with YAML frontmatter, providing:

- Human-readable in editors/GitHub
- Machine-parseable for agents
- Progressive disclosure (core in SKILL.md, details on-demand)
- Portable (can be extracted to `.claude/skills/` or similar)

### 2. Skill File Structure

```markdown
---
name: waymark
version: 1.0.0
description: Structured code annotations for humans and agents
commands:
  - find
  - add
  - edit
  - rm
  - fmt
  - lint
  - init
  - doctor
capabilities:
  - scan-waymarks
  - add-waymarks
  - edit-waymarks
  - remove-waymarks
  - format-waymarks
  - lint-waymarks
  - graph-relations
---

# Waymark CLI Skill

## Overview

Waymarks are structured comments using the `:::` sigil that encode intent,
ownership, and constraints directly in code. The `wm` CLI finds, adds,
modifies, and validates these annotations.

## Syntax Primer

[Content from unified/index.prompt.ts WAYMARK SYNTAX PRIMER section]

## Commands

### find (default)

**Purpose**: Scan and filter waymarks across a codebase.

**Syntax**:
\`\`\`
wm [paths] [filters] [modes] [output]
wm find [paths] [filters] [modes] [output]
\`\`\`

**Filters**:
| Flag | Description | Example |
|------|-------------|---------|
| `--type <marker>` | Filter by type | `--type todo` |
| `--mention <actor>` | Filter by mention | `--mention @agent` |
| `--tag <tag>` | Filter by hashtag | `--tag "#perf"` |
| `--flagged` | Show ~ waymarks | Work in progress |
| `--starred` | Show * waymarks | High priority |

**Output Formats**:
| Flag | Format | Use Case |
|------|--------|----------|
| (default) | Human text | Terminal viewing |
| `--json` | JSON array | Programmatic parsing |
| `--jsonl` | JSON lines | Streaming processing |
| `--graph` | Relation graph | Dependency analysis |

**Agent Workflows**:

1. Find actionable work:
   \`\`\`bash
   wm --type todo --mention @agent --json
   \`\`\`

2. Check for blocking work before merge:
   \`\`\`bash
   wm --flagged --json | jq 'length'  # Should be 0
   \`\`\`

3. Extract dependency graph:
   \`\`\`bash
   wm --graph --json > deps.json
   \`\`\`

---

### add

[Consolidated from add.prompt.txt]

---

### edit

[Consolidated from edit.prompt.txt]

---

### rm

[Consolidated from remove.prompt.txt]

---

### fmt

[Consolidated from format.prompt.txt]

---

### lint

[Consolidated from lint.prompt.txt]

---

## JSON Schemas

### Waymark Record (Output)

\`\`\`json
{
  "file": "src/auth.ts",
  "startLine": 12,
  "type": "todo",
  "signals": { "flagged": false, "starred": false },
  "contentText": "@agent implement OAuth callback",
  "mentions": ["@agent"],
  "tags": ["#sec"],
  "properties": {}
}
\`\`\`

### Add Input (--from)

\`\`\`json
{
  "file": "src/auth.ts",
  "line": 42,
  "type": "todo",
  "content": "implement OAuth flow",
  "mentions": ["@agent"],
  "tags": ["#sec"]
}
\`\`\`

## Best Practices for Agents

1. Always use `--json` for programmatic parsing
2. Use `--jsonl` for streaming large result sets
3. Check `--flagged` before merging to ensure no WIP remains
4. Parse TLDR waymarks to understand file purposes
5. Look for `@agent` mentions to find delegated work
6. Combine filters for precision: `--type todo --mention @agent --tag "#perf"`
7. Use `--graph` to understand dependencies before refactoring

## Exit Codes

| Code | Meaning | When |
|------|---------|------|
| 0 | Success | Operation completed |
| 1 | Failure | Lint errors, parse errors |
| 2 | Usage error | Invalid arguments |
| 3 | Config error | Bad configuration |
| 4 | I/O error | File not found |

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| File not found | Bad path | Verify path exists |
| Invalid line | Out of bounds | Check file length |
| Unknown type | Not in allowlist | Use blessed type or configure |
| Malformed JSON | Syntax error | Validate before piping |

## Integration Patterns

\`\`\`bash
# Find and process agent tasks
wm --type todo --mention @agent --jsonl | process-tasks

# Pre-merge check
wm --flagged --json | jq 'if length > 0 then error else empty end'

# Batch insert from analysis
cat waymarks.jsonl | wm add --from - --json > results.json

# Format before commit
git diff --name-only --cached | xargs wm fmt --write
\`\`\`
```

### 3. `wm skill` Command Design

#### Subcommands

```bash
wm skill                    # Show full skill document (markdown)
wm skill --json             # Output as JSON with parsed sections
wm skill show <section>     # Output specific section (command or reference)
wm skill list               # List available sections
wm skill path               # Print path to skill directory (for agents to read directly)
```

#### Command Interface

```typescript
// packages/cli/src/commands/skill.ts

import { Command } from "commander";
import skillContent from "../skills/waymark.skill.md" with { type: "text" };
import { parseSkillDocument } from "../skills/parser.ts";

export function registerSkillCommand(program: Command): void {
  const skill = program
    .command("skill")
    .description("Show agent-facing skill documentation")
    .option("--json", "Output as parsed JSON")
    .action(handleSkill);

  skill
    .command("list")
    .description("List available sections")
    .action(handleSkillList);

  skill
    .command("show <section>")
    .description("Show specific section (command or reference)")
    .option("--json", "Output as JSON")
    .action(handleSkillShow);

  skill
    .command("path")
    .description("Print path to skill directory")
    .action(handleSkillPath);
}
```

#### Output Formats

**Default (Markdown)**:

```text
$ wm skill

# Waymark CLI Skill

## Overview

Waymarks are structured comments using the `:::` sigil...
[full markdown content]
```

**JSON (`--json`)**:

```json
{
  "name": "waymark",
  "version": "1.0.0",
  "description": "Structured code annotations for humans and agents",
  "sections": {
    "overview": "Waymarks are structured comments...",
    "commands": {
      "find": { "purpose": "...", "syntax": "...", "flags": [...] },
      "add": { ... }
    },
    "schemas": { ... },
    "bestPractices": [...],
    "exitCodes": [...],
    "errorHandling": [...]
  }
}
```

**Show section (`wm skill show add`)**:

```text
$ wm skill show add

### add

**Purpose**: Add waymarks into files programmatically.

**Syntax**:
...
```

**List sections**:

```text
$ wm skill list

Available sections:
  overview
  syntax-primer
  commands
  commands.find
  commands.add
  commands.edit
  commands.rm
  commands.fmt
  commands.lint
  schemas
  best-practices
  exit-codes
  error-handling
  integration-patterns
```

**Show command**:

```text
$ wm skill show add

### add

**Purpose**: Add waymarks into files programmatically.
...
```

### 4. Skill Parser

Parse the markdown skill file into structured JSON:

```typescript
// packages/cli/src/skills/parser.ts

import matter from "gray-matter";
import { marked } from "marked";

export interface SkillDocument {
  name: string;
  version: string;
  description: string;
  commands: string[];
  capabilities: string[];
  sections: Record<string, SkillSection>;
}

export interface SkillSection {
  title: string;
  content: string;
  subsections?: Record<string, SkillSection>;
}

export function parseSkillDocument(markdown: string): SkillDocument {
  const { data: frontmatter, content } = matter(markdown);

  // Parse markdown into sections by heading level
  const sections = parseMarkdownSections(content);

  return {
    name: frontmatter.name,
    version: frontmatter.version,
    description: frontmatter.description,
    commands: frontmatter.commands ?? [],
    capabilities: frontmatter.capabilities ?? [],
    sections,
  };
}

function parseMarkdownSections(content: string): Record<string, SkillSection> {
  // Implementation: split by ## headings, nest by ### headings
  // Return structured object
}
```

---

## Migration Plan

### Phase 1: Create Skill File

1. Create `packages/agents/skills/waymark/cli.md`
2. Consolidate content from all `.prompt.txt` files
3. Add YAML frontmatter with metadata
4. Validate structure parses correctly

### Phase 2: Implement `wm skill` Command

1. Add `packages/cli/src/commands/skill.ts`
2. Add `packages/cli/src/skills/parser.ts`
3. Register command in `packages/cli/src/index.ts`
4. Add tests for command and parser

### Phase 3: Deprecate `--prompt` Flag

1. Add deprecation warning to `--prompt` handlers
2. Have `--prompt` delegate to `wm skill show <command>`
3. Document migration in changelog

### Phase 4: Delete Legacy Files

1. Delete all `.prompt.txt` files
2. Delete all `.prompt.ts` wrapper files
3. Delete all `.help.txt` files (Commander handles help)
4. Delete `--prompt` flag handling code
5. Update any references to deleted files

### Files to Delete

```text
packages/cli/src/commands/add.prompt.txt
packages/cli/src/commands/add.prompt.ts
packages/cli/src/commands/edit.prompt.txt
packages/cli/src/commands/edit.prompt.ts
packages/cli/src/commands/format.prompt.txt
packages/cli/src/commands/format.prompt.ts
packages/cli/src/commands/format.help.txt
packages/cli/src/commands/format.help.ts
packages/cli/src/commands/lint.prompt.txt
packages/cli/src/commands/lint.prompt.ts
packages/cli/src/commands/lint.help.txt
packages/cli/src/commands/lint.help.ts
packages/cli/src/commands/remove.prompt.txt
packages/cli/src/commands/remove.prompt.ts
packages/cli/src/commands/unified/index.prompt.ts
packages/cli/src/commands/unified/index.help.txt
packages/cli/src/commands/unified/index.help.ts
```

---

## Alternatives Considered

### A. Keep `.prompt.txt` files, just remove duplication

**Pros**: Less change
**Cons**: Still fragmented, no central discovery, `--prompt` remains awkward

### B. Generate skill from code annotations

**Pros**: True single source of truth from code
**Cons**: Complex, requires parsing code + comments, harder to maintain prose

### C. External skill file in `.waymark/skills/`

**Pros**: Discoverable in project root
**Cons**: Ships separately from CLI, version drift risk, not in npm package

### D. Multiple skill files per command

**Pros**: Modular
**Cons**: Same fragmentation problem, harder discovery

---

## Integration Points

### MCP Server

The MCP server can expose the skill document:

```typescript
// apps/mcp/src/resources/skill.ts
server.resource("waymark://skill", async () => {
  const skill = await readSkillDocument();
  return { content: skill };
});
```

### Agent Skill Loaders

Agents using the Claude Code skill loader pattern can reference:

```markdown
<!-- In .claude/skills/waymark.md -->
Load waymark skill:

$ wm skill --json > /tmp/waymark-skill.json

Or read directly:

$ wm skill path
/path/to/node_modules/@waymarks/cli/dist/skills/waymark.skill.md
```

### Claude Code Skill Definition

Create a thin wrapper in the user's `.claude/skills/` that loads the CLI skill:

```markdown
<!-- .claude/skills/waymark.md -->
---
name: waymark
description: Work with waymark code annotations
trigger: waymark, wm, code annotations, :::
---

# Waymark Skill

This skill provides guidance for working with waymark code annotations.

## Loading Skill Content

Run `wm skill` to get full documentation, or `wm skill show <command>` for
specific command help.

## Quick Reference

[Inline the most critical info here, ~50 lines]
```

---

## Resolved Questions

1. **Skill versioning**: Should skill version match CLI version exactly?
   - Decision: Yes, they ship together

2. **Localization**: Support translated skills?
   - Decision: Not for v1, English only

3. **Skill discovery**: Should `wm --help` mention `wm skill`?
   - Decision: Yes, add "For agent usage, see: wm skill"

4. **Deprecation timeline**: How long to keep `--prompt`?
   - Decision: Warn for 2 minor versions, remove in next major

---

## Checklist

> **See @skill-structure.md for the detailed implementation checklist.**

### Implementation

- [ ] Create `packages/agents/skills/waymark/` directory structure
- [ ] Create `SKILL.md` core skill document
- [ ] Create `commands/*.md` for each command
- [ ] Create `references/*.md` supporting documents
- [ ] Create `index.json` manifest
- [ ] Create `parser.ts` for markdown parsing
- [ ] Create `skill.ts` command handler
- [ ] Register command in `index.ts`
- [ ] Add tests for parser
- [ ] Add tests for command output

### Migration

- [ ] Add deprecation warning to `--prompt`
- [ ] Delete `.prompt.txt` files
- [ ] Delete `.prompt.ts` files
- [ ] Delete `.help.txt` files
- [ ] Delete `.help.ts` files
- [ ] Remove `--prompt` flag from all commands
- [ ] Update README to document `wm skill`
- [ ] Update MCP server to expose skill resource

### Documentation

- [ ] Add `wm skill` to command reference
- [ ] Update AGENTS.md to reference skill command
- [ ] Add skill file format documentation
- [ ] Document how to create project-specific skills

---

## Appendix: Modular Skill Structure

See @skill-structure.md for:

- Complete directory structure
- SKILL.md template
- Command documentation template
- Reference document specifications
- index.json manifest format
- Content migration guide
