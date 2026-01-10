<!-- tldr ::: complete waymark grammar specification for syntax and semantics -->

# Waymark Grammar Reference

This reference covers the complete waymark syntax, structure, and parsing rules.

## Basic Syntax

### Line Form

```text
[comment-leader] [signals][type] ::: [content]
```

**Components:**

1. **Comment leader** - Language-specific comment syntax (`//`, `#`, `<!--`, `--`, etc.)
2. **Signals** (optional) - State indicators: `~` (flagged), `*` (starred)
3. **Type** (required) - Single lowercase keyword (e.g., `todo`, `fix`, `note`)
4. **Sigil** (required) - Three colons `:::`
5. **Content** (optional) - Free text with embedded tokens

**Spacing rules:**

- Exactly **one space before** `:::` when a type is present
- Exactly **one space after** `:::`
- Parsers tolerate extra whitespace; formatters normalize to canonical form

### Comment Leaders

| Language | Leader | Example |
|----------|--------|---------|
| TypeScript, JavaScript, Rust, Go | `//` | `// todo ::: fix bug` |
| Python, Ruby, Shell, YAML | `#` | `# note ::: assumes UTC` |
| SQL | `--` | `-- fix ::: escape quotes` |
| HTML, XML, Markdown | `<!-- -->` | `<!-- tldr ::: API guide -->` |
| CSS | `/* */` | `/* warn ::: deprecated */` |

Line comments are preferred. Use block comments only in languages without line-comment support.

### The `:::` Sigil

- **Three ASCII colons** (U+003A)
- **Constant across all languages**
- **Always present**, even if content is empty

## Signals

### Flagged (`~`)

The tilde marks a waymark as actively in progress on the current branch:

```typescript
// ~todo ::: refactoring auth module
// ~fix ::: handle edge case with empty arrays
```

**Meaning:** "I am currently working on this. Must clear before merging."

### Starred (`*`)

The star marks high priority or importance:

```typescript
// *fix ::: security vulnerability in auth handler
// *todo ::: critical path for launch
```

**Meaning:** "This is important. Pay attention."

### Combining Signals

When both are present, use `~*` (flagged first):

```typescript
// ~*todo ::: urgent fix I am actively working on
```

**Invalid:**

- `**` (double star)
- `~~` (double tilde)
- `*~` (reversed order - parsers accept but formatters normalize to `~*`)

| Waymark | Meaning |
|---------|---------|
| `todo` | A task |
| `*todo` | An important task |
| `~todo` | A task I am working on |
| `~*todo` | An important task I am working on |

## Multi-line Waymarks

### Continuation Syntax

Use markerless `:::` lines to continue waymark content:

```typescript
// todo ::: implement OAuth flow
//      ::: with PKCE support
//      ::: and token refresh
```

**Rules:**

- Continuation lines use `:::` without a type
- Only valid immediately following a waymark line
- Context-sensitive: plain `:::` outside waymark context is ignored

### Property Continuations

Known property keys can act as pseudo-markers in continuation context:

```typescript
// tldr  ::: payment processor service
// see   ::: #payments/core
// owner ::: @alice
// since ::: 2025-01-01
```

Known property keys: `see`, `docs`, `from`, `replaces`, `owner`, `since`, `fixes`, `affects`, `priority`, `status`, `sym`.

### Alignment

Formatters align continuation `:::` with the parent waymark's sigil:

```typescript
// todo ::: long task description
//      ::: continues here
//  ref ::: #some/anchor
```

## Properties

### Basic Properties

Properties are `key:value` pairs in the content:

```typescript
// todo ::: implement caching owner:@alice priority:high
```

**Key format:** `[A-Za-z][A-Za-z0-9_-]*`
**Value format:** Unquoted token (no spaces) or quoted string

### Quoted Values

Use double quotes for values containing spaces:

```typescript
// note ::: reason:"waiting for API approval" status:blocked
```

**Escape sequences:** `\"` (literal quote), `\\` (literal backslash)

### Duplicate Keys

If a key appears multiple times, the **last value wins**. Linters warn on duplicates.

### Symbol Binding (`sym:`)

Associate a waymark with a specific code symbol:

```typescript
// todo ::: sym:handleAuth implement token refresh
// about ::: sym:AuthService manages user sessions
```

## Canonical References

### Declaring Canonicals

Use `ref:#token` to declare the authoritative anchor:

```typescript
// tldr ::: authentication service ref:#auth/service
```

### Token Format

Pattern: `#[A-Za-z0-9._/-]+`

- Lowercase only
- Use namespaces: `#area/feature` (e.g., `#payments/stripe`)
- Use delimiters: `/`, `.`, `-`, `:` for hierarchy

### Uniqueness

One canonical per token, repository-wide. Linters error on duplicates.

## Relations

### Relation Types

- `see:#token` - Related waymark or reference
- `docs:#token` - Documentation reference
- `from:#token` - Depends on or derived from another waymark
- `replaces:#token` - Supersedes another waymark

**Syntax:** Hash is always on the value:

```typescript
// Correct:
// todo ::: implement refunds from:#payments/charge

// Incorrect:
// todo ::: implement refunds #from:payments/charge
```

## Tags (Hashtags)

### Tag Syntax

Any `#` followed by non-whitespace:

```typescript
// todo ::: optimize query #perf:hotpath
// fix ::: XSS vulnerability #sec:boundary
```

**Pattern:** `#[A-Za-z0-9._/:%-]+`

### Namespaces

```typescript
#docs/api          // Documentation about API
#perf:hotpath      // Performance hotspot
#sec:boundary      // Security boundary
#arch/entrypoint   // Architectural entry point
```

## Mentions (Actors)

### Actor Syntax

Mentions start with `@` followed by a **lowercase letter**:

```typescript
// todo ::: @agent implement OAuth flow
// review ::: @alice check security implications
```

**Pattern:** `@[a-z][A-Za-z0-9._-]*`

The lowercase-first requirement prevents false positives from decorators (`@Component`) and scoped packages (`@angular/core`).

### Delegation

Place actor immediately after `:::` to assign ownership:

```typescript
// todo ::: @agent add rate limiting
```

Mentions later indicate involvement without ownership:

```typescript
// todo ::: @alice coordinate with @backend team
// Ownership: @alice
// Involvement: @backend
```

## Grammar Rules (EBNF)

```ebnf
WAYMARK   = HWS, COMMENT, HWS?, [SIGNALS], MARKER, HWS, ":::", HWS, CONTENT? ;
HWS       = { " " | "\t" } ;
SIGNALS   = ["~"] , ["*"] ;
MARKER    = LOWER , { LOWER | DIGIT | "_" | "-" } ;
CONTENT   = { TOKEN | HWS } ;
TOKEN     = RELATION | PROPERTY | MENTION | HASHTAG | TEXT ;
RELATION  = REL_KEY, ":", HASH_TOKEN ;
REL_KEY   = "ref" | "see" | "docs" | "from" | "replaces" ;
PROPERTY  = KEY, ":", VALUE ;
KEY       = ALPHA , { ALPHA | DIGIT | "_" | "-" } ;
VALUE     = UNQUOTED | QUOTED ;
MENTION   = "@" , LOWER , { ALNUM | "_" | "-" | "." } ;
HASHTAG   = "#" , IDENT_NS ;
```

## Anti-patterns

**Avoid:**

- Waymarks inside string literals or docstrings
- Double signals (`**`, `~~`)
- Hash on property keys (`#from:auth` should be `from:#auth`)
- One-off tags without checking existing patterns
- Numeric-only hashtags (collision with issue numbers)
