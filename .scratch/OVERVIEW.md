<!-- tldr ::: comprehensive orientation to waymark grammar, tooling, repo layout, and workflows (assumes v1 plan implemented) -->

# Waymark Project Overview

This document is a deep, single-stop orientation for agents and contributors. It aims to answer: what Waymark is, how it is used, how the tooling works, where the code lives, and how to operate in this repo. It assumes the v1 plan in `.agents/plans/v1/PLAN.md` has been implemented (JSONL support, updated lint rules, legacy codetag handling, block comment policy, directory-aware format, history tracking, protected-branch policy removal).

## Executive Summary

Waymark is a minimal, language-agnostic comment grammar plus tooling that makes code annotations durable, greppable, and automation-friendly. It standardizes familiar patterns (TODO/FIXME/NOTE) into a predictable `:::`-based format so humans and agents can scan, parse, and act on context without needing ASTs.

Key points:

- Grammar is tiny: `[comment-leader] [signals][type] ::: [content]`.
- Core use cases: file summaries (`tldr`), section summaries (`this`), tasks (`todo`), fixes (`fix`), context (`note`, `context`).
- Tooling includes a CLI (`wm`), a core library, and an MCP server for agents.
- Waymarks are not docstrings and must live outside docstrings.
- Grep-first is non-negotiable: `rg ':::'` is the baseline discovery tool.

## Project Status and Rebuild Context

- This project is in a rebuild phase focused on documentation clarity and grep-first usage before heavy tooling re-expansion.
- Work is currently scoped to the `gt/v1.0/rewrite` branch.
- The old implementation is archived in `~/Developer/outfitter/waymark-old` and `outfitter-dev/waymark-old` (archive branch: `archive/pre-rebuild-2025-01`).
- Historical notes and prior plans live in `.agents/.archive/`.
- Current prerelease in README is `1.0.0-beta.1` (2025-10-03), with the plan aiming for a `v1.0.0-beta.2` or `v1.0.0-rc.1` release once alignment is complete.

## What Waymark Is (and Is Not)

### What It Is

- A structured comment system using a single sigil (`:::`) and a tiny grammar.
- A shared shorthand for humans and AI agents to communicate intent, context, and next steps.
- A portable, language-agnostic annotation format that survives refactors.

### What It Is Not

- Not a docstring or documentation replacement.
- Not a workflow or issue tracking system.
- Not AST-dependent or language-specific.
- Not a rich markup language.

Waymark keeps the surface area intentionally small to maintain longevity and simplicity.

## Core Grammar

### Line Form

```text
[comment-leader] [signals][type] ::: [content]
```

- **Comment leader**: `//`, `#`, `--`, `<!-- -->`, or `/* */` (restricted).
- **Signals**: `^` (raised), `*` (starred). Combined form is `^*`.
- **Type**: lowercase marker keyword (`todo`, `fix`, `note`, `tldr`, `this`, etc.).
- **Sigil**: literal `:::` delimiter.
- **Content**: free text plus structured tokens.

### Spacing Rules

- Exactly one space before and after `:::` when a type is present.
- Parsers tolerate extra whitespace; formatters normalize to the canonical form.

### Comment Leader Policy

- Line comments are preferred in any language that supports them.
- Block comments (`/* */`) are allowed only for languages that lack line comments (for example, CSS).
- Documentation uses HTML comments (`<!-- ... -->`).
- Waymarks must never live inside docstrings or string literals.

### Signals

- `^` (raised): work-in-progress, intended to be cleared before merge.
- `*` (starred): high-priority or important.
- Only one caret and one star are valid. No `!!`, `**`, or stacked signals.

### Blessed Types (Markers)

Work and action:

- `todo`, `fix`, `wip`, `done`, `review`, `test`, `check`

Information:

- `note`, `context` (alias: `why`), `tldr`, `this`, `example`, `idea`, `comment`

Caution and quality:

- `warn`, `alert`, `deprecated`, `temp` (alias: `tmp`), `hack`

Workflow:

- `blocked`, `needs`

Inquiry:

- `question` (alias: `ask`)

Custom types are allowed only if explicitly allowlisted; unknown types are linted.

### Multi-line Waymarks

Use markerless `:::` continuation lines:

```ts
// todo ::: refactor auth flow
//      ::: keep backward compatibility
//      ::: coordinate with @devops
```

Property continuations are supported:

```ts
// tldr  ::: payment processor service
// ref   ::: #payments/core
// owner ::: @alice
```

## Tokens in Content

Waymark content is free text, but tooling extracts structured tokens:

### Properties

- `key:value` pairs, with optional quoted values.
- Duplicate keys are allowed but last value wins (lint warns).

Example:

```ts
// todo ::: implement caching owner:@alice priority:high
// note ::: reason:"waiting on API approval"
```

### Canonicals and Relations

- Canonical anchor: `ref:#token` (declares the authoritative anchor).
- Relations: `depends:#token`, `needs:#token`, `blocks:#token`, `dupeof:#token`, `rel:#token`.

Example:

```ts
// tldr ::: payments entrypoint ref:#payments/core
// todo ::: add refund flow depends:#payments/core
```

### Tags (Hashtags)

- `#token` acts as a tag or reference.
- Namespaces are encouraged (`#docs/*`, `#perf:*`, `#sec:*`, `#arch/*`).

### Mentions (Actors)

- Mentions use `@handle`.
- The first mention after `:::` is treated as ownership.
- Actor groups can be configured (for example, `@agents`).

Example:

```ts
// todo ::: @agent add rate limiting #sec:boundary
```

## TLDR and THIS

- `tldr` is the file-level summary. Exactly one per file, near the top.
- `this` is a section-level summary placed immediately before the relevant code block.
- TLDRs should be 8-14 words, active voice, and end with a key detail or tag.

## Docstring Compatibility

Waymarks are separate from docstrings.

- Docstring first, waymark second (or vice versa), but never inside.
- For documentation files use HTML comments (`<!-- ... -->`).
- Waymark content should mirror docstring intent without duplicating or replacing it.

Example:

```ts
/**
 * Sanitizes a payload before verification.
 */
// this ::: normalizes webhook data into canonical shape #payments/stripe
export function normalize(payload: Payload) { /* ... */ }
```

## Tooling Overview

### CLI (`wm`)

The CLI is the primary interface for scanning, formatting, and managing waymarks.

Core commands:

- `wm` / `wm find` - scan and filter waymarks
- `wm format` - normalize spacing, casing, and continuation alignment
- `wm lint` - enforce structural rules and policy checks
- `wm map` - summarize TLDRs into a repo map
- `wm graph` - extract dependency relations
- `wm add` - insert waymarks at file:line positions
- `wm remove` - delete waymarks (with optional history tracking)
- `wm modify` - update signals on existing waymarks
- `wm init` - bootstrap configuration
- `wm completions` - generate shell completions

Output formats:

- `--text` (default)
- `--json` (array)
- `--jsonl` (one record per line)

Common filters (examples):

```bash
wm src/ --type todo --mention @agent
wm src/ --raised
wm src/ --tag "#sec:boundary"
wm src/ --graph --json
```

### Formatting

- Accepts files, directories, and globs.
- Honors `skip_paths` from config.
- Skips files containing a `waymark-ignore-file` marker near the top.
- Prefers line comments for languages that support them.

### Lint Rules (Named)

Implemented v1 rules:

- `unknown-marker` - type not allowlisted
- `duplicate-property` - property key repeated
- `multiple-tldr` - more than one TLDR per file
- `legacy-pattern` - TODO/FIXME/NOTE/HACK/XXX codetags

Optional rule:

- `prefer-line-comment` - warns if block comments are used in languages that have line comments

### Legacy Codetags

Legacy TODO/FIXME style comments are handled by lint and scanning:

- `legacy-pattern` lint rule detects them and suggests Waymark equivalents.
- `scan.include_codetags` config option allows `wm find` to surface them as legacy records.
- Dedicated `wm migrate` is removed (legacy handling is now part of lint/scan workflows).

### ID and History Tracking

- `wm add` can assign optional IDs (`wm:<hash>`) tracked in `.waymark/index.json`.
- `wm remove` writes deletion history to `.waymark/history.json` with optional `--reason` metadata.
- Index and history files are gitignored by default.

## MCP Server (Agent Integration)

Waymark ships an MCP server for automation via stdio:

- Tools: `waymark.scan`, `waymark.graph`, `waymark.insert`
- Resources: `waymark://todos`
- Prompts: `waymark.tldr`, `waymark.todo`

The MCP server accepts the same configuration options as the CLI (`configPath`, `scope`) so agents respect local project settings. It returns JSON and JSONL for deterministic automation.

## Data Model

Waymark records follow the JSON schema in `schemas/waymark-record.schema.json`. Key fields include:

```json
{
  "file": "src/auth.ts",
  "startLine": 42,
  "endLine": 42,
  "type": "todo",
  "contentText": "add rate limiting",
  "signals": { "raised": false, "important": true },
  "properties": { "owner": "@alice" },
  "mentions": ["@agent"],
  "tags": ["#sec:boundary"],
  "canonicals": ["#auth/service"],
  "relations": [{ "kind": "depends", "token": "#auth/service" }],
  "commentLeader": "//",
  "raw": "// *todo ::: add rate limiting owner:@alice"
}
```

## Configuration

Config lives in `.waymark/config.*` and can be TOML, JSONC, or YAML.

Common settings:

- `allow_types` - allowlist for markers
- `skip_paths` - glob patterns to ignore during scanning/formatting
- `format.align_continuations` - align continuation `:::` columns
- `scan.include_codetags` - surface legacy TODO/FIXME comments
- `groups` - actor groups for mention filters (`@agents`, `@backend`)

Config discovery order:

1. `--config-path`
2. `WAYMARK_CONFIG_PATH`
3. `.waymark/config.*` in repo root
4. `~/.config/waymark/config.*`

## Repo Structure

This is a Bun + TypeScript monorepo. Key areas:

- `packages/grammar` - tokenizer and parser
- `packages/core` - formatting, search, graph, config, insert/remove
- `packages/cli` - CLI entrypoint and commands
- `apps/mcp` - MCP server
- `docs/` - published documentation (grammar, CLI, how-to, architecture)
- `.waymark/` - repo-specific rules and conventions
- `.agents/` - agent instructions, plans, and archives
- `schemas/` - JSON schemas

## Development Workflow and Conventions

### Branching and PRs

- Trunk-based development with short-lived branches.
- Use Graphite (`gt`) for stack management when the repo is Graphite-synced.
- Default to branches (avoid direct commits to `main`).
- Conventional commits required.

### Pre-push Checks

Run these before pushing:

```bash
bun ci:local
bun check:all
bun ci:validate
```

### Documentation Rules

- Every markdown doc should start with a `<!-- tldr ::: ... -->` line.
- Use `<!-- ... -->` for documentation waymarks.
- Keep docs scannable and link related documents.

### Repo-Specific Waymark Rules

- Follow `.waymark/rules/WAYMARKS.md` and companion rules (`TLDRs.md`, `THIS.md`, `DOCSTRING-COMPATIBILITY.md`).
- Maintain consistent tag namespaces (see `.waymark/rules/CONVENTIONS.md`).
- Use `rg ':::'` and related patterns to audit usage.

## Typical Workflow

1. Add a file TLDR at the top.
2. Add `this` markers above major sections.
3. Use `todo`, `fix`, or `note` for tasks and context.
4. Format and lint:

```bash
wm format src/ --write
wm lint src/
```

5. Extract a map or graph when needed:

```bash
wm map src/ --text
wm graph src/ --json
```

6. Use `rg ':::'` for fast grep-first discovery.

## Historical Context

Waymark draws on decades of comment-level anchors across ecosystems (TODO, FIXME, MARK, NOLINT, go:build). v1 consolidates those patterns into a minimal grammar and toolchain focused on grep-first discoverability and automation friendliness. Historical notes and prior planning docs are archived in `.agents/.archive/`.

## Glossary

- **Waymark**: A structured comment that follows the `:::` grammar.
- **Sigil**: The literal `:::` delimiter separating type from content.
- **Type (Marker)**: The lowercase keyword describing intent (for example `todo`, `fix`, `tldr`).
- **Signal**: Optional prefix indicating state or priority (`^` raised, `*` starred).
- **Raised**: `^` signal; marks work-in-progress that should clear before merge.
- **Starred**: `*` signal; marks high-priority or important notes.
- **Comment leader**: The language-specific comment prefix (`//`, `#`, `--`, `<!-- -->`, or `/* */`).
- **Content**: Free text after the sigil; may include structured tokens.
- **Property**: `key:value` token inside content (for example `owner:@alice`).
- **Canonical**: The authoritative anchor declared with `ref:#token`.
- **Reference**: Any other use of a canonical token (bare `#token` or relation property).
- **Relation**: Dependency or linkage property (`depends:#token`, `blocks:#token`, etc.).
- **Tag**: A hashtag token like `#perf:hotpath` or `#docs/guide`.
- **Mention (Actor)**: `@handle` token; first mention after `:::` implies ownership.
- **TLDR**: File-level summary; exactly one per file.
- **THIS**: Section-level summary placed immediately above the section.
- **Continuation**: Markerless `:::` line that extends the previous waymark.
- **Legacy codetag**: Old patterns like `TODO:` or `FIXME:` surfaced via lint/scan.
- **Format**: CLI normalization of spacing, case, and continuation alignment.
- **Lint**: CLI validation of rule compliance (unknown markers, duplicates, etc.).
- **Map**: TLDR aggregation view of the repo.
- **Graph**: Relation extraction into edges between canonicals.
- **MCP**: Model Context Protocol server that exposes Waymark tools to agents.
- **Config scope**: Where config is loaded from (project, user, local override).
- **Skip paths**: Glob patterns excluded from scans/formatting.
- **ID (WID)**: Optional `wm:<hash>` identifier stored in content and index.
- **Index**: `.waymark/index.json` registry of known waymarks and IDs.
- **History**: `.waymark/history.json` tombstone log for removals.
- **Waymark ignore file**: A top-of-file marker that opts the file out of formatting.
- **Grep-first**: The principle that `rg ':::'` should find everything.

## Recommended Reading

- `README.md` - top-level overview and quickstart
- `docs/GRAMMAR.md` - full grammar specification
- `.waymark/rules/WAYMARKS.md` - repo usage rules
- `.waymark/rules/DOCSTRING-COMPATIBILITY.md` - docstring guidance
- `docs/cli/commands.md` - CLI command reference
- `docs/ARCHITECTURE.md` - codebase architecture
- `docs/about/priors.md` - historical priors
- `.agents/plans/v1/PLAN.md` - release alignment plan (assumed implemented)
