# Waymark v1.0 PRD

## Executive Summary

Waymark is a minimal, language‑agnostic way of embedding **lightweight code-adjacent context** in comments marked by the `:::` sigil. Developers and AI agents leave structured comments—**waymarks**—that are trivially greppable and richly parseable. Waymark v1.0 defines:

- A single, predictable comment form: **`[signal][marker] ::: [content]`**
- A tiny anchor model for cross‑file wayfinding: **canonicals via `ref:#token`** and references via **hashtags** and **relation properties**
- A Bun/TypeScript reference implementation: **CLI** (scan/find/fmt/lint/graph/map/migrate) + JSON output for agents
- A linter/formatter that normalizes spacing/case, validates structure, and enforces simple, configurable policies

Waymark prioritizes grep‑first utility while remaining AI‑native. It standardizes common, ad‑hoc patterns (TODOs, FIXMEs, inline ownership, review notes) into a durable, low‑ceremony grammar that tools can index at scale.

> **Release status:** Preparing prerelease **v1.0.0-beta.1** (2025-10-03) with hardened insert/remove flows and JSON index lifecycle.

## Goals

- **Greppable by default:** Every waymark is discoverable with plain text search.
- **Durable & minimal:** Survives refactors, formatting, and language shifts; no AST required.
- **Human‑AI collaboration:** Simple structure that coding agents can reliably parse and act upon.
- **Language‑agnostic:** Works in any language with comments; no runtime dependencies in app code.
- **Predictable tooling:** CLI + linter/formatter with stable JSON schema for downstream automation.

### Non‑Goals

- Complex data models in comments (no nested maps/arrays)
- Typed link schemes inside comments (no `[[pr:#123]]`, `[[file:...]]`, etc.)
- Enforcing project workflow (Waymark records data; your process decides what to do with it)

## Background & Justification

**From v2.0 to v1.0 (stability pass):** Earlier drafts explored `[[wikilink]]` with typed schemes and an experimental `##anchor/#anchor` model. While powerful, they increased grammar surface area and overlapped with properties already in the content. v1.0 consolidates on a smaller anchor model:

- **Canonicals** use `ref:#token` (optional; typically on `tldr` or `this`).
- **References** use hashtags (`#token`) or relation properties (`depends:#token`, `needs:#token`, etc.).
- **Namespaces** are free‑form (`#area/name`, `#area.name`) to avoid collisions and organize anchors.

This preserves the "one grep finds all" feel (searching `#token` surfaces references; searching `ref:#token` finds canonicals) without bloating the grammar. It also leaves `id:` free for future work.

## Definitions & Terminology

- **Waymark:** A structured comment in source files following `signal? + marker + ' ::: ' + content`.
- **Signal:** Optional prefix indicating state/priority: `^` (raised), `*` (starred). When combined, `^` precedes `*`.
- **Marker:** Single word describing intent/purpose (e.g., `todo`, `fix`, `note`). Case normalized by formatter.
- **Sigil:** The literal `:::` separating marker from content.
- **Content:** Free text after the sigil; may contain properties, hashtags, mentions.
- **Property:** `key:value` pair embedded in content (e.g., `owner:@alice`, `ref:#payments/core`).
- **Hashtag:** `#` followed by a token; used as tag or reference (namespaced allowed).
- **Canonical:** The authoritative declaration of a token: `ref:#token`.
- **Reference:** Any other use of that token (bare `#token` or relation property).

## Waymark Grammar

### Line Form

```text
[comment-leader] [signal][marker] ::: [content]
```

- **Always comments:** Waymarks appear only in comment tokens, never string literals/docstrings.
- **Grep‑first:** The `:::` sigil is the reliable delimiter.
- **Parse‑tolerant, format‑strict:** Parser accepts extra horizontal whitespace; formatter normalizes to exactly one space around `:::` when a marker is present.

#### Examples

```ts
// todo ::: add rate limiting
// *fix ::: validate email format
/* ^wip ::: implementing JWT generation */
// note ::: assumes UTC timezone
```

### Signals

- `^` (caret) — marks waymarks as raised (work-in-progress, branch-scoped)
- `*` (star) — marks waymarks as starred (important, high-priority)
- Order when combined: caret precedes star (`^*`, e.g., `^*todo`). Double intensity marks (e.g., `**`) are not part of the v1 grammar; use a single `*` only.

### Markers (Blessed)

**Work/Action:** `todo`, `fix` (alt: `fixme`), `wip`, `done`, `review`, `test`, `check`
**Information:** `note`, `context` (alt: `why`), `tldr`, `this`, `example`, `idea`, `comment`
**Caution/Quality:** `warn`, `alert`, `deprecated`, `temp` (alt: `tmp`), `hack` (alt: `stub`)
**Workflow:** `blocked`, `needs`
**Inquiry:** `question` (alt: `ask`)

- **`tldr`** — File‑level summary; at topmost valid position (after shebang/front‑matter/header comments). One per file.
- **`this`** — Section/block summary; multiple per file.
- Custom markers allowed; tooling may warn unless allowlisted.

**Writing `tldr` lines (recommended style):**

- One sentence, 8‑14 words, active voice describing what the file delivers.
- Lead with the capability, end with the key tech/constraints for grepability.
- Avoid vague nouns (“module”, “utilities”); replace with concrete verbs and nouns.
- Example: `// tldr ::: Stripe webhook handler verifying signatures and enqueuing retries`.
- For documentation files (PRDs, guides) mirror the same rule in HTML comments: `<!-- tldr ::: Bun-based CLI PRD defining v1.0 scope and requirements #docs -->`.
- Tag doc summaries with `#docs` (and optional `#docs/prd`, `#docs/guide`) so tooling can filter content-oriented waymarks.

### Properties

- Form: `key:value`.
- Keys: `[A-Za-z][A-Za-z0-9_-]*`.
- Values: unquoted (**no spaces**) or double‑quoted to include spaces; escapes `\` and `\"` inside quoted values.
- Duplicate keys: **last wins**; linter warns on duplicates.

#### Canonical & Relations (Anchor Model)

- **Canonical:** `ref:#token` — authoritative anchor declaration (optional; typically on `tldr`/`this`).
- **References:**

  - **Bare reference:** `#token` in content (soft association)
  - **Explicit soft relation:** `rel:#token`
  - **Dependency relations:** `depends:#token`, `needs:#token`, `blocks:#token`, `dupeof:#token`

- **Relational properties always keep the hash on the value:** `fixes:#payments/stripe-webhook`, `affects:#billing.core`, `depends:#infra/cache`. Arrays remain comma-separated with no spaces (`affects:#billing,#auth/api`). The key never carries a hash prefix.
- Use namespaced doc anchors when needed: `ref:#docs/prd/waymark-v1` on the canonical TLDR, downstream references via `rel:#docs/prd/waymark-v1` or `affects:#docs/guide/migration`.

**Token grammar:** `#` + `[A-Za-z0-9._/-]+` (case‑insensitive; formatter lowercases). Namespacing with `/`, `:`, or `.` is encouraged for clarity.

#### Mentions & Tags

- **Mentions:** `@alice`, `@agent` — free tokens inside content; tools may route tasks.
- **Hashtags:** Any `#` followed by a run of non‑whitespace characters (`[A-Za-z0-9._/:%-]+`) is treated as a tag/reference, regardless of embedded delimiters (`#perf:hotpath`, `#payments/stripe-webhook`). The presence of the hash alone distinguishes tags from properties.

#### Agent Delegation (AI Actors)

Use `@agent` as the **first token after `:::`** when the task is meant for a generic automation-capable agent.

```ts
// todo ::: @agent implement user authentication #sec:boundary #hotpath
// *todo ::: @agent harden JWT verification #sec:auth #perf
// review ::: @agent check for SQL injection vulnerabilities #gateway/api
// test ::: @agent add regression coverage for negative balances
```

- Leading `@agent` assigns ownership to an AI helper; signals (`^`, `*`) still convey urgency or scope.
- Additional actors can appear later in the prose for coordination (`// todo ::: @agent ship retry logic with review from @alice`).
- If `@agent` appears later in the sentence, treat it as a mention only; ownership stays with the first actor token.

#### Actor Namespace & Groups

- Actor handles are freeform. Use specific agent names (`@codex`, `@claude`, `@gemini`) when delegating to a known capability; fall back to `@agent` for "any capable agent".
- The tooling reads actor groups from Waymark configs (`.waymark/config.(jsonc|yaml|yml|toml)` or their user-scoped equivalents in `~/.config/waymark/`):
  - Example: `groups.agents = ["@agent", "@claude", "@codex", "@cursor", "@copilot", "@devin", "@factory", "@gemini", "@jules"]`.
  - Example: `groups.eng = ["@alice", "@bob", "@frontend", "@backend"]`.
- CLI search expands group identifiers automatically (`waymark find --actor @agents` matches every member). Default presets ship with `@agents` (common AI assistants) and `@humans` (repo-specific to be filled in).
- Group definitions are optional; missing groups simply fall back to literal matching.

**Canonical + reference example:**

```ts
// tldr ::: payment processor entry point ref:#payments/stripe-webhook #payments
// todo ::: @agent add idempotency key handling fixes:#payments/stripe-webhook
```

The canonical declares the authoritative anchor via `ref:#token`; downstream relational properties reference it with the same `#token` value.

### Search Ergonomics

- **Baseline discovery:** `rg ":::"` surfaces all waymarks; `waymark list <paths>` mirrors this in the CLI with structured output.
- **Actor delegation:** `rg ":::\\s*@agent"` for generic work, `waymark find --actor @claude` for named agents, `waymark find --actor @agents` to query configured groups.
- **Priority & signals:** `rg "^\\s*//\\s*\\*\\w+\s+:::"` finds starred waymarks. Use `waymark find --signal *` to pull starred waymarks; double stars (`**`) are not part of the v1 grammar.
- **Performance hotspots:** prefer the pattern `rg "#perf:hotpath|#hotpath"` (case-insensitive) or `waymark find #perf:hotpath` which expands to both forms.
- **Documentation summaries:** `rg "<!-- tldr :::.*#docs" docs/` filters doc TLDRs; the CLI equivalent is `waymark find --file-category docs --type tldr`.

### Multi‑line Waymarks

For long content, use markerless `:::` continuations:

```ts
// todo ::: implement authentication flow
//      ::: with OAuth 2.0 and PKCE
//      ::: coordinate with security team
```

- Continuation lines use markerless `:::` (no marker before the sigil)
- Only valid when following a waymark line (context-sensitive parsing)
- Formatter aligns continuation `:::` with parent waymark's `:::` by default
- Properties can act as pseudo-markers in continuation context:

```ts
// tldr  ::: payment processor entry point
// ref   ::: #payments/stripe
// owner ::: @alice
// since ::: 2025-01-01
```

In this example, `ref`, `owner`, and `since` are parsed as properties of the parent `tldr` waymark.

### Where Not to Use

- Do not place waymarks in string literals/docstrings or rendered documentation blocks (e.g., JSDoc/Doxygen). Use non‑rendered comments only.

## Canonicals & References — Semantics

- A **canonical** is any waymark line containing `ref:#token`.
- A **reference** is any other occurrence of that token: bare `#token`, `rel:#token`, or dependency properties.
- **Uniqueness scope:** repo‑wide by default; configurable to file scope.
- **Collisions:** Multiple canonicals for the same token → linter error (scope‑aware). Nearest by path wins for runtime resolution; formatter suggests rename.
- **Dangling relations:** `depends:#x` with no canonical `ref:#x` → linter error.
- **Case:** tokens are case‑insensitive; canonical form is lowercase.

## Grammar (EBNF)

```ebnf
WAYMARK_LINE     = HWS, COMMENT_LEADER, HWS, [SIGNALS], [MARKER, HWS], ":::", HWS, CONTENT ;
HWS              = { " " | "\t" } ;
SIGNALS          = ["^"] , ["*"] ;
MARKER           = ALPHA, { ALPHA | DIGIT | "_" | "-" } ;
CONTENT          = { TOKEN | HWS } ;
TOKEN            = RELATION | PROPERTY | MENTION | HASHTAG | TEXT ;

RELATION         = ( RELKEY , ":" , TOKENVAL ) ;
RELKEY           = "ref" | "rel" | "depends" | "needs" | "blocks" | "dupeof" ;
TOKENVAL         = HASH_TOKEN ;
HASH_TOKEN       = "#" , [ ALNUM | "." | "_" | "/" | "-" ] , { ALNUM | "." | "_" | "/" | "-" } ;

PROPERTY         = KEY , ":" , VALUE ;
KEY              = ALPHA , { ALPHA | DIGIT | "_" | "-" } ;
VALUE            = QUOTED | UNQUOTED ;
QUOTED           = '"' , { CHAR | ESCAPE } , '"' ;
UNQUOTED         = { CHAR_NO_WS_NO_BRK } ;

MENTION          = "@" , IDENT ;
HASHTAG          = "#" , IDENT_NS ;

IDENT            = ALNUM , { ALNUM | "_" | "-" | "." } ;
IDENT_NS         = ALNUM , { ALNUM | "_" | "-" | "." | "/" } ;

CONT_START       = WAYMARK_LINE ;
CONT_LINE        = HWS , COMMENT_LEADER , HWS , "..." , HWS , CONTENT ;
CONT_END         = CONT_LINE_TERMINATING ;
```

Notes:

- `RELATION` keys are reserved; other `PROPERTY` keys remain free‑form.
- Parser must not misclassify plain hashtags as relations; only `ref:`/`rel:`/etc. count as relations.

## Record Model & JSON Schema

Each parsed waymark emits a normalized record. This is the stable interchange for agents and tools.

- Indexers classify every file into a coarse `fileCategory` (`code`, `docs`, `config`, `data`, `test`) so CLI commands can filter doc-only summaries or isolate executable contexts.

### Record (conceptual)

```json
{
  "file": "src/auth/service.ts",
  "language": "ts",
  "fileCategory": "code",
  "startLine": 12,
  "endLine": 15,
  "indent": 0,
  "commentLeader": "//",
  "signals": { "raised": false, "important": true },
  "marker": "fix",
  "contentText": "handle partial refunds depends:#payments/charge",
  "properties": { "since": "3.0.0" },
  "relations": [{ "kind": "depends", "token": "#payments/charge" }],
  "canonicals": ["#auth/service"],
  "mentions": ["@alice"],
  "tags": ["#refunds"],
  "raw": "// *fix ::: handle partial refunds depends:#payments/charge"
}
```

### JSON Schema (draft 2020‑12)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://outfitter.dev/schemas/waymark-record.schema.json",
  "type": "object",
  "required": ["file", "startLine", "endLine", "marker", "contentText"],
  "properties": {
    "file": { "type": "string" },
    "language": { "type": ["string", "null"] },
    "fileCategory": { "type": "string", "enum": ["code", "docs", "config", "data", "test"] },
    "startLine": { "type": "integer", "minimum": 1 },
    "endLine": { "type": "integer", "minimum": 1 },
    "indent": { "type": "integer", "minimum": 0 },
    "commentLeader": { "type": ["string", "null"] },
    "signals": {
      "type": "object",
      "properties": {
        "raised": { "type": "boolean" },
        "important": { "type": "boolean" }
      },
      "additionalProperties": false
    },
    "marker": { "type": "string" },
    "contentText": { "type": "string" },
    "properties": { "type": "object", "additionalProperties": { "type": "string" } },
    "relations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["kind", "token"],
        "properties": {
          "kind": { "enum": ["ref", "rel", "depends", "needs", "blocks", "dupeof"] },
          "token": { "type": "string", "pattern": "^#[A-Za-z0-9._/-]+$" }
        },
        "additionalProperties": false
      }
    },
    "canonicals": {
      "type": "array",
      "items": { "type": "string", "pattern": "^#[A-Za-z0-9._/-]+$" }
    },
    "mentions": { "type": "array", "items": { "type": "string", "pattern": "^@[A-Za-z0-9._-]+$" } },
    "tags": { "type": "array", "items": { "type": "string", "pattern": "^#[A-Za-z0-9._/-]+$" } },
    "raw": { "type": "string" }
  },
  "additionalProperties": false
}
```

## Repository Artifacts & Storage

- **Project directory:** Waymark tooling reserves `.waymark/` (singular) in each repo.
  - `config.(toml|jsonc|yaml|yml)` — project-scoped configuration, version controlled (detected in that precedence: `toml`, `jsonc`, `yaml`, `yml`).
  - `rules/` — agent rule packs and conventions (version controlled).
  - `index.json` — lightweight JSON index with active waymarks, IDs (when opted-in), file metadata, audit log (regenerated from source; ignored in git).
  - `history.json` — JSON archive of removed/tombstoned waymarks for undo capability (optional; can be committed for team-shared history).
- **Scopes (`--scope`)** determine where writes land:
  - `user` — `$XDG_CONFIG_HOME/waymark/config.{toml,jsonc,yaml,yml}` (fallback `~/.config/waymark/`). Applies to every repo for the current user.
  - `local` — directory-specific overrides stored under `$XDG_CONFIG_HOME/waymark/local/<fingerprint>.jsonc`; never committed.
  - `project` (default) — writes to `.waymark/config.*` in the working tree for shared team settings.
- **XDG integration:**
  - Config: `$XDG_CONFIG_HOME/waymark/` (user-scoped config files).
  - Data: `$XDG_DATA_HOME/waymark/` (generated reports, exports).
  - Environment overrides: `WAYMARK_CONFIG_PATH`, `WAYMARK_DATA_PATH`.
- **.gitignore recommendations:**
  - `.waymark/index.json` — always ignored (regenerated from source files)

## Waymark Core Library (API)

The CLI is a thin wrapper over a reusable TypeScript package (`@waymarks/core`) that ships alongside 1.0. Projects can depend on this library directly to parse, analyze, or generate waymarks without invoking the CLI.

### Responsibilities

- **Parsing & normalization (`@waymarks/core/parser`):** `parse(text, opts)` and `parseWithResult` return the normalized record shape defined above. Exposes utilities for comment leaders per language.
- **Caching (`@waymarks/core/cache`):** SQLite-backed cache with `WaymarkCache` class for storing/retrieving parsed records, file metadata, and dependency graphs. Handles invalidation, transactions, and maintenance.
- **Scan/index (`@waymarks/core/scan`):** `scan(paths, config)` yields async iterators of records, applying caching/index strategies identical to the CLI.
- **Formatting (`@waymarks/core/format`):** `format(record|text, config)` returns normalized strings; `applyFormatting` operates on files.
- **Search helpers (`@waymarks/core/search`):** `filter(records, query)` and higher-level `find` builders (markers, signals, tags, actor groups, relations).
- **Graph generation (`@waymarks/core/graph`):** `buildGraph(records)` exposes the relation graph structure used for `waymark graph`.
- **Config loading (`@waymarks/core/config`):** `loadConfig({ scope })` resolves `.waymark/config.*`, local overrides, and XDG config using the precedence rules above.
- **Plugin hooks (`@waymarks/plugins`):** Optional package consumed by core tooling. Exposes `registerMarker`, `registerRelationKind`, `registerGroupProvider` so extensions can augment parsing or actor groups without modifying the core package.

### Packaging & Consumption

- Published under the `@waymarks` scope on npm: `@waymarks/core`, `@waymarks/cli`, optional `@waymarks/plugins`.
- Distributed as ESM modules (`exports` map for Bun/Node runtimes).
- CLI depends on `@waymarks/core` for all operations; other tooling (editor plugins, MCP servers) consume the same API.
- Optional HTTP service (`@waymarks/server`) can wrap the core library in a future release; the API signatures here are stable to support that evolution.
- Type definitions ship with each package; JSON Schemas exposed under `schemas/` for other languages.

## Waymark Agent Toolkit

- **Packages:**
  - `@waymarks/agents` — installer/orchestrator that applies project-specific agent artifacts.
  - `@waymarks/agents/rules` — Markdown rule packs (e.g., `WAYMARK-AUTHORING.md`, `WAYMARK-CLI.md`, `WAYMARK-USE.md`).
  - `@waymarks/agents/commands` — ready-made slash commands (e.g., Claude Code `waymark/write`, `waymark/scan`).
  - `@waymarks/agents/instructions` — pre-built instruction sets for popular agents (Claude, Cursor, Gemini) with CLI usage guidance.
- **Install behavior:**
  - Repo opt-in via `waymark agents install` (or equivalent). Prompts before modifying files.
  - Writes to `.waymark/rules/` and optionally amends `AGENTS.md`, `CLAUDE.md`, etc., inserting `@mentions` that point to the local rule files.
  - Supports symlinking or copying rule packs; defaults to copying with a hash comment so updates can be detected.
- **Docs:** `docs/agents/` describes installation flow, available rule packs, commands, and instructions. Teams can customize or trim as needed.
- **Agent commands:** Generated files target agent-specific locations (e.g., `.claude/commands/waymark/write.md`) and reference the local rule Markdown.
- **Configuration:** Controlled via `.waymark/config.(jsonc|yaml|yml|toml)` with `agents` section for enabled packs.

## MCP Server (Future Extension)

- Package: `@waymarks/mcp`, a thin MCP server that shells out to the installed CLI (`waymark`) for all operations.
- Exposes prompts for common flows (authoring TLDR, reviewing @agent delegations) and tools for scan/find/format.
- Respects the same config resolution and caching; stores any MCP-specific state under `$XDG_STATE_HOME/waymark/`.
- Designed to keep footprint minimal—no daemon beyond the MCP lifecycle, no extra indexing beyond what the CLI already produces.

## CLI Specification (Bun/TypeScript)

### Commands

- `waymark scan [path ...]` — Stream JSONL of all parsed waymarks.

  - Flags: `--jsonl` (default), `--text`, `--type <m>`, `--since <semver|date>`, `--tag <#token>`, `--rel <kind:#token>`

- `waymark find [query]` — Filtered view; supports types, tags, relations, canonicals.

  - Examples: `waymark find todo`, `waymark find --ref #payments/core`, `waymark find --depends #auth/jwt`, `waymark find --json`

- `waymark fmt [--write] [path ...]` — Normalize spacing/case, property ordering; enforce policy.
- `waymark lint [path ...]` — Validate structure/rules; non‑zero exit on errors.
- `waymark graph [path ...]` — Emit dependency graph from relation properties.

  - Output: `--json` (nodes/edges), `--mermaid` (flowchart), `--dot` (Graphviz)

- `waymark migrate [--include-legacy] [path ...]` — Convert legacy `TODO:`/`FIXME:` into Waymark form; optional marker map.
- `waymark init` — Bootstrap waymark configuration file with interactive prompts or flags.

  - Interactive: `waymark init` prompts for format, preset, and scope
  - Flags: `--format <toml|jsonc|yaml|yml>` (default: toml), `--preset <full|minimal>` (default: full), `--scope <project|user>` (default: project), `--force` (overwrite existing)
  - Auto-updates `.gitignore` for project scope

- `waymark tui` — Interactive picker (fuzzy search; jump to file/line).

### Exit Codes

- `0` — success/no findings (or warnings only)
- `1` — lint/parse errors found
- `2` — internal/tooling error

## Configuration — Example (`.waymark/config.yaml`)

- **Supported config formats:** JSONC (with comments), YAML/YML, and TOML across all scopes. CLI writes JSONC by default but respects existing file types when updating.

> Other supported formats: `.waymark/config.jsonc`, `.waymark/config.yml`, `.waymark/config.toml`.

```yaml
type_case: lowercase # lowercase | uppercase
id_scope: repo # repo | file
protected_branches: [main, release/*]
signals_on_protected: strip # strip | fail | allow
allow_types:
  [
    todo,
    fix,
    wip,
    done,
    review,
    test,
    check,
    note,
    context,
    tldr,
    this,
    example,
    idea,
    warn,
    alert,
    deprecated,
    temp,
    hack,
    blocked,
    needs,
    question,
  ]
skip_paths: ['**/dist/**', '**/.git/**', '**/node_modules/**']
format:
  space_around_sigil: true
  normalize_case: true
lint:
  duplicate_property: warn
  unknown_marker: warn
  dangling_relation: error
  duplicate_canonical: error
```

Config discovery order: CLI flag → `WAYMARK_CONFIG_PATH` env var → project `.waymark/config.*` → user `~/.config/waymark/config.*` → defaults.

## Architecture & Technical Decisions

### Implementation Stack

- **Runtime:** Bun (preferred for speed and single‑binary shipping)
- **Language:** Strict TypeScript
- **Packaging:** Bun bundler → single executable; Homebrew formula & npm `bunx` support
- **Style/Lint:** Biome (format/lint TS); project CI via GitHub Actions

### Parser Strategy

- **Two‑stage:**

  1. **Line scanner**: cheap regex to find candidate comment lines with `:::`; language detection by file extension → comment leaders.
  2. **State machine**: parse signals → marker → content tokens (properties/hashtags/mentions), with multi‑line continuation handling.

- **No AST dependency:** keeps speed and portability high; optional symbol awareness later.
- **Comment leaders map:** per‑language line and block comment delimiters (see Appendix A). Block comments allowed when they're not rendered doc.

### Caching Strategy

- **Storage:** Lightweight JSON files for simplicity, diffability, and git-friendly workflows.
- **Location:** Repo-local JSON index files in `.waymark/`:
  - `index.json` - Active waymarks, IDs (when opted-in), file metadata, audit log (gitignored, regenerated from source)
  - `history.json` - Removed/tombstoned waymarks for undo/restore capability (optional commit for team-shared history)
- **Schema:** Structured JSON with waymark records, file metadata, dependency edges, and ID mappings.
- **Invalidation:** File mtime/size tracking for automatic index refresh on changes.
- **Performance:** In-memory processing with batched file I/O; incremental updates via `wm index --refresh`.
- **Portability:** Each repo maintains its own index files; no cross-repo pollution; clean slate on clone.

### Index & Performance

- Streaming JSONL for `scan` avoids memory blow‑ups on large repos.
- In-memory index with fast JSON parsing for sub-millisecond lookups.
- Full-text search on waymark content via in-memory filtering and pattern matching.
- Dependency graph traversal via indexed relation arrays.
- Git hook integration via `wm index --refresh` for automatic index updates.
- Watch mode (future): incremental updates via file system events and index deltas.

### Editor/Tooling Hooks

- Jump links: file path + line numbers for quick open.
- Quick‑fixes in `fmt`: add missing closure `:::`; reorder properties; case normalize; suggest canonical creation.

## Formatter Behavior

- Normalize marker case per config.
- Enforce exactly one space around `:::` when marker is present.
- Reorder properties: relations after free text; stable key ordering within properties when beneficial.
- Strip `*` signal on protected branches per policy.
- Lowercase tokens in `ref:` and relation properties.

## Linter Rules & Codes

- **WM001 Duplicate property key** — warn; last wins.
- **WM010 Unknown marker** — warn unless allowlisted.
- **WM020 Unterminated multi‑line block** — error.
- **WM030 Multiple `tldr` in file** — error.
- **WM040 Canonical collision (`ref:#token`)** — error (scope aware).
- **WM041 Dangling relation to unknown token** — error.
- **WM050 Signal `*` on protected branch** — policy (error or auto‑strip).

## Migration & Adoption

- **Coexistence:** Legacy `TODO:`/`FIXME:` may remain; `migrate` can normalize to Waymark syntax.
- **Anchors:** `##anchor` → `ref:#anchor`; single `#anchor` stays as reference.
- **Gradual intro:** Teams can start with `todo/fix/note` only, add canonicals/relations later.

## Testing & QA Plan

- **Corpus:** Synthetic repo with multi‑language files; edge cases: whitespace variance, block comments, continuation closure, duplicate properties.
- **Property parsing:** quoted values, escaped quotes, duplicate keys.
- **Relations:** all kinds (ref/rel/depends/needs/blocks/dupeof), collisions, dangling.
- **Markers:** all blessed + unknown custom; allowlist behavior.
- **Signals:** combinations, protected branch policy.
- **`tldr`/`this` rules:** placement, multiplicity.
- **CLI:** snapshot tests for `scan/find/map/graph/lint/fmt` with JSON fixtures.

## IDE Integration & TUI

- **TUI:** fuzzy finder over records; preview pane; open in editor.
- **Editor hints:** VS Code/NeoVim trees for `tldr`/`this` and graph neighbors.
- **Code actions:** quick insert of waymark templates; add `ref:#token`; convert legacy TODO.

## Security & Privacy

- Defaults to **local‑only** processing; no network I/O.
- Opt‑in telemetry (if any) with clear config; disabled by default.
- No PII capture beyond content of comments; honors `.gitignore`‑like skip patterns.

## Open Questions & Future Work

- **Scope defaults:** repo‑wide uniqueness is default—does any team prefer per‑directory scopes?
- **Symbol awareness:** optional future `[[symbol:...]]` without changing core syntax (out‑of‑band index).
- **Graph enrichment:** automatic edges from proximity/mentions vs explicit relations only.
- **Editor protocol:** LSP for waymark navigation?

## Milestones & Definition of Done

**M1 — Parser & JSON (v1.0‑alpha)**

- Parse single/multi‑line waymarks; emit JSONL via `scan`.
- Support markers, signals, properties, hashtags, mentions.
- Canonicals (`ref:#token`) & relations parsed; basic lints (WM020/WM040/WM041).

**M2 — Lint & Fmt (v1.0‑beta)**

- `lint` with all rules; `fmt` normalization and quick‑fixes.
- Config discovery; marker allowlist; protected branches policy.

**M3 — Find/Map/Graph (v1.0)**

- `find` filters; `map` of `tldr`/`this`; `graph` JSON & mermaid.
- CI: schema tests, performance budget on large repos.

**M4 — MCP Server (post-v1.0 hardening)**

- Ship an MCP-compatible stdio server that proxies `waymark` CLI commands for agents.
- Reuse shared config discovery and JSON schemas to guarantee consistent responses.
- Document invocation from Claude/Cursor agents and include sample tool definitions.

**Definition of Done**

- Spec conformance validated by corpus.
- CLI executable published (Brew + npm `bunx`).
- JSON schema stable, versioned, and documented.
- Linter/formatter integrated in CI; zero false‑positive criticals on seed repos.

## Appendix A — Comment Leader Map (starter)

- **C/CPP/Java/Go/Rust/TS/JS/Swift/Kotlin** — line: `//` ; block: `/* ... */`
- **Python/Ruby/Elixir/Shell/YAML/TOML** — line: `#`
- **SQL** — line: `--`
- **HTML/XML/MDX** — block: `<!-- ... -->`

Notes:

- Block comments are allowed for waymarks when not rendered as documentation.
- For languages where docstrings are string literals (e.g., Python `"""`), do not use waymarks inside them.

## Appendix B — Grep Recipes

- All waymarks: `rg ":::"`
- By marker: `rg "\\btodo\\s*:::"`, `rg "\\*todo\\s*:::"`
- Properties: `rg "owner:@alice"`
- Canonicals for a token: `rg "ref:#payments/core"`
- All refs of a token: `rg "#payments/core"`
- Multi‑line blocks: `rg -U ":::.*\n.*:::"` (finds waymarks with continuations)

## Example Snippets

```ts
// tldr ::: user authentication service ref:#auth/service

class AuthService {
  // this ::: manages login and JWT lifecycle ref:#auth/jwt

  // todo ::: add refresh tokens depends:#auth/jwt
  // note ::: SSO edge cases #auth/service

  login(user) {
    // *fix ::: validate credentials needs:#infra/db
    return issueJWT(user)
  }
}

// blocked ::: rollout until schema migration done blocks:#infra/db
```

```go
// tldr ::: payment processing module ref:#payments/core
// todo ::: implement PCI checks rel:#compliance.pci
// fix  ::: handle network timeouts depends:#payments/charge
```

```sql
-- tldr ::: reporting queries ref:#reports
-- note ::: this assumes an index on created_at #perf
```

```html
<!-- tldr ::: user profile template ref:#ui/profile -->
<!-- note ::: inline editor disabled in read-only mode #ui -->
```
