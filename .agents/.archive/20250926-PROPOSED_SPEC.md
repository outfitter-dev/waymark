# Waymark Specification (`SPEC.md`)

The canonical specification for **Waymark syntax** — a lightweight breadcrumb protocol for codebases.

Waymarks provide developers and AI agents with a simple, structured way to leave **searchable, greppable, and context-rich markers** in code. They are designed to be minimal, durable, and composable, with a focus on clarity and interoperability with documentation, tooling, and agents.

---

## 1. Overview

- **What:** Waymarks are line comments with a consistent `marker :::` structure.
- **Why:** They act as breadcrumbs — hints, todos, references, and annotations that remain visible in code and easy to query.
- **How:** A simple grammar ensures marks are human-friendly, agent-readable, and safe to index across languages.

Waymark is deliberately minimal. It is _not_ a task tracker, comment thread, or documentation system. Instead, it provides **anchors of intent** that can be consumed by other tools or linked to richer systems.

---

## 2. Core Grammar

```ebnf
waymark     ::= comment-leader ws? prefix? marker ws ":::"
                ws payload? ws? trailing?

prefix      ::= position_signal? intensity_signal?
position_signal ::= "*" | "_"
intensity_signal ::= "!!" | "!" | "??" | "?"
marker      ::= [a-z0-9-]+

payload     ::= (segment (ws segment)*)?
segment     ::= property | tag | mention | wikilink | text

property    ::= key ":" value
key         ::= [a-z][a-z0-9_-]*
value       ::= scalar | paren_args | array
scalar      ::= bare | quoted
bare        ::= [^ \t\[\]\(\)#]+"
quoted      ::= "'" qbody "'" | '"' qbody '"'
qbody       ::= ( [^"'\] \\] | escape )*
escape      ::= "\\" ["'\\ntbr]

paren_args  ::= "(" arglist? ")"
arglist     ::= arg ("," arg)*
arg         ::= key ":" value | value
array       ::= "[" (value ("," value)*)? "]"

tag         ::= "#" tagkey
tagkey      ::= [A-Za-z0-9._\-/]+

mention     ::= "@" ident
ident       ::= [A-Za-z0-9._\-/]+

wikilink    ::= "[[" wikibody "]]"
wikibody    ::= target ( "|" label )?
target      ::= scheme ":" targetrest
              | "^" commit
scheme      ::= [a-z][a-z0-9-]*
targetrest  ::= [^\]\|]+
commit      ::= [0-9a-fA-F]{7,40}
label       ::= [^\]]+
```

---

## 3. Basic Structure

### 3.1 The `:::` Sigil

- Always three colons (`:::`).
- Preceded and followed by **exactly one ASCII space**.
- Serves as a hard visual separator between **marker** and **prose**.
- Trivially searchable with `rg "::: "`.

Example:

```ts
// todo ::: implement authentication
```

### 3.2 Markers

- Single, lowercase keyword describing purpose.
- Examples: `todo`, `fix`, `review`, `note`, `perf`, `sec`.
- One marker per Waymark — never combine multiple.

```js
// fix ::: memory leak in auth service
// note ::: this function assumes Redis is available
```

---

## 4. Signals

Signals are compact prefixes that modify urgency or scope.

- **Position signals:**
  - `*` — branch-scoped, must be resolved before merge.
  - `_` — ignored (reserved).
- **Intensity signals:**
  - `!` / `!!` — important → critical.
  - `?` / `??` — needs clarification → highly uncertain.

Examples:

```js
// *todo ::: implement OAuth flow before merge
// !!fix ::: critical security vulnerability
// ?note ::: unclear if this handles edge case
```

---

## 5. Properties, Tags, Mentions, Links

### 5.1 Properties

Structured metadata in `key:value` form.

```js
// todo ::: add retry logic priority:high owner:@alice
// fix ::: bug in parser since:1.2.0 until:2.0.0
```

### 5.2 Tags

Lightweight free-form labels, prefixed with `#`.

```js
// note ::: caching strategy #performance #backend
```

### 5.3 Mentions

Usernames or teams, prefixed with `@`.

```js
// review ::: needs input from @alice @bob
```

### 5.4 Links (`[[...]]`)

Universal linking mechanism.

Reserved schemes:

- `trail:` — external work/docs (not part of this spec).
- `file:` — file path with optional line(s).
- `symbol:` — language symbol path.
- `^` — commit hash (7–40 hex).
- `pr:` / `issue:` — SCM references.
- `doc:` — internal docs.
- `url:` — explicit external URL.

Examples:

```js
// review ::: [[file:src/ingest.ts#L42-L80]] [[^cafe1234]] owner:@alice
// note ::: design rationale [[doc:docs/adr/012-queue.md#decision]]
// fix ::: concurrency bug [[issue:#431]] #backend
```

---

## 6. Canonical Ordering

Formatters/lints should normalize token order for consistency:

1. Wikilinks (`[[...]]`)
2. Properties (`key:value`)
3. Mentions (`@user`)
4. Tags (`#tag`)
5. Free prose text

Example (canonicalized):

```js
// *!review ::: [[symbol:handlers::ingest::handle]] owner:@alice priority:p0 #security Validate payload before fan-out
```

---

## 7. Blessed Properties

A minimal set of first-class properties with semantic meaning:

| Property   | Purpose            | Example            |
| ---------- | ------------------ | ------------------ |
| `owner`    | Responsible person | `owner:@alice`     |
| `assignee` | Assigned person    | `assignee:@bob`    |
| `priority` | Importance level   | `priority:p0`      |
| `status`   | Workflow status    | `status:open`      |
| `fixes`    | Issue reference    | `fixes:#431`       |
| `closes`   | Issue/PR closure   | `closes:#123`      |
| `depends`  | Dependency         | `depends:auth-svc` |
| `blocked`  | Blocker reference  | `blocked:#567`     |
| `since`    | Starting version   | `since:1.2.0`      |
| `until`    | Ending version     | `until:2.0.0`      |
| `version`  | Applicable version | `version:3.1.4`    |
| `env`      | Environment        | `env:prod`         |
| `affects`  | Impacted systems   | `affects:billing`  |

---

## 8. Relation to Docstrings

- **Waymarks live in line comments**, not inside docstrings.
- This prevents breaking docstring-based doc generators (Rustdoc, JSDoc, Pydoc).
- To integrate with docs, teams may add a fenced or tagged subsection in docstrings, e.g.:

```ts
/**
 * Handle user ingestion.
 *
 * @waymark todo ::: validate payload [[issue:#431]]
 */
```

- Doc generators may ignore these, but post-processors can extract them into the same index as line-comment Waymarks.

---

## 9. Multi-line Usage

Waymarks are **single-line by default** for grep-ability. Multiple related marks may be stacked:

```js
// todo ::: implement OAuth integration owner:@alice priority:p1
// note ::: OAuth flow requires PKCE
// blocked ::: depends:session-api
```

---

## 10. Search Patterns

Examples with `ripgrep`:

```bash
# All waymarks
rg ":::"

# By marker
rg '(^|\s)todo\s+:::'
rg '(^|\s)fix\s+:::'

# By property
rg ':::\s+[^#\n]*\bowner:@alice\b'
rg ':::\s+[^#\n]*\bpriority:p0\b'

# By tags
rg '#security'
rg '#backend'

# By links
rg ':::\s+[^#\n]*\[\[file:'
rg ':::\s+[^#\n]*\[\[\^'
```

---

## 11. Principles

- **Minimal syntax**: markers, signals, properties, tags, mentions, links.
- **Greppability first**: always searchable with simple tools.
- **No complex objects**: properties are flat key-value pairs.
- **Durability**: prefer `symbol:` or `file:+^commit` for resilient anchors.
- **Extensibility**: new schemes and properties can be added without changing core grammar.
- **Separation of concerns**: Waymarks provide breadcrumbs; external systems (e.g., Trails) may build workflows on top.

---

## 12. Summary

Waymark v1.0 defines a **lean, durable, and expressive breadcrumb syntax**:

- Clear structure: `[signal][marker] ::: [links|props|mentions|tags|prose]`
- Universal linking: `[[...]]` replaces ad-hoc anchors
- Properties vs tags: structured vs free-form, no hybrids
- Docstring-safe: keep in line comments, optional fenced sections
- Standard search patterns: simple regex or ripgrep

This balance keeps Waymark **approachable for humans**, **parsable for tools**, and **useful for agents** — without collapsing into another task tracker or doc system.
