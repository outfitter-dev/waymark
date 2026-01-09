<!-- tldr ::: complete grammar reference for waymark syntax and validation rules -->

# Waymark Grammar Specification

Complete grammar reference for waymark syntax.

## Formal Structure

```text
waymark     = leader signal? marker? sigil content
leader      = "//" | "#" | "<!--" | "--" | "%" | ";" | "rem"
signal      = "*"
marker      = "todo" | "fix" | "note" | ... (see marker list)
sigil       = " ::: "
content     = text (property | hashtag | mention)*
```

## Comment Leaders by Language

| Language | Leader | Example |
| ---------- | -------- | --------- |
| JavaScript/TypeScript | `//` | `// todo ::: implement` |
| Python/Ruby/Shell | `#` | `# todo ::: implement` |
| HTML/Markdown | `<!--` | `<!-- todo ::: implement -->` |
| SQL | `--` | `-- todo ::: implement` |
| Lua | `--` | `-- todo ::: implement` |
| LaTeX | `%` | `% todo ::: implement` |
| Lisp | `;` | `; todo ::: implement` |
| Batch | `rem` | `rem todo ::: implement` |

## Signal Rules

Two signals are valid: `~` (flagged) and `*` (starred):

```javascript
// ~todo ::: work in progress, don't merge yet
// *fix ::: high priority bug
// ~*todo ::: flagged and starred (~ always before *)
```

**Invalid signals:**

- `^` (not valid)
- `!`, `!!`, `?` (never valid)
- `**` (double star invalid)
- `*~` (wrong order - use `~*`)

## Marker Validation

Markers must be:

- Lowercase only
- From the blessed list (or custom-configured)
- Single word, no spaces
- Followed by space before `:::`

```javascript
// Valid
// todo ::: implement feature
// fix ::: resolve bug

// Invalid
// TODO ::: uppercase not allowed
// to-do ::: hyphens not allowed
// todo::: missing space
```

## Property Syntax

```text
property = key ":" value
key      = [A-Za-z][A-Za-z0-9_-]*
value    = unquoted | quoted
unquoted = [^\s"]+
quoted   = '"' ([^"\\] | '\\' .)* '"'
```

**Examples:**

```javascript
// todo ::: priority:high implement feature
// note ::: owner:@alice since:2025-01-01
// todo ::: message:"fix the thing" assigned:bob
```

## Hashtag Syntax

```text
hashtag = "#" [A-Za-z][A-Za-z0-9._/:%-]*
```

Hashtags must start with a letter to avoid conflicts with issue references.

**Valid hashtags:**

- `#perf` - Simple tag
- `#perf:hotpath` - Namespaced
- `#docs/guide/auth` - Path-style
- `#v1.2.3` - Version tag

**Invalid hashtags:**

- `#123` - Numeric only (conflicts with issues)
- `# tag` - Space after hash

## Mention Syntax

```text
mention = "@" [A-Za-z][A-Za-z0-9_-]*
```

**Examples:**

- `@agent` - Any AI assistant
- `@claude` - Specific assistant
- `@alice` - Human assignee
- `@devops` - Team/group

## Relation Properties

Special properties for linking waymarks:

| Property | Purpose | Example |
| ---------- | --------- | --------- |
| `ref:` | Declare anchor | `ref:#payments/core` |
| `see:` | Reference | `see:#auth/session` |
| `docs:` | Documentation link | `docs:https://api.example.com` |
| `from:` | Dependency | `from:#db/migration` |
| `replaces:` | Supersedes | `replaces:#feature/old` |

**Note:** Relation values keep the hash: `see:#auth/login`, not `see:auth/login`

## Multi-line Syntax

Continue waymarks with markerless `:::`:

```javascript
// todo ::: refactor the authentication module
//      ::: preserve backward compatibility
//      ::: update documentation
```

Alignment of `:::` is optional but improves readability.

## Nesting Rules

Waymarks cannot be nested inside:

- String literals
- Docstrings (JSDoc, TSDoc, Python triple quotes)
- Rendered documentation sections

**Correct (adjacent to docstring):**

```typescript
/**
 * Authenticates the user.
 */
// about ::: validates credentials and creates session
function authenticate() {}
```

**Incorrect (inside docstring):**

```typescript
/**
 * Authenticates the user.
 * about ::: this won't be parsed!
 */
function authenticate() {}
```

## Escaping

No escaping is needed in waymark content. The parser reads until end of comment.

```javascript
// note ::: handles "quoted strings" and special chars: < > & !
```

## Validation Errors

Common validation errors from `wm lint`:

| Error | Cause | Fix |
| ------- | ------- | ----- |
| Unknown marker | Marker not in allowed list | Use blessed marker or configure |
| Invalid signal | Signal other than `*` | Remove or use `*` only |
| Duplicate ref | Same `ref:#token` twice | Choose unique token |
| Malformed property | Invalid key or value | Check syntax |
