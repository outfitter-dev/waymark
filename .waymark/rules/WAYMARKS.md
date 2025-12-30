<!-- tldr ::: canonical waymark grammar, markers, and usage guidance for this repo -->

# Waymarks

This document codifies how the Waymark grammar is used in this repository. Every agent and contributor **must** follow these rules so that code-adjacent context stays consistent, greppable, and tooling-friendly.

## Important Rules

- @CONVENTIONS.md
- @DOCSTRING-COMPATIBILITY.md
- @TLDRs.md
- @THIS.md

## 1. Grammar Overview

A waymark is a single comment line (or continuation block) built from the following structure:

```text
[comment leader] [signals][marker] ::: [content]
```

- **Comment leader**: Whatever the host language uses (`//`, `#`, `<!--`, etc.). Waymarks never live inside string literals or rendered docstrings.
- **Signals** (optional): the caret (`^`) marks waymarks as raised (work-in-progress, branch-scoped), the star (`*`) marks waymarks as starred (important, high-priority). When combined, the caret precedes the star (`^*todo`). No other signals are allowed.
- **Marker** (required): One of the blessed keywords below. Lowercase, no spaces.
- **`:::` sigil**: Exactly three ASCII colons with one space before and after when a marker is present.
- **Content**: Free text plus optional properties, hashtags, actors, and tags following the grammar defined here.

Multi-line waymarks use markerless `:::` continuation lines, with optional alignment to the parent waymark's `:::` position for improved readability.

Line comments are preferred whenever the language supports them. Use block comments only in languages without line-comment support (for example, CSS).

## 2. Blessed Markers

Only the following markers are considered first-class by the toolchain. Custom markers are possible but require explicit configuration and may trigger lint warnings.

### Work / Action

- `todo`
- `fix` (alias: `fixme` when migrating legacy content)
- `wip`
- `done`
- `review`
- `test`
- `check`

### Information

- `note`
- `context` (alias: `why`)
- `tldr`
- `this`
- `example`
- `idea`
- `comment`

### Caution / Quality

- `warn`
- `alert`
- `deprecated`
- `temp` (alias: `tmp`)
- `hack`

### Workflow

- `blocked`
- `needs`

### Inquiry

- `question` (alias: `ask`)

**Special rules**

- `tldr` appears once per file at the highest valid location (after shebang/front-matter, before code). It carries the canonical summary.
- `this` summarizes specific sections or constructs and can appear multiple times in a file.

## 3. Writing TLDR Waymarks

- See @TLDRs.md for full guidance and examples.
- Compose a single 8–14 word sentence in active voice that states what the file delivers.
- Lead with capability, end with the key technology or constraint for grepability.
- Example: `// tldr ::: Stripe webhook handler verifying signatures and queuing retries`.
- Documentation TLDRs follow the same rule inside HTML comments and should end with a `#docs` tag, optionally namespaced (`#docs/prd`, `#docs/guide`).

## 4. Writing `this :::` Waymarks

- See @THIS.md for examples and checklists.
- Place the comment immediately above the class/function/block it summarizes.
- Keep the scope local—capture what the upcoming section does, not the whole file.
- Reuse existing tag namespaces so section searches align with TLDRs.

## 5. Properties & Relations

Properties use `key:value` pairs. Keys are `^[A-Za-z][A-Za-z0-9_-]*$`. Values are unquoted tokens without spaces or double-quoted strings with escaped quotes.

### Canonicals

- Declare canonical anchors with `ref:#token`. Tokens are lowercase by convention and may include `/`, `:`, `.`, `_`, and `-`.
- Example: `// tldr ::: payment processor entry point ref:#payments/stripe-webhook #payments`

### Relations

- Reference canonicals via either bare hashtags (`#payments/stripe-webhook`) or explicit properties:
  - `depends:#token`
  - `needs:#token`
  - `blocks:#token`
  - `dupeof:#token`
  - `rel:#token`
- Relational values always keep the hash on the value (e.g., `fixes:#auth/reset-password`).
- Arrays are comma-separated without spaces (`affects:#billing,#auth/api`).

### Additional Properties

- Use free-form properties sparingly (`owner:@alice`, `since:2025-09-01`). Duplicate keys are discouraged; tooling keeps the last value.
- Unknown keys may be flagged if not recognized by configuration.

## 5. Hashtags & Tags

- Any `#` followed by non-whitespace (`[A-Za-z0-9._/:%-]+`) is treated as a tag/reference.
- Use namespaces (`#perf:hotpath`, `#docs/prd/v1`) to improve specificity.
- Doc-related tags should start with `#docs`. Performance, security, and architectural tags should follow similar conventions (`#perf:hotpath`, `#sec:boundary`, `#arch:entrypoint`).
- Do **not** put `#` on property keys (`fixes:#123`, not `#fixes:#123`).

## 6. Actors & Delegation

- Place actors immediately after `:::` to assign ownership: `// todo ::: @agent implement OAuth callback #sec:boundary`.
- `@agent` delegates to any capable automation helper. Named actors (`@codex`, `@claude`, `@gemini`, etc.) target specific assistants.
- Mentions later in the sentence (`// todo ::: @alice coordinate with @agent`) signal involvement without transferring ownership.
- Actor groups come from configuration (see below). Use `waymark find --actor @agents` to match every member of the `@agents` group.

## 7. Search Ergonomics

Recommended ripgrep patterns:

```bash
# All waymarks
git ls-files -z | xargs -0 rg ':::'

# Actor assignments
rg ':::\s*@agent'
rg ':::\s*@claude'

# Priority
rg '\*\w+\s*:::'

# Performance hotspots
rg '#perf:hotpath|#hotpath'

# Documentation TLDRs
git ls-files '*.md' '*.mdx' | xargs rg 'tldr\s*:::.*#docs'
```

CLI equivalents:

```bash
waymark find --actor @agent
waymark find --signal *
waymark find #perf:hotpath
waymark find --file-category docs --type tldr
```

## 8. Configuration & Storage

- Project configuration lives in `.waymark/config.(jsonc|yaml|yml|toml)`.
- CLI scopes:
  - `global` → `$XDG_CONFIG_HOME/waymark/config.*`
  - `local` → `$XDG_CONFIG_HOME/waymark/local/<fingerprint>.jsonc`
  - `project` → `.waymark/config.*`
- Transient artifacts belong under `.waymark/cache/` or `.waymark/index/` (ignored in git). Human-readable maps may be generated as `.waymark/map.md` but should remain untracked unless explicitly required.

## 9. Agent Toolkit Hooks

- Rule packs ship from `@waymarks/agents/rules` and land under `.waymark/rules/` when installed.
- Commands (e.g., Claude slash commands) live in `.claude/commands/waymark/*.md` and reference this guide plus the local rules.
- Instruction profiles for specific agents are placed under `.waymark/agents/instructions/` when enabled.
- Always update `AGENTS.md` and `PLAN.md` when installing or modifying agent assets.

## 10. Anti-patterns & Prohibitions

- No wikilinks (`[[...]]`), complex property syntaxes, or custom signals beyond those listed.
- Do not place waymarks inside rendered documentation sections (e.g., Markdown body). Use HTML comments instead.
- Avoid numeric-only hashtags, which collide with issue references.
- Do not hand-edit generated caches; they will be overwritten by tooling.
- Legacy patterns (`TODO:`, `fix:`, `priority:high`, `#owner:@alice`, etc.) should be migrated to the new grammar. Use the `legacy-pattern` lint rule or enable `scan.include_codetags` to surface them.

## 11. Reference Examples

```ts
// tldr ::: payment processor entry point ref:#payments/stripe-webhook #payments
// this ::: Stripe webhook verification handler #perf:hotpath
// todo ::: @agent add idempotency key handling fixes:#payments/stripe-webhook
// *review ::: @alice confirm new retry strategy #sec:boundary
// note ::: logs PII-hardened metadata only #docs/logging

/* Multi-line examples */

// Text continuation with alignment
// todo ::: refactor this parser for streaming
//      ::: preserve backward-compatible API surface
//      ::: coordinate deployment with @devops

// Property continuations (parsed as properties of the parent waymark)
// tldr  ::: payment processor service
// ref   ::: #payments/core
// owner ::: @alice
// since ::: 2025-01-01
```

```md
<!-- tldr ::: Waymark CLI spec defining v1 scope and requirements #docs/spec -->
<!-- note ::: See #docs/plan for execution plan references -->
```

Follow these rules rigorously: they ensure that humans, agents, and tooling all share the same mental model of the codebase.
