<!-- tldr ::: canonical specification for the Waymark v1 grammar -->

# Waymark Specification (v1)

Waymark is a lightweight, comment-based grammar for embedding code-adjacent context beside implementation. This document is the canonical definition for v1.

## 1. Line Form

```text
[comment leader] [signals][marker] ::: [content]
```

- **Comment leader**: Whatever the host language uses (`//`, `#`, `<!--`, etc.). Waymarks never appear inside string literals or rendered docstrings.
- **Signals** (optional): A short prefix indicating scope/urgency. The only valid signals are:
  - `^` (caret) — produces a raised waymark for branch-scoped work that must be cleared before merging.
  - `*` (star) — high-priority item. When combined with the caret, the order is `^*` (e.g., `^*todo`). Double intensity (`**`) and other legacy signals are not part of v1.
- **Marker** (required): A single lowercase keyword from the blessed list below.
- **`:::` sigil**: Exactly three ASCII colons, with one space before and after when a marker is present.
- **Content**: Free text plus optional properties, tags, and mentions. Parsers tolerate additional spaces but formatters normalize to the canonical shape.

### Multi-line Waymarks

For long content use markerless `:::` continuation lines:

```ts
// todo ::: rewrite parser for streaming
//      ::: preserve backwards-compatible signature
//      ::: coordinate rollout with @devops
```

**Continuation rules**:

- Continuation lines use markerless `:::` (no marker before the sigil)
- Context-sensitive: only valid when following a waymark line
- Markerless `:::` outside waymark context is ignored by parsers
- Properties and tokens (mentions, tags) can appear on continuation lines
- Formatter aligns continuation `:::` with parent by default (configurable)
- Avoid multi-line content when a concise single-line sentence will do

**Property-as-marker continuations**: Known property keys (`ref`, `owner`, `since`, `until`, `priority`, `status`) can appear as pseudo-markers:

```ts
// tldr  ::: payment processor service
// ref   ::: #payments/core
// owner ::: @alice
// since ::: 2025-01-01
```

This parses as a single `tldr` waymark with properties extracted from the continuation lines.

**Important**: Blessed markers like `needs` or `blocks` are NOT treated as property continuations. They always start a new waymark.

**HTML comments**: Each line requires proper `<!-- ... -->` closure:

```html
<!-- tldr ::: component library documentation -->
<!--       ::: covers setup and API reference -->
```

## 2. Blessed Markers

Only the following markers are considered first-class by the toolchain. Custom markers require explicit configuration and may trigger lint warnings.

### Work / Action

- `todo`
- `fix` (legacy alias `fixme` should be migrated to `fix`)
- `wip`
- `done`
- `review`
- `test`
- `check`

### Information

- `note`
- `context` (alias `why`)
- `tldr`
- `this`
- `example`
- `idea`
- `comment`

### Caution / Quality

- `warn`
- `alert`
- `deprecated`
- `temp` (alias `tmp`)
- `hack`

### Workflow

- `blocked`
- `needs`

### Inquiry

- `question` (alias `ask`)

#### Special Treatment

- **`tldr`** appears once per file at the highest valid location (after shebang/front matter, before code). It summarizes the file’s purpose in 8–14 active words. Documentation TLDRs end with a `#docs/...` tag.
- **`this`** summarizes sections/classes. Use multiple per file to orient readers and agents.
- **`*tldr`** prioritizes the summary in generated maps and dashboards—reserve it for files or documents that must be read first.

## 3. Properties & Relations

Properties are `key:value` pairs in the content region. Keys match `[A-Za-z][A-Za-z0-9_-]*`. Values are either unquoted tokens without spaces or double-quoted strings supporting `\"` escapes.

### Canonical Anchors

- Declare anchors with `ref:#token`. Tokens are lowercase by convention and support `/`, `:`, `.`, `_`, and `-`.
- Place canonicals on TLDRs or high-level `this` waymarks.
- One canonical per token per repository. Detect collisions with `rg ":::\s.*ref:#<token>"`.

### Relations

- Reference canonicals via either a bare hashtag (`#payments/stripe-webhook`) or explicit relational properties:
  - `depends:#token`
  - `needs:#token`
  - `blocks:#token`
  - `dupeof:#token`
  - `rel:#token`
- Relational values ALWAYS include the leading hash (`fixes:#123`, not `fixes:123`).
- Arrays are comma-separated without spaces (`affects:#billing,#auth/api`).

### Free-form Properties

- Additional properties (e.g., `owner:@alice`, `since:2025-09-01`) are allowed. Duplicates are overwritten by the last occurrence.
- Avoid introducing new property keys without documenting them in `.waymark/rules/conventions.md`.

## 4. Tags & Namespaces

- Any `#` followed by non-whitespace (`[A-Za-z0-9._/:%-]+`) is treated as a tag or reference.
- Preferred namespaces include:
  - `#docs/...` — documentation (`#docs/spec`, `#docs/guide`)
  - `#arch/...` — architecture (`#arch/entrypoint`, `#arch/state`)
  - `#perf:...` — performance attributes (`#perf:hotpath`)
  - `#sec:...` — security (`#sec:boundary`, `#sec:auth`)
  - `#data:...` — data flow (`#data:source`)
- Tags are optional; if you add one run `rg ":::\s.*#fragment"` to match existing usage before minting a new namespace.

## 5. Actors & Delegation

- Place actors immediately after the sigil to assign work: `// todo ::: @agent add retry logic`.
- `@agent` delegates to any capable automation. Use specific handles (`@codex`, `@claude`, `@cursor`, `@gemini`) to target a known assistant.
- Mentions later in the sentence (`// todo ::: @alice coordinate with @agent`) signal involvement without transferring ownership.
- Actor groups come from configuration (`.waymark/config.*`). `waymark find --actor @agents` expands to the configured list.

## 6. Search Ergonomics

Recommended ripgrep patterns:

```bash
rg ':::'                          # all waymarks
rg ':::\s*@agent'                 # generic agent work
rg '\*\w+\s*:::'                  # high-priority waymarks
rg '\^\w+\s*:::'                  # raised/ongoing work
rg '#perf:hotpath|#hotpath'      # performance hotspots
rg 'tldr\s*:::.*#docs'            # doc summaries
rg '\*tldr\s*:::'                 # prioritized summaries
```

CLI equivalents:

```bash
waymark find --actor @agent
waymark find --signal *
waymark find #perf:hotpath
waymark find --file-category docs --type tldr
```

## 7. Grammar Reference

```ebnf
WAYMARK       = HWS, COMMENT, HWS?, [SIGNALS], MARKER, HWS, ":::", HWS, CONTENT? ;
HWS           = { " " | "\t" } ;
COMMENT       = COMMENT_LEADER ;
SIGNALS       = ["^"] , ["*"] ;
MARKER        = LOWER , { LOWER | DIGIT | "_" | "-" } ;
CONTENT       = { TOKEN | HWS } ;
TOKEN         = RELATION | PROPERTY | MENTION | HASHTAG | TEXT ;
RELATION      = REL_KEY, ":", HASH_TOKEN ;
REL_KEY       = "ref" | "rel" | "depends" | "needs" | "blocks" | "dupeof" ;
PROPERTY      = KEY, ":", VALUE ;
KEY           = ALPHA , { ALPHA | DIGIT | "_" | "-" } ;
VALUE         = UNQUOTED | QUOTED ;
UNQUOTED      = { CHAR_NO_WS_NO_COLON } ;
QUOTED        = '"' , { CHAR | ESCAPED } , '"' ;
ESCAPED       = "\\" , ( '"' | "\\" );
MENTION       = "@" , IDENT ;
HASHTAG       = "#" , IDENT_NS ;
IDENT         = ALNUM , { ALNUM | "_" | "-" | "." } ;
IDENT_NS      = ALNUM , { ALNUM | "_" | "-" | "." | "/" | ":" } ;
```

## 8. Reference Examples

```ts
// tldr ::: payment processor entry point ref:#payments/stripe-webhook #payments
// about ::: Stripe webhook verification handler #perf:hotpath
// todo ::: @agent add idempotency key handling fixes:#payments/stripe-webhook
// review ::: @alice confirm retry strategy #sec:boundary
// note ::: logs PII-hardened metadata only #docs/logging

export async function handleWebhook(body: StripePayload) { /* ... */ }
```

```md
<!-- tldr ::: Waymark CLI spec defining v1 scope and requirements #docs/spec -->
<!-- about ::: workflow overview for installing the CLI -->
```

```py
def send_email(message: Email) -> None:
    """Send an email using the configured transport."""
    # about ::: orchestrates outbound email delivery #comm/email
    transport.send(message)
```

**Multi-line continuation examples**:

```ts
// Text continuation with alignment
// todo ::: refactor this parser for streaming
//      ::: preserve backward-compatible API surface
//      ::: coordinate deployment with @devops

// Property continuation (parsed as single waymark with properties)
// tldr  ::: payment processor service
// ref   ::: #payments/core
// owner ::: @alice
// since ::: 2025-01-01
```

```html
<!-- Multi-line in HTML comments -->
<!-- tldr ::: component library documentation -->
<!--       ::: covers setup and API reference -->
```

## 9. Implementation Notes

- Parsers should normalize signals to `^` and `*`, lowercase markers, trim extra spaces, and emit structured records matching the `WaymarkRecord` schema in `@waymarks/grammar`.
- Formatters must enforce a single space around `:::` when a marker is present.
- Continuation lines are context-sensitive: markerless `:::` is only parsed as a continuation when following a waymark. Isolated `:::` lines are ignored.
- Property-as-marker continuations only trigger for known property keys (not blessed markers like `needs` or `blocks`).
- Tooling should warn on unknown markers, duplicate properties, multiple TLDRs per file, and legacy codetag patterns.

This specification is canonical. When the grammar evolves, update `docs/GRAMMAR.md` and `.waymark/rules/WAYMARKS.md` alongside the code so guidance stays aligned.
