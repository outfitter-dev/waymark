<!-- tldr ::: canonical specification for the Waymark v1 grammar -->

# Waymark Specification (v1)

Waymark is a lightweight, comment-based grammar for embedding code-adjacent context beside implementation. This document is the canonical definition for v1.

## 1. Line Form

```text
[comment leader] [signals][marker] ::: [content]
```

- **Comment leader**: Whatever the host language uses (`//`, `#`, `<!--`, etc.). Waymarks never appear inside string literals or rendered docstrings.
- **Signals** (optional): A short prefix modifying the waymark's meaning. The only valid signals are:
  - `~` (tilde) — **flagged**: marks work actively in progress on the current branch; must be cleared before merging.
  - `*` (star) — **starred**: marks high-priority or important items.
  - When combined, the canonical order is `~*` (e.g., `~*todo`). Double intensity (`**` or `~~`) is not part of v1.
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
- `fix`
- `wip`
- `done`
- `review`
- `test`
- `check`

### Information

- `note`
- `context` (alias `why`)
- `tldr`
- `about`
- `example`
- `idea`
- `comment`

### Caution / Quality

- `warn`
- `alert`
- `deprecated`
- `temp` (alias `tmp`)
- `hack` (alias `stub`)

### Workflow

- `blocked`
- `needs`

### Inquiry

- `question` (alias `ask`)

#### Special Treatment

- **`tldr`** appears once per file at the highest valid location (after shebang/front matter, before code). It summarizes the file's purpose in 8–14 active words. Documentation TLDRs end with a `#docs/...` tag.
- **`about`** summarizes sections/classes. Use multiple per file to orient readers and agents.
- **`*tldr`** prioritizes the summary in generated maps and dashboards—reserve it for files or documents that must be read first.

## 3. Properties & Relations

Properties are `key:value` pairs in the content region. Keys match `[A-Za-z][A-Za-z0-9_-]*`. Values are either unquoted tokens without spaces or double-quoted strings supporting `\"` escapes.

### Canonical Anchors

- Declare anchors with `ref:#token`. Tokens are lowercase by convention and support `/`, `:`, `.`, `_`, and `-`.
- Place canonicals on TLDRs or high-level `about` waymarks.
- One canonical per token per repository. Detect collisions with `rg ":::\s.*ref:#<token>"`.

### Relations

- Reference canonicals via either a bare hashtag (`#payments/stripe-webhook`) or explicit relational properties:
  - `see:#token` — related reference
  - `docs:#token` — documentation reference
  - `from:#token` — depends on or derived from
  - `replaces:#token` — supersedes another waymark
- Relational values ALWAYS include the leading hash (`see:#auth`, not `see:auth`).
- Arrays are comma-separated without spaces (`see:#billing,#auth/api`).

### Free-form Properties

- Additional properties (e.g., `owner:@alice`, `since:2025-09-01`) are allowed. Duplicates are overwritten by the last occurrence.
- Avoid introducing new property keys without documenting them in project configuration.

### Symbol Binding

Use `sym:<symbol>` to associate a waymark with a specific code symbol (function, class, variable, etc.):

```typescript
// todo ::: sym:handleAuth implement token refresh
// fix ::: sym:validateInput escape special characters
```

**Purpose**: Explicitly links the waymark to a named symbol, enabling tooling to:

- Track waymarks across refactors (when symbol names change but waymark moves with the code)
- Build symbol-to-waymark indexes
- Validate that referenced symbols exist in scope

**Rules**:

- Value is a bare identifier matching `[A-Za-z_][A-Za-z0-9_]*`
- One `sym:` per waymark (duplicates overwrite)
- Symbol should exist in the same file or be imported
- Linters may warn on unresolved symbols

**Examples**:

```typescript
// about ::: sym:AuthService manages user sessions and JWT tokens
export class AuthService { /* ... */ }

// todo ::: sym:processPayment add idempotency key handling
async function processPayment(order: Order) { /* ... */ }

// warn ::: sym:legacyParser deprecated, use newParser instead
```

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

### Mention Validation

Mentions must follow strict rules to avoid false positives:

**Valid mentions** start with `@` followed by a lowercase letter, then alphanumeric characters, underscores, hyphens, or dots:

```typescript
// Valid:
// todo ::: @alice implement OAuth
// todo ::: @agent add caching
// todo ::: @dev-team review changes
// todo ::: @bob.smith coordinate rollout
```

**Invalid patterns** are rejected by parsers:

| Pattern | Example | Why Rejected |
| ------- | ------- | ------------ |
| Email addresses | `user@domain.com` | Contains `@` mid-word |
| Decorators | `@Component`, `@Injectable` | Starts with uppercase |
| Scoped packages | `@scope/package`, `@angular/core` | Contains `/` after `@` |
| Uppercase handles | `@Alice`, `@ADMIN` | Must start lowercase |

**Examples of rejection**:

```typescript
// These do NOT extract mentions:
// note ::: contact user@example.com for help      // Email - no mention
// note ::: uses @Component decorator              // Decorator - no mention
// note ::: depends on @angular/core               // Scoped package - no mention
// note ::: assigned to @Alice                     // Uppercase - no mention

// These DO extract mentions:
// todo ::: @alice contact user@example.com        // @alice extracted, email ignored
// note ::: @agent review the @Injectable usage    // @agent extracted, @Injectable ignored
```

**Pattern**: `@[a-z][A-Za-z0-9._-]*` (must start with lowercase letter)

## 6. Search Ergonomics

Recommended ripgrep patterns:

```bash
rg ':::'                          # all waymarks
rg ':::\s*@agent'                 # generic agent work
rg '\*\w+\s*:::'                  # high-priority waymarks
rg '\~\w+\s*:::'                  # flagged/in-progress work
rg '#perf:hotpath|#hotpath'      # performance hotspots
rg 'tldr\s*:::.*#docs'            # doc summaries
rg '\*tldr\s*:::'                 # prioritized summaries
```

CLI equivalents:

```bash
wm find . --mention @agent
wm find . --starred
wm find . --tag #perf:hotpath
wm find docs/ --type tldr
```

## 7. Waymark IDs

Waymarks can be assigned stable identifiers using wikilink-style syntax. IDs enable precise cross-references, history tracking, and tooling integration.

### ID Format

IDs use double-bracket notation with three supported forms:

```text
[[hash]]          - Full ID (7-character alphanumeric hash)
[[hash|alias]]    - ID with human-readable alias
[[alias]]         - Draft/alias-only (no hash yet)
```

**Examples**:

```typescript
// todo ::: [[a1b2c3d]] implement rate limiting
// fix ::: [[x9y8z7w|auth-bug]] resolve authentication failure
// idea ::: [[session-cache]] consider Redis for sessions
```

### Hash Generation

- **Format**: 7 lowercase alphanumeric characters (`[a-z0-9]{7}`)
- **Generation**: Deterministic hash derived from waymark content, file path, and line context
- **Uniqueness**: Repository-wide; collisions are detected and rejected by tooling
- **Stability**: Hash remains constant unless the waymark is significantly modified

**ID lifecycle**:

1. **Draft**: Start with alias-only `[[my-alias]]` during development
2. **Assign**: Run `wm id --assign` to generate hashes for draft IDs
3. **Stable**: Once assigned, `[[a1b2c3d|my-alias]]` persists through refactors

### Aliases

Aliases provide human-readable identifiers alongside the hash:

- **Format**: Lowercase alphanumeric with hyphens (`[a-z0-9-]+`)
- **Purpose**: Readable references in documentation and conversation
- **Uniqueness**: Aliases should be unique within a repository but are not enforced as strictly as hashes

```typescript
// tldr ::: [[f3g4h5j|stripe-webhook]] Stripe webhook handler ref:#payments/stripe
// todo ::: [[auth-refresh]] implement token refresh from:#auth/service
```

**Alias conventions**:

- Use kebab-case (`auth-refresh`, not `authRefresh` or `auth_refresh`)
- Keep aliases short but descriptive (2-4 words)
- Prefer domain-prefixed aliases for clarity (`auth-login`, `payments-refund`)

### Referencing IDs

Reference waymarks by their ID in relations and content:

```typescript
// todo ::: implement retry logic see:[[a1b2c3d]]
// fix ::: address feedback from:[[x9y8z7w|auth-bug]]
// note ::: supersedes [[old-impl]] with new approach
```

**Reference forms**:

- `[[hash]]` - Reference by hash (most stable)
- `[[hash|alias]]` - Reference with alias hint (readable + stable)
- `[[alias]]` - Reference by alias (readable, resolves to hash)

### ID Normalization

Tooling normalizes IDs for consistency:

- Hashes are lowercase
- Aliases are lowercase with hyphens
- Whitespace around `|` separator is trimmed
- Invalid characters are rejected

```typescript
// Input (non-canonical):
// todo ::: [[ A1B2C3D | My Alias ]] fix bug

// Output (normalized):
// todo ::: [[a1b2c3d|my-alias]] fix bug
```

### Configuration

Control ID behavior in `.waymark/config.yaml`:

```yaml
ids:
  enabled: true # Enable ID features (default: true)
  auto_assign: false # Auto-assign hashes on format (default: false)
  track_history: true # Track ID removals in history.json (default: false)
  alias_required: false # Require aliases for new IDs (default: false)
```

## 8. Grammar Reference

```ebnf
WAYMARK       = HWS, COMMENT, HWS?, [SIGNALS], MARKER, HWS, ":::", HWS, CONTENT? ;
HWS           = { " " | "\t" } ;
COMMENT       = COMMENT_LEADER ;
SIGNALS       = ["~"] , ["*"] ;
MARKER        = LOWER , { LOWER | DIGIT | "_" | "-" } ;
CONTENT       = { TOKEN | HWS } ;
TOKEN         = WAYMARK_ID | RELATION | SYM_PROP | PROPERTY | MENTION | HASHTAG | TEXT ;
WAYMARK_ID    = "[[", ID_BODY, "]]" ;
ID_BODY       = HASH_ID, [ "|", ALIAS ] | ALIAS ;
HASH_ID       = ALNUM_LOWER, ALNUM_LOWER, ALNUM_LOWER, ALNUM_LOWER, ALNUM_LOWER, ALNUM_LOWER, ALNUM_LOWER ;
ALIAS         = LOWER, { LOWER | DIGIT | "-" } ;
ALNUM_LOWER   = LOWER | DIGIT ;
RELATION      = REL_KEY, ":", ( HASH_TOKEN | ID_REF ) ;
ID_REF        = "[[", ID_BODY, "]]" ;
REL_KEY       = "ref" | "see" | "docs" | "from" | "replaces" ;
SYM_PROP      = "sym", ":", SYMBOL ;
SYMBOL        = ( ALPHA | "_" ) , { ALNUM | "_" } ;
PROPERTY      = KEY, ":", VALUE ;
KEY           = ALPHA , { ALPHA | DIGIT | "_" | "-" } ;
VALUE         = UNQUOTED | QUOTED ;
UNQUOTED      = { CHAR_NO_WS_NO_COLON } ;
QUOTED        = '"' , { CHAR | ESCAPED } , '"' ;
ESCAPED       = "\\" , ( '"' | "\\" );
MENTION       = "@" , LOWER , { ALNUM | "_" | "-" | "." } ;
HASHTAG       = "#" , IDENT_NS ;
HASH_TOKEN    = "#" , IDENT_NS ;
IDENT_NS      = ALNUM , { ALNUM | "_" | "-" | "." | "/" | ":" } ;
```

## 9. Reference Examples

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

## 10. Implementation Notes

- Parsers should normalize signals to `~` and `*`, lowercase markers, trim extra spaces, and emit structured records matching the `WaymarkRecord` schema in `@waymarks/grammar`.
- Formatters must enforce a single space around `:::` when a marker is present.
- Continuation lines are context-sensitive: markerless `:::` is only parsed as a continuation when following a waymark. Isolated `:::` lines are ignored.
- Property-as-marker continuations only trigger for known property keys (not blessed markers like `needs` or `blocks`).
- Tooling should warn on unknown markers, duplicate properties, multiple TLDRs per file, and codetag patterns.

This specification is canonical. When the grammar evolves, update `docs/GRAMMAR.md` and the `using-waymarks` skill in `packages/agents/skills/using-waymarks/` alongside the code so guidance stays aligned.
