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
  - [Raised (`^`)](#raised-)
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
// this ::: orchestrates OAuth flow with PKCE #auth/login
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
2. **Signals** (optional) - State indicators: `^` (raised), `*` (starred)
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

### Raised (`^`)

Marks work-in-progress waymarks that are branch-scoped.

```typescript
// ^todo ::: refactoring auth module
// ^wip ::: implementing OAuth flow
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

When both signals are needed, order is `^*`:

```typescript
// ^*todo ::: critical WIP - OAuth token refresh
```

**Invalid**:

- `**` (double star) - not part of v1 grammar
- `^^` (double caret) - not part of v1 grammar
- `*^` (reversed order) - not part of v1 grammar

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
- `this` - Section/block summary
- `example` - Example usage
- `idea` - Suggestion or proposal
- `comment` - General comment

**Caution / Quality**

- `warn` - Warning or caution
- `alert` - Important alert
- `deprecated` - Deprecated code
- `temp` (alias: `tmp`) - Temporary code
- `hack` - Workaround or temporary solution

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

#### `this` (Section Summary)

- **Placement**: Immediately before the section it describes
- **Frequency**: Multiple per file
- **Scope**: Local to the following code block/class/function

**Example**:

```typescript
// this ::: validates webhook signatures using HMAC-SHA256
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

Use markerless `:::` lines to continue waymark content:

```typescript
// todo ::: refactor authentication flow
//      ::: preserve backward-compatible API
//      ::: coordinate deployment with @devops
```

**Rules**:

- Continuation lines use `:::` without a type
- Only valid immediately following a waymark line
- Context-sensitive: plain `:::` outside waymark context is ignored

### Property Continuations

Properties can act as pseudo-markers in continuation context:

```typescript
// tldr  ::: payment processor service
// ref   ::: #payments/core
// owner ::: @alice
// since ::: 2025-01-01
```

Parsed as a single `tldr` waymark with three properties:

```json
{
  "type": "tldr",
  "contentText": "payment processor service",
  "properties": {
    "ref": "#payments/core",
    "owner": "@alice",
    "since": "2025-01-01"
  }
}
```

### Alignment

Formatters align continuation `:::` with parent waymark by default:

```typescript
// Before formatting:
// todo ::: long task description
// ::: continues here

// After formatting:
// todo ::: long task description
//      ::: continues here
```

Configuration:

```toml
[format]
align_continuations = true  # default
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

- `depends:#token` - Depends on another waymark
- `needs:#token` - Requires something
- `blocks:#token` - Blocks another waymark
- `dupeof:#token` - Duplicate of another issue
- `rel:#token` - Generic relation

**Syntax**: Hash is always on the value, not the key:

```typescript
// Correct:
// todo ::: implement refunds depends:#payments/charge

// Incorrect:
// todo ::: implement refunds #depends:payments/charge
```

### Dependency Tracking

Use relations to track dependencies:

```typescript
// File: src/payments/charge.ts
// tldr ::: charge processing service ref:#payments/charge

// File: src/payments/refund.ts
// todo ::: implement refund flow depends:#payments/charge
```

Extract graph:

```bash
wm src/ --graph
```

### Dangling Relations

A relation is "dangling" if it references a non-existent canonical:

```typescript
// Error: no canonical for #nonexistent
// todo ::: fix bug depends:#nonexistent
```

Linters error on dangling relations.

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

Mentions start with `@`:

```typescript
// todo ::: @agent implement OAuth flow
// review ::: @alice check security implications
```

**Pattern**: `@[A-Za-z0-9._-]+`

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
  contentText: string;       // "validate email format"
  properties: Record<string, string>; // { owner: "@alice" }
  relations: Array<{         // [{ kind: "depends", token: "#auth" }]
    kind: string;
    token: string;
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
- Tokens match `^#[A-Za-z0-9._/-]+$`
- Mentions match `^@[A-Za-z0-9._-]+$`

---

## Grammar Rules (EBNF)

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
HASH_TOKEN    = "#" , IDENT_NS ;
IDENT         = ALNUM , { ALNUM | "_" | "-" | "." } ;
IDENT_NS      = ALNUM , { ALNUM | "_" | "-" | "." | "/" | ":" } ;
```

---

## Parsing Behavior

### Normalization

Parsers must:

1. **Detect comment leaders** by file extension
2. **Extract signals** (`^`, `*`)
3. **Normalize type** to lowercase
4. **Trim whitespace** around `:::`
5. **Extract tokens**:
   - Relations (reserved keys: `ref`, `depends`, etc.)
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
  // this ::: manages user sessions and JWT tokens

  // todo ::: @agent add refresh token rotation depends:#auth/jwt
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
    # this ::: validates signatures and routes events

    # *fix ::: verify signature before processing #sec
    signature = payload.get('signature')

    # todo ::: @agent add idempotency keys depends:#payments/charge
    # note ::: see Stripe docs for signature verification
    pass
```

### Go

```go
// tldr ::: cache service with Redis backend ref:#cache/redis

package cache

// this ::: manages Redis connection pool
type CacheService struct {
    client *redis.Client
}

// todo ::: add circuit breaker depends:#infra/resilience
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

<!-- this ::: authentication endpoints -->

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
// depends:#auth/jwt
// blocks:#api/login
// priority:critical
// owner:@alice
```

**Dependency chain**:

```typescript
// File: src/auth/jwt.ts
// tldr ::: JWT token service ref:#auth/jwt

// File: src/auth/session.ts
// todo ::: implement session refresh depends:#auth/jwt

// File: src/api/login.ts
// todo ::: add OAuth support depends:#auth/session blocks:#api/register
```

**Security boundary**:

```typescript
// note ::: validates all inputs at API boundary #sec:boundary
// warn ::: XSS risk if input not sanitized #sec
export function validateInput(input: string): boolean {
  // *fix ::: add regex validation depends:#security/rules
  return input.length > 0;
}
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
// todo ::: fix bug #depends:auth  // Should be depends:#auth
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
// todo ::: fix bug depends:#auth/service
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

Use `wm migrate` command for automated conversion.

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
- // todo ::: #depends:auth
+ // todo ::: depends:#auth
```

---

## See Also

- [CLI Reference](./cli/README.md) - Command-line tools
- [How-To Guides](howto/README.md) - Practical usage examples
- [Waymark Specification](waymark/SPEC.md) - Canonical v1 grammar specification
- [JSON Schema](../schemas/waymark-record.schema.json) - Record schema
