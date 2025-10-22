<!-- tldr ::: comprehensive command reference for waymark CLI #docs/cli -->

# Waymark Commands Reference

Complete documentation for all `wm` commands, configuration, filtering, and workflows.

> **Quick Start**: See [CLI Installation](./README.md) for setup instructions.

## Quick Reference

```bash
# Scan and display waymarks
wm src/                              # all waymarks in src/
wm src/ --type todo                  # filter by type
wm src/ --raised                     # only ^ (work-in-progress)
wm src/ --starred                    # only * (high-priority)

# Map mode: file tree with TLDRs
wm src/ --map                        # show file tree with summaries
wm docs/ --map --type tldr           # focus on TLDR waymarks

# Graph mode: relation edges
wm src/ --graph                      # extract dependencies
wm src/ --graph --json               # JSON output

# Formatting and validation
wm format src/example.ts --write     # normalize waymark syntax
wm lint src/                         # validate waymarks

# Waymark management
wm add src/auth.ts:42 todo "add rate limiting" --write
wm remove src/auth.ts:42 --write             # or: wm rm
wm modify src/auth.ts:42 --raise --write

# Output formats
wm src/ --json                       # compact JSON
wm src/ --jsonl                      # newline-delimited JSON
wm src/ --text                       # human-readable formatted text

# Configuration
wm init                              # interactive config setup
wm init --format toml --scope project
```

---

## Table of Contents

- [Core Concepts](#core-concepts)
  - [Waymark Grammar](#waymark-grammar)
  - [Signals](#signals)
  - [Types (Markers)](#types-markers)
  - [Properties and Relations](#properties-and-relations)
- [Commands](#commands)
  - [Unified Command (Default)](#unified-command-default)
  - [Format](#format)
  - [Lint](#lint)
  - [Migrate](#migrate)
  - [Init](#init)
  - [Insert/Remove/Modify](#insertremovemodify)
  - [Help](#help)
- [Configuration](#configuration)
  - [Config Files](#config-files)
  - [Scopes](#scopes)
  - [Common Settings](#common-settings)
- [Output Formats](#output-formats)
- [Filtering and Searching](#filtering-and-searching)
- [Display Modes](#display-modes)
- [Common Workflows](#common-workflows)
- [Advanced Topics](#advanced-topics)
- [Troubleshooting](#troubleshooting)

---

## Core Concepts

### Waymark Grammar

A waymark is a structured comment following this pattern:

```text
[comment leader] [signals][type] ::: [content]
```

Examples:

```typescript
// todo ::: implement rate limiting
// *fix ::: validate email format
/* ^wip ::: refactoring auth flow */
// note ::: assumes UTC timezone
```

See [Waymark Grammar](../GRAMMAR.md) for complete grammar details.

### Signals

Signals are optional prefixes that indicate state or priority:

- `^` (caret) — **Raised**: work-in-progress, branch-scoped. Must be cleared before merging.
- `*` (star) — **Starred**: important, high-priority.
- `^*` (combined) — Both raised and starred.

**Important**: Only use single `^` and `*`. Double signals (`^^`, `**`) are not part of the v1 grammar.

### Types (Markers)

Types (formerly called "markers") categorize the waymark's purpose:

**Work / Action**

- `todo` — Task to complete
- `fix` — Bug that needs fixing
- `wip` — Work in progress
- `done` — Completed task
- `review` — Needs review
- `test` — Needs testing
- `check` — Needs verification

**Information**

- `note` — General note
- `context` — Contextual information
- `tldr` — File summary (one per file)
- `this` — Section summary
- `example` — Example usage
- `idea` — Idea or suggestion
- `comment` — General comment

**Caution / Quality**

- `warn` — Warning
- `alert` — Important alert
- `deprecated` — Deprecated code
- `temp` — Temporary code
- `hack` — Temporary workaround

**Workflow**

- `blocked` — Blocked by external dependency
- `needs` — Requires something

**Inquiry**

- `question` — Question or uncertainty

### Properties and Relations

Properties are `key:value` pairs in the content:

```typescript
// todo ::: implement caching owner:@alice priority:high
// fix ::: memory leak depends:#auth/session
// note ::: coordinates with @backend team
```

**Canonical Anchors** (`ref:#token`):

```typescript
// tldr ::: payment processor service ref:#payments/core
```

**Relations** (dependency tracking):

- `depends:#token` — Depends on another waymark
- `needs:#token` — Needs something
- `blocks:#token` — Blocks something
- `dupeof:#token` — Duplicate of another issue
- `rel:#token` — Related to something

**Hashtags** (tags and references):

```typescript
// todo ::: optimize query #perf:hotpath
// fix ::: XSS vulnerability #sec:boundary
```

**Mentions** (ownership and delegation):

```typescript
// todo ::: @agent implement OAuth flow
// review ::: @alice check security implications
```

---

## Commands

### Unified Command (Default)

The default `wm` command intelligently handles scanning, filtering, mapping, and graphing based on flags.

#### Basic Usage

```bash
# Scan current directory
wm

# Scan specific paths
wm src/ tests/

# Filter by type
wm src/ --type todo
wm src/ --type fix --type wip

# Filter by signals
wm src/ --raised                     # only ^ waymarks
wm src/ --starred                    # only * waymarks

# Filter by tags
wm src/ --tag perf
wm src/ --tag "#sec:boundary"

# Filter by mentions
wm src/ --mention @agent
wm src/ --mention @alice

# Combine filters (AND logic)
wm src/ --type todo --mention @agent --tag perf
```

#### Map Mode

Display file tree with TLDR summaries:

```bash
# Basic map
wm src/ --map

# Filter map by type
wm src/ --map --type tldr

# Show summary footer
wm src/ --map --summary

# JSON output
wm src/ --map --json
```

#### Graph Mode

Extract dependency relations:

```bash
# Text graph
wm src/ --graph

# JSON output
wm src/ --graph --json

# Formatted text
wm src/ --graph --text
```

#### Output Formats

```bash
# Default text output
wm src/

# JSON formats
wm src/ --json                       # compact JSON array
wm src/ --jsonl                      # newline-delimited JSON
wm src/ --text                       # human-readable formatted text
```

#### Display Options

```bash
# Context lines (ripgrep-style)
wm src/ --context 3                  # 3 lines before/after
wm src/ -C 5                         # 5 lines of context
wm src/ -A 2                         # 2 lines after
wm src/ -B 2                         # 2 lines before

# Grouping
wm src/ --group file                 # group by file
wm src/ --group type                 # group by type
wm src/ --group dir                  # group by directory

# Sorting
wm src/ --sort file                  # sort by file path
wm src/ --sort line                  # sort by line number
wm src/ --sort type                  # sort by type

# Pagination
wm src/ --limit 10                   # show first 10 results
```

### Format

Normalize waymark syntax (spacing, case, property order):

```bash
# Preview changes
wm format src/example.ts

# Apply changes
wm format src/example.ts --write

# Format multiple files
wm format src/**/*.ts --write

# Format with specific config
wm format src/ --write --config-path .waymark/config.toml
```

**What it does:**

- Normalizes spacing around `:::`
- Lowercases types
- Aligns multi-line continuations
- Orders properties consistently
- Strips signals on protected branches (if configured)

### Lint

Validate waymark structure and rules:

```bash
# Lint files
wm lint src/

# JSON output
wm lint src/ --json

# With specific config
wm lint src/ --config-path .waymark/config.toml
```

**What it checks:**

- Valid type names
- Duplicate properties
- Unknown types (unless allowlisted)
- Dangling relations (references to non-existent canonicals)
- Duplicate canonical tokens
- Signals on protected branches

### Migrate

Convert legacy TODO/FIXME comments to waymark syntax:

```bash
# Preview migration
wm migrate src/legacy.ts

# Apply migration
wm migrate src/legacy.ts --write

# Migrate with custom mapping
wm migrate src/ --write --include-legacy
```

**Converts:**

- `// TODO: fix bug` → `// todo ::: fix bug`
- `# FIXME: memory leak` → `# fix ::: memory leak`
- `<!-- NOTE: deprecated -->` → `<!-- note ::: deprecated -->`

### Init

Bootstrap waymark configuration:

```bash
# Interactive setup
wm init

# Non-interactive with flags
wm init --format toml --scope project --preset full

# Overwrite existing
wm init --force
```

**Options:**

- `--format` — Config format: `toml`, `jsonc`, `yaml`, `yml` (default: `toml`)
- `--preset` — Config preset: `full`, `minimal` (default: `full`)
- `--scope` — Config scope: `project`, `user` (default: `project`)
- `--force` — Overwrite existing config

**What it does:**

- Creates `.waymark/config.*` (project scope) or `~/.config/waymark/config.*` (user scope)
- Adds `.waymark/index.json` to `.gitignore` (project scope only)
- Uses interactive prompts when no flags provided

### Insert/Remove/Modify

For detailed documentation on waymark management commands, see [Waymark Editing Guide](./waymark_editing.md).

**Quick examples:**

```bash
# Insert waymark
wm add src/auth.ts:42 todo "add rate limiting" --write

# Remove waymark
wm remove src/auth.ts:42 --write              # or: wm rm src/auth.ts:42 --write

# Modify waymark signals
wm modify src/auth.ts:42 --raise --write
wm modify src/auth.ts:42 --star --write
wm modify src/auth.ts:42 --unraise --unstar --write
```

### Help

Display help for commands:

```bash
# General help
wm help

# Command-specific help
wm help format
wm help insert
wm help remove                       # or: wm help rm
```

---

## Configuration

### Config Files

Waymark supports multiple config formats:

- **TOML** (preferred): `.waymark/config.toml`
- **JSONC** (JSON with comments): `.waymark/config.jsonc`
- **YAML**: `.waymark/config.yaml` or `.waymark/config.yml`

Config files are discovered in this order:

1. Explicit path via `--config-path` flag
2. `WAYMARK_CONFIG_PATH` environment variable
3. Project config: `.waymark/config.*` (searches for `.toml`, `.jsonc`, `.yaml`, `.yml` in that order)
4. User config: `~/.config/waymark/config.*`
5. Built-in defaults

### Scopes

**Project scope** (default):

- Config: `.waymark/config.*` in repository root
- Committed to version control
- Shared across team

**User scope**:

- Config: `~/.config/waymark/config.*`
- Applies to all repositories for current user
- Not committed to version control

**Local scope** (advanced):

- Config: `~/.config/waymark/local/<fingerprint>.jsonc`
- Directory-specific overrides
- Never committed

### Common Settings

Example TOML config:

```toml
type_case = "lowercase"              # lowercase | uppercase
id_scope = "repo"                    # repo | file
protected_branches = ["main", "release/*"]
signals_on_protected = "strip"       # strip | fail | allow

allow_types = [
  "todo", "fix", "wip", "done",
  "note", "context", "tldr", "this",
  "warn", "deprecated"
]

skip_paths = [
  "**/dist/**",
  "**/.git/**",
  "**/node_modules/**"
]

[format]
space_around_sigil = true
normalize_case = true
align_continuations = true

[lint]
duplicate_property = "warn"          # warn | error | ignore
unknown_marker = "warn"
dangling_relation = "error"
duplicate_canonical = "error"

[groups]
agents = [
  "@agent", "@claude", "@codex",
  "@cursor", "@copilot", "@devin"
]
eng = ["@alice", "@bob"]
```

---

## Output Formats

### Text (Default)

Human-readable output with file grouping and syntax highlighting:

```bash
wm src/
```

Output:

```text
src/auth.ts
    42  todo ::: implement rate limiting
    56  *fix ::: validate email format

src/utils.ts
    12  note ::: assumes UTC timezone
```

### JSON

Compact JSON array:

```bash
wm src/ --json
```

Output:

```json
[
  {
    "file": "src/auth.ts",
    "startLine": 42,
    "endLine": 42,
    "type": "todo",
    "contentText": "implement rate limiting",
    "signals": { "raised": false, "important": false }
  }
]
```

### JSONL

Newline-delimited JSON (one record per line):

```bash
wm src/ --jsonl
```

Output:

```jsonl
{"file":"src/auth.ts","startLine":42,"type":"todo","contentText":"implement rate limiting"}
{"file":"src/auth.ts","startLine":56,"type":"fix","contentText":"validate email format"}
```

### Formatted Text

Human-readable formatted text output:

```bash
wm src/ --text
```

---

## Filtering and Searching

### Type Filters

Filter by waymark type:

```bash
wm src/ --type todo
wm src/ --type todo --type fix        # OR logic (todo OR fix)
```

### Signal Filters

Filter by signals:

```bash
wm src/ --raised                      # only ^ waymarks
wm src/ --starred                     # only * waymarks
wm src/ --raised --starred            # both raised AND starred
```

### Tag Filters

Filter by hashtags:

```bash
wm src/ --tag perf
wm src/ --tag "#sec:boundary"
wm src/ --tag perf --tag sec          # OR logic
```

### Mention Filters

Filter by actor mentions:

```bash
wm src/ --mention @agent
wm src/ --mention @alice
wm src/ --mention @agents             # expands to configured group
```

### Relation Filters

Filter by dependencies:

```bash
wm src/ --depends "#auth/session"
wm src/ --blocks "#payments/stripe"
wm src/ --rel "#cache/redis"
```

### Combining Filters

Filters use AND logic across different types:

```bash
# Find TODOs for @agent tagged with #perf
wm src/ --type todo --mention @agent --tag perf

# Find raised FIX waymarks blocking #payments
wm src/ --raised --type fix --blocks "#payments"
```

---

## Display Modes

### Flat Display (Default)

Simple list grouped by file:

```bash
wm src/
```

### Long Display

Show full waymark details:

```bash
wm src/ --long
```

### Tree Display

Hierarchical directory tree:

```bash
wm src/ --tree
```

### Context Display

Show surrounding lines (ripgrep-style):

```bash
wm src/ --context 3                   # 3 lines before/after
wm src/ -C 3                          # short form
wm src/ -A 2 -B 1                     # 2 after, 1 before
```

---

## Common Workflows

### Daily Standup

Find all TODOs assigned to you:

```bash
wm src/ --type todo --mention @yourname
```

### Pre-Merge Checklist

Ensure no raised waymarks before merging:

```bash
wm src/ --raised
# Should return no results
```

### Code Review

Find all review waymarks:

```bash
wm src/ --type review
```

### Hotspot Analysis

Find performance-critical sections:

```bash
wm src/ --tag "#perf:hotpath"
```

### Security Audit

Find security-related waymarks:

```bash
wm src/ --tag sec
```

### Dependency Tracking

View dependency graph:

```bash
wm src/ --graph
```

### Documentation Summaries

List all file TLDRs:

```bash
wm src/ --map --type tldr
```

### Agent Task List

Find all work delegated to agents:

```bash
wm src/ --type todo --mention @agent
```

---

## Advanced Topics

### ID Management

Waymark IDs (`wm:abc123`) are opt-in. Enable them via:

```bash
wm add src/auth.ts:42 todo "fix bug" --id --write
```

IDs are tracked in `.waymark/index.json` (gitignored).

For removed waymarks, history is optionally stored in `.waymark/history.json`.

See [Waymark Editing Guide](./waymark_editing.md) for details.

### Custom Types

Add custom types via config:

```toml
allow_types = ["todo", "fix", "custom", "mytodo"]
```

Without allowlisting, custom types trigger lint warnings.

### Protected Branch Policy

Enforce signal policies on protected branches:

```toml
protected_branches = ["main", "release/*"]
signals_on_protected = "strip"       # strip | fail | allow
```

- `strip` — Automatically remove signals when formatting
- `fail` — Fail lint on protected branches with signals
- `allow` — Allow signals (no enforcement)

### Actor Groups

Define actor groups for batch filtering:

```toml
[groups]
agents = ["@agent", "@claude", "@codex"]
backend = ["@alice", "@bob"]
frontend = ["@charlie", "@dana"]
```

Use groups in filters:

```bash
wm src/ --mention @agents             # matches all agent handles
```

---

## Troubleshooting

### No Waymarks Found

**Symptom**: `wm src/` returns no results

**Solutions**:

- Verify waymarks use `:::` sigil: `rg ':::' src/`
- Check if paths are skipped: review `skip_paths` in config
- Ensure file extensions are recognized

### Lint Errors

**Symptom**: `wm lint` reports errors

**Common issues**:

- Unknown types: Add to `allow_types` in config
- Duplicate canonicals: Search with `rg 'ref:#token'`
- Dangling relations: Ensure canonical exists with `rg 'ref:#token'`

### Format Not Working

**Symptom**: `wm format --write` doesn't change files

**Solutions**:

- Verify file is writable
- Check if file is in `skip_paths`
- Review format config settings

### Config Not Loading

**Symptom**: Config changes not taking effect

**Solutions**:

- Verify config file format (valid TOML/JSONC/YAML)
- Check config discovery order (explicit path > env var > project > user)
- Use `--config-path` to override discovery

### Performance Issues

**Symptom**: `wm` is slow on large repos

**Solutions**:

- Add more skip patterns for build artifacts
- Use specific paths instead of repo root
- Consider `--limit` flag for large result sets

---

## See Also

- [CLI Installation](./README.md) — Installation and quick start
- [Waymark Editing](./waymark_editing.md) — Insert, remove, and modify waymarks
- [Waymark Grammar](../GRAMMAR.md) — Grammar reference
- [How-To Guides](../howto/README.md) — Practical usage examples
- [MCP Server Documentation](../../README.md#mcp-server) — Agent integration
- [Project README](../../README.md) — Overview and quick start
