<!-- tldr ::: canonical specification for the Waymark v1 grammar -->

# Waymark Specification (v1)

Waymark is a lightweight, comment-based grammar for embedding code-adjacent context beside implementation. This document mirrors the authoritative definition in `PRD.md` for quick reference when writing tooling, reviews, or documentation.

## 1. Line Form

```text
[comment leader] [signals][marker] ::: [content]
```

- **Comment leader**: Whatever the host language uses (`//`, `#`, `<!--`, etc.). Waymarks never appear inside string literals or rendered docstrings.
- **Signals** (optional): A short prefix indicating scope/urgency. The only valid signals are:
  - `^` (caret) — produces a raised waymark for branch-scoped work that must be cleared before merging to protected branches.
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

- Continuation lines use markerless `:::` (no marker before the sigil)
- Context-sensitive: only valid when following a waymark
- Formatter aligns continuation `:::` with parent by default
- Properties can act as pseudo-markers in continuation context
- Avoid multi-line content when a concise single-line sentence will do

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
  - `#docs/...` — documentation (`#docs/prd`, `#docs/guide`)
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
// this ::: Stripe webhook verification handler #perf:hotpath
// todo ::: @agent add idempotency key handling fixes:#payments/stripe-webhook
// review ::: @alice confirm retry strategy #sec:boundary
// note ::: logs PII-hardened metadata only #docs/logging

export async function handleWebhook(body: StripePayload) { /* ... */ }
```

```md
<!-- tldr ::: Bun-based CLI PRD defining v1.0 scope and requirements #docs/prd -->
<!-- this ::: workflow overview for installing the CLI -->
```

```py
def send_email(message: Email) -> None:
    """Send an email using the configured transport."""
    # this ::: orchestrates outbound email delivery #comm/email
    transport.send(message)
```

## 9. Implementation Notes

- Parsers should normalize signals to `^` and `*`, lowercase markers, trim extra spaces, and emit structured records matching the schema in `PRD.md`.
- Formatters must enforce a single space around `:::` when a marker is present.
- Tooling should warn on unknown markers, duplicate canonical tokens, and legacy signal usage.

This specification stays in lockstep with `PRD.md`. When the grammar evolves, update both documents and record the change in the Decisions Log.
