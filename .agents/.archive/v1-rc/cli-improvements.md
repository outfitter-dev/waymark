<!-- tldr ::: CLI citizenship improvements for exit codes, flags, TTY handling, and error messages -->

# CLI Improvements

**Phase:** P2 (CLI Citizenship)
**Priority:** Should fix before v1.0 final

This document covers improvements to make `wm` behave like a well-designed Unix CLI tool.

---

## Exit Codes

### Current State

The CLI uses inconsistent exit codes. Most commands exit with 0 on success and 1 on any failure, making it impossible for scripts to distinguish error types.

### Proposed Taxonomy

Adopt a minimal, POSIX-friendly exit code scheme:

| Code | Name | Meaning | When Used |
|------|------|---------|-----------|
| 0 | SUCCESS | Operation completed successfully | Normal completion |
| 1 | FAILURE | Waymark-level error | Lint failures, parse errors, operational failures |
| 2 | USAGE_ERROR | Invalid CLI usage | Bad arguments, missing required flags |
| 3 | CONFIG_ERROR | Configuration problem | Invalid/missing config file |
| 4 | IO_ERROR | File system error | File not found, permission denied |

### Implementation

Create new module:

```typescript
// packages/cli/src/exit-codes.ts
export const ExitCode = {
  SUCCESS: 0,
  FAILURE: 1,
  USAGE_ERROR: 2,
  CONFIG_ERROR: 3,
  IO_ERROR: 4,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

export function exitWithCode(code: ExitCode, message?: string): never {
  if (message) {
    const stream = code === ExitCode.SUCCESS ? process.stdout : process.stderr;
    stream.write(message + "\n");
  }
  process.exit(code);
}
```

### Wire Into Commands

Each command handler should use specific exit codes:

```typescript
// Example: lint command
try {
  const issues = await runLint(paths, config);
  if (issues.length > 0) {
    renderIssues(issues);
    exitWithCode(ExitCode.FAILURE); // Lint failures = 1
  }
  exitWithCode(ExitCode.SUCCESS);
} catch (error) {
  if (error instanceof ConfigError) {
    exitWithCode(ExitCode.CONFIG_ERROR, error.message);
  }
  if (error instanceof IOError) {
    exitWithCode(ExitCode.IO_ERROR, error.message);
  }
  exitWithCode(ExitCode.FAILURE, error.message);
}
```

### Document in Help

Add exit codes section to `--help` output:

```text
EXIT CODES
    0    Success
    1    Waymark error (lint failures, parse errors)
    2    Usage error (invalid arguments)
    3    Configuration error
    4    I/O error (file not found, permission denied)
```

---

## Global Flags

### `--no-input` Flag

**Purpose:** Fail immediately if the command would require interactive input. Essential for CI environments.

```typescript
// packages/cli/src/index.ts
program.option("--no-input", "Fail if interactive input required");

// In command handlers that prompt
if (options.noInput && needsUserInput) {
  exitWithCode(ExitCode.USAGE_ERROR,
    "error: This operation requires input but --no-input was specified");
}
```

### `--quiet` Flag

**Purpose:** Suppress non-essential output. Only errors go to stderr.

```typescript
program.option("-q, --quiet", "Suppress informational output");

// In command handlers
if (!options.quiet) {
  console.log("Scanning 42 files...");
}
```

### `--verbose` Flag (if not present)

**Purpose:** Enable detailed output for debugging.

```typescript
program.option("-v, --verbose", "Enable verbose output");
```

---

## TTY Handling

### Current Issues

- Color output sometimes appears in pipes
- Interactive prompts can hang in CI
- Width detection may fail when not connected to terminal

### Centralized Detection

Create utility module:

```typescript
// packages/cli/src/utils/terminal.ts
import { isatty } from "node:tty";

export interface TerminalInfo {
  isTTY: boolean;
  supportsColor: boolean;
  width: number;
}

export function getTerminalInfo(): TerminalInfo {
  const isTTY = isatty(process.stdout.fd);
  const supportsColor = isTTY && !process.env.NO_COLOR && process.env.TERM !== "dumb";
  const width = isTTY ? process.stdout.columns ?? 80 : 80;

  return { isTTY, supportsColor, width };
}

export function shouldUseColor(): boolean {
  // Respect NO_COLOR environment variable (https://no-color.org/)
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }

  // Respect FORCE_COLOR for testing
  if (process.env.FORCE_COLOR !== undefined) {
    return true;
  }

  return getTerminalInfo().supportsColor;
}

export function canPrompt(): boolean {
  return isatty(process.stdin.fd) && isatty(process.stdout.fd);
}
```

### Usage Pattern

```typescript
import { shouldUseColor, canPrompt, getTerminalInfo } from "./utils/terminal.js";

// Color handling
const chalk = shouldUseColor() ? realChalk : noColorChalk;

// Interactive prompts
if (!canPrompt() && !options.noInput) {
  // Fall back to defaults or fail
}

// Width-aware formatting
const { width } = getTerminalInfo();
const formatted = wrapText(content, width - 4);
```

---

## Error Messages

### Pattern: What + Why + How

Error messages should follow a consistent pattern:

```text
error: <what happened>

  <context/details>

  <what to do about it>

  See: <link or help command>
```

### Examples

**Config error:**

```text
error: Invalid configuration at .waymark/config.toml

  Line 12: Unknown key "id_length"

  Did you mean "ids.length"? Configuration uses nested objects:

    [ids]
    length = 7

  Run: wm doctor --fix-config
```

**File not found:**

```text
error: File not found: src/missing.ts

  The path was specified but does not exist.

  Check the path and try again, or use a glob pattern:

    wm find "src/**/*.ts"
```

**Usage error:**

```text
error: Missing required argument: <paths>

  The find command requires at least one path.

  Usage: wm find <paths...> [options]

  Run: wm find --help
```

### Implementation

```typescript
// packages/cli/src/utils/errors.ts
export interface ErrorDetails {
  what: string;
  context?: string;
  suggestion?: string;
  seeAlso?: string;
}

export function formatError(details: ErrorDetails): string {
  const lines = [`error: ${details.what}`, ""];

  if (details.context) {
    lines.push(`  ${details.context}`, "");
  }

  if (details.suggestion) {
    lines.push(`  ${details.suggestion}`, "");
  }

  if (details.seeAlso) {
    lines.push(`  See: ${details.seeAlso}`);
  }

  return lines.join("\n");
}
```

---

## Flag Consistency

### Audit Current Flags

Review all commands for consistency:

| Pattern | Standard | Current Issues |
|---------|----------|----------------|
| Output format | `--json`, `--jsonl`, `--text` | Some commands lack `--jsonl` |
| File writing | `--write`, `-w` | Consistent |
| Dry run | `--dry-run` | Some use `--check` |
| Verbose | `-v`, `--verbose` | May be missing |
| Quiet | `-q`, `--quiet` | May be missing |

### Standardize

1. All commands outputting data support `--json` and `--jsonl`
2. All commands modifying files support `--dry-run`
3. All commands support `--quiet` for script usage
4. Short flags: `-j` (json), `-q` (quiet), `-v` (verbose), `-w` (write)

---

## `wm complete` Alias

### Current Issue

README documents `wm complete` as backward-compatible alias, but it falls through to scan command instead of completions.

### Location

`packages/cli/src/index.ts:1534-1543`

### Fix

```typescript
const completeCommand = program.commands.find(
  (cmd) => cmd.name() === "completions"
);
if (completeCommand) {
  completeCommand.alias("complete"); // Restore backward-compatible alias
}
```

### Verification

```bash
wm complete zsh | head -5  # Should output shell completion script
wm completions zsh | head -5  # Should produce identical output
```

---

## Checklist

### Exit Codes

- [ ] Create `packages/cli/src/exit-codes.ts`
- [ ] Wire exit codes into `find` command
- [ ] Wire exit codes into `lint` command
- [ ] Wire exit codes into `format` command
- [ ] Wire exit codes into `add` command
- [ ] Wire exit codes into `remove` command
- [ ] Wire exit codes into `doctor` command
- [ ] Add exit codes section to `--help`
- [ ] Add tests for exit code behavior

### Flags

- [ ] Add `--no-input` global flag
- [ ] Add `--quiet` global flag
- [ ] Ensure `--verbose` exists globally
- [ ] Standardize `--jsonl` across all output commands
- [ ] Standardize `--dry-run` across all modifying commands

### TTY/Color

- [ ] Create `packages/cli/src/utils/terminal.ts`
- [ ] Replace ad-hoc TTY checks with centralized utility
- [ ] Respect `NO_COLOR` environment variable
- [ ] Test color output disabled in pipes

### Error Messages

- [ ] Create `packages/cli/src/utils/errors.ts`
- [ ] Audit error messages in major commands
- [ ] Add suggestions for common errors
- [ ] Include help references in errors

### Backward Compatibility

- [ ] Restore `wm complete` alias
- [ ] Verify documented aliases work

---

## Commander.js Migration

### Background

Analysis of the CLI revealed that `add` and `rm` commands bypass Commander.js parsing via `allowUnknownOption(true)` and `allowExcessArguments(true)`, using custom state-machine parsers instead. The `edit` command already uses Commander properly and serves as the model for migration.

**Source analysis:** `.scratch/commander-gap-analysis.md`, `.scratch/commander-migration-add-rm-edit.md`

### Current State

| Command | Uses Commander | Custom Parser | Effort to Migrate |
|---------|----------------|---------------|-------------------|
| `add` | Bypasses | `parseAddArgs()` | Medium |
| `rm` | Bypasses | `parseRemoveArgs()` | Medium |
| `edit` | **Yes** | None | Already done |

### Why Commands Bypass Commander

1. **Ordered positional arguments**: `add` accepts `FILE:LINE TYPE CONTENT` as ordered positionals
2. **Repeatable value options**: `--tag`, `--mention`, `--property` can appear multiple times
3. **Complex property syntax**: `--property owner:@alice` with custom key=value parsing
4. **FILE:LINE parsing**: Custom `lastIndexOf(":")` to handle Windows paths like `C:\path:42`

### Migration Strategy

Adopt **Option B: Documented Hybrid** - Commander handles standard flags while custom parsing handles waymark-specific content. This preserves flexibility while gaining consistency benefits.

#### Phase 1: Define All Options Properly (Low Risk)

Keep custom parsers but define all options in Commander for help text:

```typescript
// Before
.command("add")
.allowUnknownOption(true)
.option("--from <file>", "...") // Only some options defined

// After
.command("add")
.allowUnknownOption(true)  // Still needed initially
.argument("[target]", "FILE:LINE")
.argument("[type]", "Waymark type")
.argument("[content]", "Content text")
.option("--from <file>", "...")
.option("--tag <tag>", "Add tag (repeatable)", collect, [])
.option("--mention <actor>", "Add mention (repeatable)", collect, [])
.option("--property <kv>", "Add property (repeatable)", collect, [])
// ... all options defined
```

**Benefit**: Better `--help` output, tab completion, typo detection

#### Phase 2: Use Commander Parsed Values (Medium Risk)

Replace raw argv extraction with Commander's parsed values:

```typescript
// Before
.action(async function (this: Command, ...actionArgs: unknown[]) {
  const tokens = process.argv.slice(2);
  // ... extract and parse manually
});

// After
.action(async (target, type, content, options) => {
  // Use Commander-provided values directly
  const spec = buildSpecFromOptions(target, type, content, options);
});
```

**Benefit**: Consistent parsing, better error messages

#### Phase 3: Remove Custom Parsers (Higher Risk)

Replace `parseAddArgs()` and `parseRemoveArgs()` with Commander patterns using collector functions:

```typescript
function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

function parseFileLine(value: string): { file: string; line: number } {
  const idx = value.lastIndexOf(":");
  if (idx === -1) throw new InvalidArgumentError("Expected FILE:LINE format");
  return { file: value.slice(0, idx), line: parseInt(value.slice(idx + 1), 10) };
}
```

**Benefit**: Single source of truth, cleaner codebase

### Quick Wins

These can be done in a single PR with minimal risk:

| Quick Win | Effort | Description |
|-----------|--------|-------------|
| Exit code constants | 30 min | Create `exit-codes.ts`, replace hardcoded numbers |
| Use `.hideCommand()` | 15 min | Replace `HIDDEN_COMMANDS` array with native method |
| Add `.choices()` to `--scope` | 15 min | Use Commander's built-in constraint validation |
| SIGINT handler | 15 min | Graceful shutdown with exit code 130 |
| Respect `NO_COLOR` | 15 min | Check env var alongside `--no-color` flag |

### Additional Best Practices to Adopt

From gap analysis, these should be addressed:

| Pattern | Current State | Recommendation |
|---------|---------------|----------------|
| `program.error()` | Manual `writeStderr()` + `process.exit()` | Use Commander's error method |
| `InvalidArgumentError` | Generic `Error` in custom parsers | Import from Commander |
| `.env()` for options | Not used | Add for key options like `WAYMARK_SCOPE` |
| `.implies()` | Not used | Use for related options (e.g., `--graph` implies JSON) |
| Update notifications | Not implemented | Add `update-notifier` for version awareness |
| Progress spinners | Not implemented | Add `ora` for long operations |

### Checklist

#### Phase 1: Option Definitions

- [ ] Define all `add` options in Commander (keep custom parser)
- [ ] Define all `rm` options in Commander (keep custom parser)
- [ ] Use `.hideCommand()` for `fmt`, `lint`
- [ ] Add `.choices()` to `--scope` option

#### Phase 2: Commander Integration

- [ ] Replace `process.argv` extraction with Commander values in `add`
- [ ] Replace `process.argv` extraction with Commander values in `rm`
- [ ] Remove `allowUnknownOption(true)` from both commands
- [ ] Add custom argument parsers for FILE:LINE syntax

#### Phase 3: Cleanup

- [ ] Remove `parseAddArgs()` custom parser
- [ ] Remove `parseRemoveArgs()` custom parser
- [ ] Add `InvalidArgumentError` for validation failures
- [ ] Update tests to verify Commander error messages

#### Polish

- [ ] Add SIGINT/SIGTERM handlers
- [ ] Use `program.error()` consistently
- [ ] Add progress spinners for scan/lint
- [ ] Consider update notifications

---

## Agent Documentation Consolidation

### Background

The CLI maintains multiple overlapping sources of agent-facing documentation:

| File Type | Count | Purpose | Issue |
|-----------|-------|---------|-------|
| `.prompt.txt` | 5 | Agent usage guides | Fragmented, must know command first |
| `.prompt.ts` | 6 | Export wrappers | Boilerplate only |
| `.help.txt` | 3 | Human help text | Duplicates Commander output |
| `--prompt` flag | All commands | Per-command agent help | Awkward discovery |

This creates maintenance burden and risks documentation drift.

### Solution: `wm skill` Command

Consolidate all agent documentation into a modular skill structure and expose it via `wm skill`:

```text
packages/agents/skills/waymark/
├── SKILL.md                              # Core documentation
├── commands/                             # Command-specific guides
│   ├── find.md
│   ├── add.md
│   ├── edit.md
│   ├── rm.md
│   ├── fmt.md
│   └── lint.md
├── references/                           # Technical references
│   ├── schemas.md
│   ├── exit-codes.md
│   └── errors.md
├── examples/                             # Practical examples (NEW)
│   ├── workflows.md                      # Multi-command recipes
│   ├── agent-tasks.md                    # Common agent patterns
│   ├── batch-operations.md               # Bulk operations
│   └── integration.md                    # MCP, CI/CD, editors
└── index.json                            # Manifest
```

Supporting infrastructure:

```text
packages/cli/src/skills/parser.ts        # Markdown/JSON parser
packages/cli/src/commands/skill.ts       # Command handler
```

### Command Interface

```bash
wm skill                         # Show full skill document (markdown)
wm skill --json                  # Output as parsed JSON
wm skill list                    # List available sections (commands, references, examples)
wm skill show <section>          # Show specific section (command or reference)
wm skill show add                # Show add command documentation
wm skill show workflows          # Show example workflows
wm skill show agent-tasks        # Show common agent task patterns
wm skill show batch-operations   # Show batch operation recipes
wm skill show integration        # Show integration guides
wm skill path                    # Print path to skill directory
```

### Skill File Format

**Core document:** Markdown with YAML frontmatter at `SKILL.md`:

```yaml
---
name: waymark
version: 1.0.0
description: Structured code annotations for humans and agents
commands: [find, add, edit, rm, fmt, lint]
references: [schemas, exit-codes, errors]
examples: [workflows, agent-tasks, batch-operations, integration]
capabilities: [scan-waymarks, add-waymarks, edit-waymarks]
---

# Waymark CLI Skill

## Overview
...

## Quick Start
...
```

**Manifest:** `index.json` describes the modular structure:

```json
{
  "name": "waymark",
  "version": "1.0.0",
  "description": "Structured code annotations for humans and agents",
  "structure": {
    "core": "SKILL.md",
    "commands": {
      "find": "commands/find.md",
      "add": "commands/add.md",
      ...
    },
    "references": {
      "schemas": "references/schemas.md",
      "exit-codes": "references/exit-codes.md",
      "errors": "references/errors.md"
    },
    "examples": {
      "workflows": "examples/workflows.md",
      "agent-tasks": "examples/agent-tasks.md",
      "batch-operations": "examples/batch-operations.md",
      "integration": "examples/integration.md"
    }
  }
}
```

### Migration Steps

1. **Create modular skill structure** - Build directories and core SKILL.md
2. **Create command docs** - Consolidate `.prompt.txt` content into `commands/*.md`
3. **Create reference docs** - Add `references/schemas.md`, `exit-codes.md`, `errors.md`
4. **Create example docs** - Add `examples/workflows.md`, `agent-tasks.md`, `batch-operations.md`, `integration.md`
5. **Create manifest** - Build `index.json` with full structure
6. **Implement command** - Add `wm skill` with subcommands and parser
7. **Deprecate `--prompt`** - Add warning, delegate to `wm skill show`
8. **Delete legacy files** - Remove 14 files total

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

### Checklist

#### Structure & Documentation

- [ ] Create `packages/agents/skills/waymark/` directory
- [ ] Create core `SKILL.md` document
- [ ] Create `commands/` directory with command-specific docs
- [ ] Create `references/` directory with technical refs
- [ ] Create `examples/` directory with practical examples
  - [ ] `examples/workflows.md` - Multi-command recipes
  - [ ] `examples/agent-tasks.md` - Common agent patterns
  - [ ] `examples/batch-operations.md` - Bulk operation guide
  - [ ] `examples/integration.md` - MCP, CI/CD, editor integration
- [ ] Create `index.json` manifest file

#### Implementation

- [ ] Create `packages/cli/src/skills/` directory
- [ ] Create `parser.ts` for markdown/JSON parsing
- [ ] Create `skill.ts` command handler with subcommands
- [ ] Register command in `index.ts`
- [ ] Add tests for parser and command
- [ ] Verify `wm skill list` shows all sections and examples

#### Migration

- [ ] Add deprecation warning to `--prompt`
- [ ] Delete `.prompt.txt` files (5 files)
- [ ] Delete `.prompt.ts` files (6 files)
- [ ] Delete `.help.txt` files (3 files)
- [ ] Remove `--prompt` flag handling

#### Documentation

- [ ] Add `wm skill` to command reference
- [ ] Update AGENTS.md to reference skill command
- [ ] Update README to mention `wm skill` for agents

### Design Document

See `skill-command.md` for full design rationale, alternatives
considered, and implementation details
