<!-- tldr ::: comprehensive waymark grammar specification defining syntax, semantics, and parsing rules #docs/grammar -->

# Waymark Grammar Specification

The canonical reference for waymark syntax, structure, and semantics.

## Table of Contents

- [Overview](#overview)
- [Basic Syntax](#basic-syntax)
  - [Line Form](#line-form)
  - [Comment Leaders](#comment-leaders)
  - [The `:::` Sigil](#the--sigil)
- [Signals](#signals)
  - [Raised (`~`)](#raised-)
  - [Starred (`*`)](#starred-)
  - [Combining Signals](#combining-signals)
- [Types (Markers)](#types-markers)
  - [Blessed Types](#blessed-types)
  - [Special Treatment](#special-treatment)
  - [Custom Types](#custom-types)
- [Multi-line Waymarks](#multi-line-waymarks)
  - [Continuation Syntax](#continuation-syntax)
  - [Property Continuations](#property-continuations)
  - [Alignment](#alignment)
- [Properties](#properties)
  - [Basic Properties](#basic-properties)
  - [Quoted Values](#quoted-values)
  - [Duplicate Keys](#duplicate-keys)
- [Canonical References](#canonical-references)
  - [Declaring Canonicals](#declaring-canonicals)
  - [Token Format](#token-format)
  - [Uniqueness Rules](#uniqueness-rules)
- [Relations](#relations)
  - [Relation Types](#relation-types)
  - [Dependency Tracking](#dependency-tracking)
  - [Dangling Relations](#dangling-relations)
- [Waymark IDs](#waymark-ids)
  - [ID Format](#id-format)
  - [Hash Generation](#hash-generation)
  - [Aliases](#aliases)
  - [Referencing IDs](#referencing-ids)
  - [ID Normalization](#id-normalization)
  - [Configuration](#configuration)
- [Tags (Hashtags)](#tags-hashtags)
  - [Tag Syntax](#tag-syntax)
  - [Namespaces](#namespaces)
  - [Common Tag Patterns](#common-tag-patterns)
- [Mentions (Actors)](#mentions-actors)
  - [Actor Syntax](#actor-syntax)
  - [Delegation](#delegation)
  - [Actor Groups](#actor-groups)
- [Record Model](#record-model)
  - [Parsed Record Structure](#parsed-record-structure)
  - [JSON Schema](#json-schema)
- [Grammar Rules (EBNF)](#grammar-rules-ebnf)
- [Parsing Behavior](#parsing-behavior)
  - [Normalization](#normalization)
  - [Error Handling](#error-handling)
- [Examples](#examples)
  - [TypeScript](#typescript)
  - [Python](#python)
  - [Go](#go)
  - [Markdown](#markdown)
  - [Complex Examples](#complex-examples)
- [Anti-patterns](#anti-patterns)
- [Migration Notes](#migration-notes)

---

## Overview

A waymark is a structured comment that embeds machine-readable context directly adjacent to code. Waymarks are:

- **Greppable** - Find all waymarks with `rg ':::'`
- **Language-agnostic** - Works in any language with comments
- **Tool-independent** - Parse without AST access
- **Durable** - Survives refactors and formatting

**Core principle**: Everything after the `:::` sigil is free-form content, but we extract structured data (properties, tags, mentions) using simple token patterns.

## Waymarks Are Not Docstrings

Waymarks **complement** docstrings; they never replace them. Docstrings describe public APIs for external consumers, while waymarks capture internal intent, ownership, and next steps.

- **Docstrings**: API contracts, parameters, return values, examples.
- **Waymarks**: why/ownership/next steps, operational notes, migration cues.

Place waymarks adjacent to docstrings, never inside them:

```typescript
/**
 * Authenticates a user and returns a session token.
 * @param request - User login credentials
 * @returns Session token or throws AuthError
 */
// about ::: orchestrates OAuth flow with PKCE #auth/login
// todo ::: @agent add rate limiting #sec:boundary
export async function authenticate(request: AuthRequest) {
  // ...
}
```

---

## Basic Syntax

### Line Form

```text
[comment-leader] [signals][type] ::: [content]
```

**Components**:

1. **Comment leader** - Language-specific comment syntax (`//`, `#`, `<!--`, etc.)
2. **Signals** (optional) - State indicators: `~` (raised), `*` (starred)
3. **Type** (required) - Single lowercase keyword (e.g., `todo`, `fix`, `note`)
4. **Sigil** (required) - Three colons `:::`
5. **Content** (optional) - Free text with embedded tokens

**Spacing rules**:

- Exactly **one space before** `:::` when a type is present
- Exactly **one space after** `:::`
- Parsers tolerate extra whitespace; formatters normalize to canonical form

**Example**:

```typescript
// todo ::: implement rate limiting
```

### Comment Leaders

Waymarks work with any comment syntax:

| Language | Leader | Example |
| ---------- | -------- | --------- |
| TypeScript, JavaScript, Rust, Go | `//` | `// todo ::: fix bug` |
| Python, Ruby, Shell, YAML | `#` | `# note ::: assumes UTC` |
| SQL | `--` | `-- fix ::: escape quotes` |
| HTML, XML, Markdown | `<!-- -->` | `<!-- tldr ::: API guide -->` |
| CSS (and other languages without line comments) | `/* */` | `/* warn ::: deprecated */` |

**Block comments**: Allowed for waymarks only in languages without line-comment support. Avoid placing waymarks inside docstrings.
Line comments are preferred whenever available.

### The `:::` Sigil

The `:::` sigil is the delimiter between type and content:

- **Three ASCII colons** (U+003A)
- **Constant across all languages**
- **Always present**, even if content is empty

**Why `:::`?**

- Visually distinctive
- Rare in natural text/code
- Tokenizes as a single token in most LLMs
- Easy to type

---

## Signals

Signals are optional prefixes that indicate state or priority.

### Raised (`~`)

Marks work-in-progress waymarks that are branch-scoped.

```typescript
// ~todo ::: refactoring auth module
// ~wip ::: implementing OAuth flow
```

**Semantics**:

- Indicates active development
- Use for temporary/branch-specific annotations

### Starred (`*`)

Marks high-priority or important waymarks.

```typescript
// *fix ::: memory leak in cache
// *review ::: security-critical code path
```

**Semantics**:

- Highlights importance
- Surfaces in filtered views/dashboards
- No automatic enforcement (informational only)

### Combining Signals

When both signals are needed, order is `~*`:

```typescript
// ~*todo ::: critical WIP - OAuth token refresh
```

**Invalid**:

- `**` (double star) - not part of v1 grammar
- `~~` (double tilde) - not part of v1 grammar
- `*~` (reversed order) - not part of v1 grammar

---

## Types (Markers)

Types categorize the waymark's intent.

### Blessed Types

These types are first-class and built into the tooling:

**Work / Action**

- `todo` - Task to complete
- `fix` (alias: `fixme`) - Bug to fix
- `wip` - Work in progress
- `done` - Completed task (temporary marker for handoff)
- `review` - Needs code review
- `test` - Needs testing
- `check` - Needs verification

**Information**

- `note` - General observation
- `context` (alias: `why`) - Contextual explanation
- `tldr` - File/module summary (one per file)
- `about` - Section/block summary
- `example` - Example usage
- `idea` - Suggestion or proposal
- `comment` - General comment

**Caution / Quality**

- `warn` - Warning or caution
- `alert` - Important alert
- `deprecated` - Deprecated code
- `temp` (alias: `tmp`) - Temporary code
- `hack` (alias: `stub`) - Workaround or temporary solution

**Workflow**

- `blocked` - Blocked by external dependency
- `needs` - Requires something

**Inquiry**

- `question` (alias: `ask`) - Question or uncertainty

### Special Treatment

#### `tldr` (File Summary)

- **Placement**: First waymark in the file (after shebang/front-matter)
- **Frequency**: Exactly one per file
- **Format**: Single sentence, 8-14 words, active voice
- **Purpose**: Machine-readable file summary

**Example**:

```typescript
// tldr ::: Stripe webhook handler verifying signatures and queuing retries
```

**Documentation TLDRs**: Use in HTML comments with `#docs` tag:

```markdown
<!-- tldr ::: REST API documentation for backend services #docs/api -->
```

#### `about` (Section Summary)

- **Placement**: Immediately before the section it describes
- **Frequency**: Multiple per file
- **Scope**: Local to the following code block/class/function

**Example**:

```typescript
// about ::: validates webhook signatures using HMAC-SHA256
function verifySignature(payload: string, signature: string): boolean {
  // ...
}
```

### Custom Types

Custom types are allowed but require configuration:

```toml
allow_types = ["todo", "fix", "note", "custom", "mytodo"]
```

Without allowlisting, unknown types trigger lint warnings.

---

## Multi-line Waymarks

### Continuation Syntax

Use markerless `:::` lines to continue waymark content across multiple lines:

```typescript
// todo ::: implement OAuth flow
//      ::: with PKCE support
//      ::: and token refresh
```

**Rules**:

- Continuation lines use `:::` without a type (markerless)
- Only valid immediately following a waymark line
- Context-sensitive: plain `:::` outside waymark context is ignored by parsers
- Properties and tokens (mentions, tags, relations) can appear on continuation lines
- Each continuation line inherits the parent waymark's context

**Context sensitivity**: A markerless `:::` only becomes a continuation when the parser is tracking an active waymark. Isolated `:::` lines in code (e.g., random comments containing `:::`) are safely ignored.

```typescript
// This is NOT a continuation (no preceding waymark):
// ::: this line is ignored by the parser

// todo ::: this starts a waymark
//      ::: this IS a valid continuation
```

### Property Continuations

Properties can act as pseudo-markers in continuation context, but **only for known property keys**:

```typescript
// tldr  ::: payment processor service
// see   ::: #payments/core
// owner ::: @alice
// since ::: 2025-01-01
```

Parsed as a single `tldr` waymark with three properties:

```json
{
  "type": "tldr",
  "contentText": "payment processor service",
  "properties": {
    "see": "#payments/core",
    "owner": "@alice",
    "since": "2025-01-01"
  }
}
```

**Known property keys** that trigger property continuation parsing:

- `see` - Related reference
- `docs` - Documentation reference
- `from` - Depends on or derived from
- `replaces` - Supersedes another waymark
- `owner` - Ownership assignment
- `since` - Date tracking
- `fixes` - Issue reference
- `affects` - Impact scope
- `priority` - Priority level
- `status` - Status indicator
- `sym` - Symbol reference

**Important**: Blessed markers (like `needs` or `blocks`) are NOT treated as property continuations even when followed by `:::`. A line like `// needs ::: something` starts a new waymark, not a continuation:

```typescript
// todo ::: implement feature
// needs ::: database migration first  // <-- This is a NEW waymark, not a continuation
```

### HTML Comment Continuations

Multi-line waymarks in HTML comments require proper closing on each line:

```html
<!-- tldr ::: component library documentation -->
<!--       ::: covers setup and API reference -->
<!--       ::: includes migration guides -->
```

The formatter ensures each continuation line:

- Preserves the `<!-- ... -->` structure
- Aligns `:::` with the parent waymark
- Maintains proper closing `-->`

### Alignment

Formatters align continuation `:::` with the parent waymark's sigil by default:

```typescript
// Before formatting:
// todo ::: long task description
// ::: continues here
// ref ::: #some/anchor

// After formatting:
// todo ::: long task description
//      ::: continues here
//  ref ::: #some/anchor
```

The alignment target is the `:::` position in the first line. This creates a visual column that makes multi-line waymarks easier to scan.

**Configuration**:

```toml
[format]
align_continuations = true   # default: align continuation ::: with parent
space_around_sigil = true    # default: single space before and after :::
normalize_case = true        # default: lowercase markers
```

When `align_continuations` is `false`, continuations appear flush with the comment leader:

```typescript
// With align_continuations = false:
// todo ::: long task description
// ::: continues here
```

### Whitespace Normalization

Parsers tolerate flexible spacing around `:::`:

```typescript
// All of these parse identically:
// todo ::: description
// todo:::description
// todo  :::  description
```

Formatters normalize to canonical form (single space before and after `:::` when a marker is present):

```typescript
// Canonical form:
// todo ::: description
```

---

## Properties

### Basic Properties

Properties are `key:value` pairs in the content:

```typescript
// todo ::: implement caching owner:@alice priority:high
```

**Key format**: `[A-Za-z][A-Za-z0-9_-]*`

**Value format**: Unquoted token (no spaces) or quoted string

**Extraction**: Properties are extracted from content and stored separately in the parsed record.

### Quoted Values

Use double quotes for values containing spaces:

```typescript
// note ::: reason:"waiting for API approval" status:blocked
```

**Escape sequences**:

- `\"` - Literal quote
- `\\` - Literal backslash

### Duplicate Keys

If a key appears multiple times, the **last value wins**:

```typescript
// todo ::: fix bug owner:@alice owner:@bob
// Result: { owner: "@bob" }
```

Linters warn on duplicates.

### Symbol Binding (`sym:`)

The `sym:` property associates a waymark with a specific code symbol:

```typescript
// todo ::: sym:handleAuth implement token refresh
// fix ::: sym:validateInput escape special characters
// about ::: sym:AuthService manages user sessions
```

**Purpose**:

- Links waymarks to named symbols (functions, classes, variables)
- Enables symbol-to-waymark indexing
- Helps tooling track waymarks across refactors
- Allows validation that referenced symbols exist

**Value format**: Bare identifier matching `[A-Za-z_][A-Za-z0-9_]*`

**Rules**:

- One `sym:` per waymark (duplicates overwrite)
- Symbol should exist in the same file or be imported
- Linters may warn on unresolved symbols

**Extraction**: The `sym` property is stored in the record's `properties` field:

```json
{
  "type": "todo",
  "contentText": "implement token refresh",
  "properties": {
    "sym": "handleAuth"
  }
}
```

---

## Canonical References

### Declaring Canonicals

Use `ref:#token` to declare the authoritative anchor for a concept:

```typescript
// tldr ::: authentication service ref:#auth/service
```

**Purpose**: Create stable identifiers that other waymarks can reference.

### Token Format

Tokens follow this pattern: `#[A-Za-z0-9._/-]+`

**Best practices**:

- Lowercase only
- Use namespaces: `#area/feature` (e.g., `#payments/stripe`)
- Use delimiters: `/`, `.`, `-`, `:` for hierarchy

**Examples**:

- `#auth/service`
- `#payments/stripe-webhook`
- `#cache.redis`
- `#api:v2`

### Uniqueness Rules

**Scope**: Repository-wide by default (configurable to file-scope)

**Constraint**: One canonical per token

**Collision detection**:

```bash
rg 'ref:#auth/service'  # Should find exactly one result
```

Linters error on duplicate canonicals.

---

## Relations

### Relation Types

Relations express dependencies between waymarks:

- `see:#token` - Related waymark or reference
- `docs:#token` - Documentation reference
- `from:#token` - Depends on or derived from another waymark
- `replaces:#token` - Supersedes another waymark

**Syntax**: Hash is always on the value, not the key:

```typescript
// Correct:
// todo ::: implement refunds from:#payments/charge

// Incorrect:
// todo ::: implement refunds #from:payments/charge
```

### Dependency Tracking

Use relations to track dependencies:

```typescript
// File: src/payments/charge.ts
// tldr ::: charge processing service ref:#payments/charge

// File: src/payments/refund.ts
// todo ::: implement refund flow from:#payments/charge
```

Extract graph:

```bash
wm src/ --graph
```

### Dangling Relations

A relation is "dangling" if it references a non-existent canonical:

```typescript
// Error: no canonical for #nonexistent
// todo ::: fix bug from:#nonexistent
```

Linters error on dangling relations.

---

## Waymark IDs

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

**In relations**:

Relations can reference waymarks by ID instead of (or in addition to) canonical tokens:

```typescript
// todo ::: implement caching from:[[a1b2c3d]] see:#cache/redis
// fix ::: resolve bug replaces:[[old-fix|deprecated-workaround]]
```

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

Control ID behavior in `.waymark/config.toml`:

```toml
[ids]
enabled = true              # Enable ID features (default: true)
auto_assign = false         # Auto-assign hashes on format (default: false)
track_history = true        # Track ID removals in history.json (default: false)
alias_required = false      # Require aliases for new IDs (default: false)
```

### Migration from Legacy Format

The previous `wm:xxx` format is deprecated. Migrate using:

```bash
wm migrate-ids --write      # Convert wm:xxx to [[xxx]] format
```

**Before**:

```typescript
// todo ::: wm:a1b2c3d implement feature
```

**After**:

```typescript
// todo ::: [[a1b2c3d]] implement feature
```

---

## Tags (Hashtags)

### Tag Syntax

Any `#` followed by non-whitespace is a tag:

```typescript
// todo ::: optimize query #perf:hotpath
// fix ::: XSS vulnerability #sec:boundary
```

**Pattern**: `#[A-Za-z0-9._/:%-]+`

### Namespaces

Use namespaces for organization:

```typescript
#docs/api          // Documentation about API
#docs/guide        // User guide
#perf:hotpath      // Performance hotspot
#perf:slow         // Slow operation
#sec:boundary      // Security boundary
#sec:auth          // Authentication
#arch/entrypoint   // Architectural entry point
```

### Common Tag Patterns

| Purpose | Pattern | Example |
| --------- | --------- | --------- |
| Documentation | `#docs/*` | `#docs/api`, `#docs/guide` |
| Performance | `#perf:*` | `#perf:hotpath`, `#perf:slow` |
| Security | `#sec:*` | `#sec:boundary`, `#sec:auth` |
| Architecture | `#arch/*` | `#arch/entrypoint`, `#arch/state` |

**Discovery**: Before inventing a tag, search for existing usage:

```bash
rg '#perf'  # Find all performance tags
```

---

## Mentions (Actors)

### Actor Syntax

Mentions start with `@` followed by a **lowercase letter**:

```typescript
// todo ::: @agent implement OAuth flow
// review ::: @alice check security implications
// todo ::: @dev-team coordinate rollout
```

**Pattern**: `@[a-z][A-Za-z0-9._-]*`

The lowercase-first requirement prevents false positives from common `@`-prefixed patterns in code.

### Mention Validation

Parsers must reject patterns that look like mentions but are not:

| Pattern | Example | Why Rejected |
| ------- | ------- | ------------ |
| Email addresses | `user@domain.com` | `@` appears mid-word (preceded by non-whitespace) |
| Decorators | `@Component`, `@Injectable` | Starts with uppercase letter |
| Scoped packages | `@scope/package`, `@angular/core` | Contains `/` immediately after identifier start |
| Uppercase handles | `@Alice`, `@ADMIN` | Must start with lowercase |

**Valid mentions**:

```typescript
// todo ::: @alice implement feature           // Valid: lowercase start
// todo ::: @agent add caching                 // Valid: lowercase start
// todo ::: @dev-team review changes           // Valid: lowercase with hyphen
// todo ::: @bob.smith coordinate rollout      // Valid: lowercase with dot
```

**Invalid patterns** (not extracted as mentions):

```typescript
// note ::: contact user@example.com           // Email - NOT a mention
// note ::: uses @Component decorator          // Decorator - NOT a mention
// note ::: depends on @angular/core           // Scoped package - NOT a mention
// note ::: assigned to @Alice                 // Uppercase - NOT a mention
```

**Mixed content** extracts only valid mentions:

```typescript
// todo ::: @alice contact user@example.com
// Extracted mentions: ["@alice"]
// "user@example.com" is ignored (email pattern)

// note ::: @agent review the @Injectable usage
// Extracted mentions: ["@agent"]
// "@Injectable" is ignored (uppercase start)
```

### Delegation

Place actor **immediately after `:::`** to assign ownership:

```typescript
// todo ::: @agent add rate limiting
```

Mentions later in the sentence indicate involvement without ownership:

```typescript
// todo ::: @alice coordinate with @backend team
// Ownership: @alice
// Involvement: @backend
```

### Actor Groups

Define groups in configuration:

```toml
[groups]
agents = ["@agent", "@claude", "@codex", "@cursor"]
backend = ["@alice", "@bob"]
frontend = ["@charlie", "@dana"]
```

Use in searches:

```bash
wm src/ --mention @agents  # Matches all agent handles
```

---

## Record Model

### Parsed Record Structure

Every waymark parses into a structured record:

```typescript
interface WaymarkRecord {
  file: string;              // "src/auth.ts"
  language: string | null;   // "ts"
  fileCategory: string;      // "code" | "docs" | "config" | "data" | "test"
  startLine: number;         // 42
  endLine: number;           // 42 (or last continuation line)
  indent: number;            // 0
  commentLeader: string | null; // "//"
  signals: {
    raised: boolean;         // false
    important: boolean;      // true
  };
  type: string;              // "fix"
  id: {                      // Waymark ID (optional)
    hash: string | null;     // "a1b2c3d" (7-char alphanumeric)
    alias: string | null;    // "auth-bug" (human-readable)
  } | null;
  contentText: string;       // "validate email format"
  properties: Record<string, string>; // { owner: "@alice" }
  relations: Array<{         // [{ kind: "depends", token: "#auth" }]
    kind: string;
    token: string;           // "#auth" or "[[a1b2c3d]]"
  }>;
  canonicals: string[];      // ["#auth/service"]
  mentions: string[];        // ["@alice"]
  tags: string[];            // ["#sec"]
  raw: string;               // "// *fix ::: validate email ..."
}
```

### JSON Schema

See `schemas/waymark-record.schema.json` for the authoritative JSON Schema (draft 2020-12).

**Key constraints**:

- `startLine`, `endLine` ≥ 1
- `indent` ≥ 0
- `type` is required
- Relations must have `kind` and `token`
- Tokens match `^#[A-Za-z0-9._/-]+$` or `^\[\[[a-z0-9-|]+\]\]$` (ID reference)
- Mentions match `^@[a-z][A-Za-z0-9._-]*$` (must start with lowercase)
- Symbol bindings (`sym` property) match `^[A-Za-z_][A-Za-z0-9_]*$`
- ID hashes match `^[a-z0-9]{7}$` (7 lowercase alphanumeric characters)
- ID aliases match `^[a-z][a-z0-9-]*$` (lowercase kebab-case)

---

## Grammar Rules (EBNF)

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

**Key changes from earlier drafts**:

- `WAYMARK_ID` adds wikilink-style ID support (`[[hash]]`, `[[hash|alias]]`, `[[alias]]`)
- `ID_REF` allows relations to reference IDs (`from:[[a1b2c3d]]`)
- `SYM_PROP` extracts symbol bindings (`sym:functionName`)
- `MENTION` requires lowercase first character to avoid decorators (`@Component`) and scoped packages (`@angular/core`)

---

## Parsing Behavior

### Normalization

Parsers must:

1. **Detect comment leaders** by file extension
2. **Extract signals** (`~`, `*`)
3. **Normalize type** to lowercase
4. **Trim whitespace** around `:::`
5. **Extract tokens**:
   - Relations (reserved keys: `ref`, `see`, `from`, etc.)
   - Properties (other `key:value` pairs)
   - Mentions (`@actor`)
   - Tags (`#token`)
6. **Preserve raw form** in `raw` field

### Error Handling

**Tolerant parsing**: Parsers should accept malformed input and extract what they can.

**Linter validation**: Linters enforce stricter rules:

- Unknown markers → warning (`unknown-marker`)
- Duplicate properties → warning (`duplicate-property`)
- Multiple TLDRs in a file → error (`multiple-tldr`)
- Legacy codetag patterns → warning (`legacy-pattern`)

---

## Examples

### TypeScript

```typescript
// tldr ::: authentication service ref:#auth/service

export class AuthService {
  // about ::: manages user sessions and JWT tokens

  // todo ::: @agent add refresh token rotation from:#auth/jwt
  // priority:high
  async login(credentials: Credentials): Promise<Session> {
    // *fix ::: validate email format #sec:boundary
    return this.createSession(credentials);
  }

  // note ::: tokens expire after 24 hours
  // context ::: coordinate JWT changes with @backend team
  private createSession(credentials: Credentials): Session {
    // implementation
  }
}
```

### Python

```python
# tldr ::: Stripe webhook processor ref:#payments/webhook

def process_webhook(payload: dict) -> None:
    """Process incoming Stripe webhook events."""
    # about ::: validates signatures and routes events

    # *fix ::: verify signature before processing #sec
    signature = payload.get('signature')

    # todo ::: @agent add idempotency keys from:#payments/charge
    # note ::: see Stripe docs for signature verification
    pass
```

### Go

```go
// tldr ::: cache service with Redis backend ref:#cache/redis

package cache

// about ::: manages Redis connection pool
type CacheService struct {
    client *redis.Client
}

// todo ::: add circuit breaker from:#infra/resilience
// priority:high
func (c *CacheService) Get(key string) (string, error) {
    // note ::: keys expire after 1 hour #perf
    return c.client.Get(key).Result()
}
```

### Markdown

```markdown
<!-- tldr ::: REST API documentation for backend services #docs/api -->

# API Documentation

<!-- about ::: authentication endpoints -->

## Authentication

<!-- note ::: all endpoints require JWT tokens ref:#auth/jwt -->
<!-- todo ::: @agent document rate limiting #docs -->
```

### Complex Examples

**Multi-line with properties**:

```typescript
// todo  ::: refactor authentication flow to support OAuth 2.0
//       ::: coordinate with @backend team on token format
//       ::: update documentation when complete
// from:#auth/jwt
// see:#api/login
// priority:critical
// owner:@alice
```

**Dependency chain**:

```typescript
// File: src/auth/jwt.ts
// tldr ::: JWT token service ref:#auth/jwt

// File: src/auth/session.ts
// todo ::: implement session refresh from:#auth/jwt

// File: src/api/login.ts
// todo ::: add OAuth support from:#auth/session see:#api/register
```

**Security boundary**:

```typescript
// note ::: validates all inputs at API boundary #sec:boundary
// warn ::: XSS risk if input not sanitized #sec
export function validateInput(input: string): boolean {
  // *fix ::: add regex validation from:#security/rules
  return input.length > 0;
}
```

**With waymark IDs**:

```typescript
// tldr ::: [[f3g4h5j|auth-service]] authentication service ref:#auth/service
// todo ::: [[a1b2c3d]] implement token refresh from:#auth/jwt
// fix ::: [[x9y8z7w|rate-limit-bug]] add rate limiting see:[[a1b2c3d]]
// note ::: supersedes [[old-auth]] with new OAuth flow
```

**Draft IDs** (alias-only, hash assigned later):

```typescript
// todo ::: [[implement-caching]] add Redis caching layer
// idea ::: [[refactor-auth]] consider splitting auth module
```

---

## Anti-patterns

**Don't**:

❌ Place waymarks in string literals or docstrings:

```typescript
// Bad
const note = "// todo ::: fix this";  // Not a waymark
```

❌ Use double signals:

```typescript
// Bad
// **fix ::: critical bug  // Invalid syntax
```

❌ Put hash on property keys:

```typescript
// Bad
// todo ::: fix bug #from:auth  // Should be from:#auth
```

❌ Create one-off tags without checking existing patterns:

```typescript
// Bad
// todo ::: optimize #fast  // Check if #perf or #perf:optimize exists first
```

❌ Use numeric-only hashtags (collision with issue numbers):

```typescript
// Bad
// fix ::: #123  // Ambiguous - issue #123 or tag?
```

❌ Use legacy `wm:xxx` ID format (deprecated):

```typescript
// Bad
// todo ::: wm:a1b2c3d implement feature  // Use [[a1b2c3d]] instead
```

**Do**:

✅ Keep waymarks in non-rendered comments:

```typescript
// Good
// todo ::: implement feature
function foo() { /* ... */ }
```

✅ Use namespaced tags:

```typescript
// Good
// todo ::: optimize #perf:hotpath
```

✅ Check for existing canonicals before creating:

```bash
rg 'ref:#auth'  # See what exists first
```

✅ Use proper relation syntax:

```typescript
// Good
// todo ::: fix bug from:#auth/service
```

✅ Use wikilink-style IDs:

```typescript
// Good
// todo ::: [[a1b2c3d]] implement feature
// todo ::: [[a1b2c3d|my-feature]] implement feature with alias
// todo ::: [[my-feature]] draft ID (alias-only)
```

---

## Migration Notes

### From Legacy Comments

**TODO/FIXME conversion**:

```diff
- // TODO: implement caching
+ // todo ::: implement caching

- # FIXME: memory leak
+ # fix ::: memory leak

- <!-- NOTE: deprecated API -->
+ <!-- note ::: deprecated API -->
```

Use the `legacy-pattern` lint rule or enable `scan.include_codetags` to surface legacy codetags before converting them.

### From v1 Early Drafts

If you used earlier waymark syntax:

**Bang signals** (`!`, `!!`) → `*`:

```diff
- // !fix ::: critical bug
+ // *fix ::: critical bug
```

**Legacy marker names**:

```diff
- // FIXME ::: bug
+ // fix ::: bug

- // TODO ::: task
+ // todo ::: task
```

**Property-style hashes**:

```diff
- // todo ::: #from:auth
+ // todo ::: from:#auth
```

### From Legacy ID Format

The `wm:xxx` ID format is deprecated. Use wikilink-style `[[xxx]]` instead:

```diff
- // todo ::: wm:a1b2c3d implement feature
+ // todo ::: [[a1b2c3d]] implement feature

- // todo ::: wm:a1b2c3d|my-alias implement feature
+ // todo ::: [[a1b2c3d|my-alias]] implement feature
```

Run the migration command to convert all legacy IDs:

```bash
wm migrate-ids --write      # Convert wm:xxx to [[xxx]] format
```

---

## See Also

- [CLI Reference](./cli/README.md) - Command-line tools
- [How-To Guides](howto/README.md) - Practical usage examples
- [Waymark Specification](waymark/SPEC.md) - Canonical v1 grammar specification
- [JSON Schema](../schemas/waymark-record.schema.json) - Record schema
