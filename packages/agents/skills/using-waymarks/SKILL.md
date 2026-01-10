---
name: using-waymarks
description: This skill should be used when the user asks about "waymark syntax", "writing waymarks", "::: sigil", "tldr waymarks", "about waymarks", searching waymarks with ripgrep, or mentions waymark grammar, signals, markers, or properties. Provides comprehensive guidance for authoring and searching waymarks without requiring CLI tools.
version: 1.0.0
---

<!-- tldr ::: comprehensive waymark authoring and search patterns for agents without CLI access -->

# Using Waymarks

Waymarks are structured code annotations using the `:::` sigil that enable humans and AI agents to leave durable, greppable breadcrumbs in codebases. This skill provides comprehensive guidance for authoring and searching waymarks without requiring the `wm` CLI tool.

## Overview

A waymark is a comment containing the `:::` sigil that embeds machine-readable context directly adjacent to code. Waymarks unify decades of ad-hoc comment patterns (TODO, FIXME, MARK, etc.) into one predictable grammar that works across all programming languages.

**Core properties:**

- **Greppable**: Find all waymarks with `rg ':::'`
- **Language-agnostic**: Works in any language with comments
- **Tool-independent**: Parse without AST access
- **Durable**: Survives refactors and formatting

## Grammar Quick Reference

Every waymark follows this structure:

```text
[comment leader] [signals][marker] ::: [content]
```

**Components:**

1. **Comment leader**: Language-specific comment syntax (`//`, `#`, `<!--`, `--`, etc.)
2. **Signals** (optional): `~` (flagged/in-progress), `*` (starred/priority)
3. **Marker** (required): Single lowercase keyword from the blessed list
4. **`:::` sigil** (required): Exactly three ASCII colons with spaces around them
5. **Content** (optional): Free text with embedded properties, tags, and mentions

**Examples:**

```typescript
// todo ::: implement rate limiting
// *fix ::: security vulnerability in auth handler
// ~todo ::: refactoring in progress on this branch
// ~*fix ::: critical bug I am actively working on
```

### Signals

Two signals are available:

- **Tilde (`~`)**: Flagged, indicating work actively in progress on the current branch. Clear all flagged waymarks before merging.
- **Star (`*`)**: Starred, indicating high priority or importance.

When combining signals, use `~*` (flagged first, then starred). Double signals (`**`, `~~`) are invalid.

| Waymark | Meaning |
|---------|---------|
| `todo` | A task |
| `*todo` | An important task |
| `~todo` | A task actively being worked on |
| `~*todo` | An important task actively being worked on |

See `references/grammar.md` for the complete grammar specification.

## Markers

Markers categorize waymark intent. Only blessed markers are recognized by default; custom markers require configuration.

### Work / Action

- `todo` - Task to complete
- `fix` (alias: `fixme`) - Bug to address
- `wip` - Work in progress
- `done` - Completed task (temporary handoff marker)
- `review` - Needs code review
- `test` - Needs testing
- `check` - Needs verification

### Information

- `note` - General observation
- `context` (alias: `why`) - Background or reasoning
- `tldr` - File-level summary (one per file, at top)
- `about` - Section or block summary
- `example` - Usage example
- `idea` - Suggestion or proposal
- `comment` - General commentary

### Caution / Quality

- `warn` - Warning about behavior
- `alert` - Critical attention needed
- `deprecated` - Outdated code
- `temp` (alias: `tmp`) - Temporary code
- `hack` (alias: `stub`) - Workaround or temporary solution

### Workflow

- `blocked` - Cannot proceed
- `needs` - Dependency required

### Inquiry

- `question` (alias: `ask`) - Needs clarification

See `references/markers.md` for the complete marker list with usage guidance.

## Writing TLDRs

TLDR waymarks provide file-level summaries that help humans and agents quickly understand file purpose. They are the most important waymark in any file.

### Essentials

- **One per file**: Exactly one `tldr :::` per file
- **First waymark**: Place after shebang/frontmatter, before code
- **8-14 words**: Concise, active voice sentence
- **Capability-first**: Lead with what the file delivers

### Placement

The TLDR must be the first waymark in the file:

```typescript
// tldr ::: handles user authentication and session management

import { hash } from 'bcrypt';
```

After language preambles:

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# tldr ::: manages database migrations and schema versioning

import sqlite3
```

For documentation files, use HTML comments with `#docs` tag:

```markdown
---
title: API Guide
---

<!-- tldr ::: REST API reference with authentication examples #docs -->

# API Guide
```

### Sentence Patterns

Write one sentence, 8-14 words, active voice:

| Pattern | Example |
|---------|---------|
| `[verb] [domain] [via/using/with] [technology]` | `validates payment webhooks using Stripe signature verification` |
| `[component] [action] [scope]` | `React hooks exposing authentication state and methods` |
| `[capability] for [purpose]` | `rate limiting middleware for API endpoints` |

**Avoid:**

- "This file contains..." (implicit)
- "Utilities for..." (vague)
- "Module that handles..." (filler)

Use `*tldr` for critical files that must be read first (entry points, core infrastructure). Audit periodically with `rg '\*tldr\s*:::'`.

See `references/tldr-patterns.md` for extended patterns and examples.

## Writing About Waymarks

`about :::` markers describe the code section immediately following them. They provide quick breadcrumbs for classes, functions, and major blocks.

### Placement and Scope

Place `about :::` on the comment line directly above the construct:

```typescript
// about ::: validates JWT tokens and extracts claims
export function validateToken(token: string): Claims {
  // ...
}
```

Focus on the upcoming section only. Do not restate the file-level TLDR:

```typescript
// tldr ::: user authentication service

// about ::: validates password against security policy
function validatePassword(password: string) {}

// about ::: hashes password with bcrypt
function hashPassword(password: string) {}
```

### Sentence Patterns

Write short, active-voice sentences (6-12 words):

| Construct | Pattern | Example |
|-----------|---------|---------|
| Class | "encapsulates/manages [domain] [state/behavior]" | `encapsulates session lifecycle state` |
| Function | "validates/transforms/fetches [input] [action]" | `validates webhook signatures before processing` |
| Component | "renders [element] with [feature]" | `renders account overview with metrics` |

Update `about :::` markers when behavior changes. Delete stale markers rather than leaving inaccurate guidance.

See `references/about-waymarks.md` for detailed patterns by language.

## Properties, Tags, and Mentions

### Properties

Properties use `key:value` pairs in the content:

```typescript
// todo ::: implement caching owner:@alice priority:high
// note ::: reason:"waiting for API approval" status:blocked
```

**Key format**: `[A-Za-z][A-Za-z0-9_-]*`
**Value format**: Unquoted token (no spaces) or double-quoted string

### Tags (Hashtags)

Any `#` followed by non-whitespace is a tag:

```typescript
// todo ::: optimize query #perf:hotpath
// fix ::: XSS vulnerability #sec:boundary
```

**Use namespaces for organization:**

- `#docs/*` - Documentation (`#docs/guide`, `#docs/api`)
- `#perf:*` - Performance (`#perf:hotpath`, `#perf:slow`)
- `#sec:*` - Security (`#sec:boundary`, `#sec:auth`)
- `#arch/*` - Architecture (`#arch/entrypoint`, `#arch/state`)

Before inventing a new tag, search for existing usage: `rg '#perf'`

### Mentions (Actors)

Mentions start with `@` followed by a lowercase letter:

```typescript
// todo ::: @agent implement OAuth flow
// review ::: @alice check security implications
```

**Valid mentions:**

- `@agent` - Any capable AI assistant
- `@alice`, `@bob` - Named individuals
- `@dev-team` - Groups (defined in config)

Place the actor immediately after `:::` to assign ownership. Mentions later in the sentence indicate involvement without ownership.

**Invalid patterns** (not extracted as mentions):

- `user@example.com` - Email addresses
- `@Component` - Decorators (uppercase)
- `@angular/core` - Scoped packages

### Canonical References

Declare the authoritative anchor for a concept with `ref:#token`:

```typescript
// tldr ::: authentication service ref:#auth/service
```

Reference elsewhere via relation properties:

- `see:#token` - Related reference
- `docs:#token` - Documentation reference
- `from:#token` - Depends on or derived from
- `replaces:#token` - Supersedes another waymark

```typescript
// todo ::: implement refunds from:#payments/charge
// note ::: supersedes old implementation see:#legacy/auth
```

## Docstring Compatibility

Waymarks complement docstrings; they never replace them. Place waymarks outside docstrings, adjacent to them:

**TypeScript/JavaScript:**

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

**Python:**

```python
def send_email(message: Email) -> None:
    """Send an email using the configured transport."""
    # about ::: orchestrates outbound email delivery #comm/email
    transport.send(message)
```

**Go:**

```go
// sanitize normalizes webhook payloads before verification.
// about ::: ensures Stripe event payload conforms to canonical schema #payments/stripe
func sanitize(event Event) Event { /* ... */ }
```

## Searching with Ripgrep

When the `wm` CLI is unavailable, use ripgrep to search for waymarks.

### Basic Patterns

```bash
# All waymarks
rg ':::'

# By marker type
rg 'todo\s*:::'
rg 'fix\s*:::'
rg 'tldr\s*:::'
rg 'about\s*:::'

# By signal
rg '\*\w+\s*:::'           # Starred (high-priority)
rg '~\w+\s*:::'            # Flagged (in-progress)
rg '~\*\w+\s*:::'          # Both signals

# By mention
rg ':::\s*@agent'
rg ':::\s*@\w+'

# By tag
rg ':::.+#perf'
rg ':::.+#sec'
rg ':::.+#docs'
```

### Pre-merge Audit

Before merging, verify no flagged waymarks remain:

```bash
# Check for flagged items (must clear before merge)
rg '~\w+\s*:::'

# Check for starred items (should address before merge)
rg '\*\w+\s*:::' && echo "Has starred items!"

# Check for WIP markers
rg 'wip\s*:::' && echo "Has WIP markers!"
```

### Documentation TLDRs

```bash
# All doc TLDRs
rg 'tldr\s*:::.*#docs' -g '*.md'

# In HTML comments
rg '<!--\s*tldr\s*:::' -g '*.md'
```

See `references/ripgrep.md` for comprehensive search patterns.

## Multi-line Waymarks

Continue waymarks using markerless `:::` lines:

```typescript
// todo ::: refactor authentication flow to support OAuth 2.0
//      ::: coordinate with @backend team on token format
//      ::: update documentation when complete
```

Align continuation `:::` with the parent waymark's sigil for readability. Properties can appear on continuation lines:

```typescript
// tldr  ::: payment processor service
// see   ::: #payments/core
// owner ::: @alice
// since ::: 2025-01-01
```

## CLI Tool Note

The `wm` CLI provides additional capabilities beyond what ripgrep patterns offer:

- **Waymark IDs**: Stable wikilink-style identifiers (`[[a1b2c3d|my-feature]]`) for cross-references
- **Formatting**: Automatic alignment and normalization with `wm fmt`
- **Simplified queries**: Structured filtering with `wm find --type todo --mention @agent`
- **Validation**: Lint rules for unknown markers, duplicate properties, codetag patterns
- **Graph extraction**: Dependency tracking with `wm find --graph`

For projects with the CLI installed, consider loading the `waymark-cli` skill for CLI-specific guidance.

## Quick Reference

```javascript
// Basic waymarks
// todo ::: implement validation
// fix ::: memory leak in handler
// note ::: assumes UTC timestamps

// With signals
// *fix ::: critical security vulnerability
// ~todo ::: refactoring in progress
// ~*todo ::: urgent fix I am actively working on

// With properties and tags
// todo ::: priority:high implement caching #perf
// warn ::: validates all inputs #security

// With mentions
// todo ::: @agent implement OAuth flow #auth
// review ::: @alice check authorization logic

// Section summary
// about ::: orchestrates email delivery #comm

// Relations
// todo ::: from:#auth/login add rate limiting
// note ::: see:#payments/stripe for webhook handling
```

## Additional Resources

### Reference Files

- **`references/grammar.md`** - Complete grammar specification
- **`references/markers.md`** - Full marker list with categories and aliases
- **`references/tldr-patterns.md`** - Extended TLDR patterns by file type
- **`references/about-waymarks.md`** - Section summary patterns by language
- **`references/ripgrep.md`** - Comprehensive search patterns

### Related Skills

- **`waymark-cli`** - CLI usage, commands, and auditing workflows
