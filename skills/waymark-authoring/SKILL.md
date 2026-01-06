---
name: Waymark Authoring
description: This skill should be used when the user asks to "add waymarks", "write a waymark", "annotate code", "use waymark syntax", "waymark grammar", "add code comments with :::", or needs guidance on waymark markers, signals, properties, hashtags, mentions, or `about :::` waymarks. Provides comprehensive waymark authoring patterns.
version: 0.1.0
---

<!-- tldr ::: waymark grammar markers and structured annotation authoring patterns -->

# Waymark Authoring

Waymarks are structured code annotations using the `:::` sigil that enable humans and AI agents to leave durable, greppable breadcrumbs in codebases. This skill covers authoring waymarks correctly.

## Grammar Structure

Every waymark follows this pattern:

```text
[comment leader] [signal][marker] ::: [content]
```

**Components:**

- **Comment leader**: Language-appropriate (`//`, `#`, `<!--`, `--`, etc.)
- **Signal** (optional): `*` for starred/high-priority
- **Marker**: Keyword from the blessed list (lowercase)
- **`:::` sigil**: Exactly three colons with spaces on each side
- **Content**: Free text with optional properties, hashtags, mentions

## Markers

### Work / Action

- `todo` - Task to complete
- `fix` - Bug to address
- `wip` - Work in progress
- `done` - Completed item
- `review` - Needs review
- `test` - Test-related
- `check` - Verification needed

### Information

- `note` - General information
- `context` - Background/reasoning
- `tldr` - File summary (one per file, at top)
- `this` - Section/construct summary
- `example` - Usage example
- `idea` - Potential improvement
- `comment` - General commentary

### Caution / Quality

- `warn` - Warning about behavior
- `alert` - Critical attention needed
- `deprecated` - Outdated code
- `temp` - Temporary code
- `hack` - Workaround

### Workflow

- `blocked` - Cannot proceed
- `needs` - Dependency required

### Inquiry

- `question` - Needs clarification

## Signals

Only one signal is supported:

- `*` (starred): High-priority item that needs attention

Place the signal before the marker:

```javascript
// *fix ::: critical security vulnerability in auth handler
// *todo ::: must complete before release
```

## Properties and Relations

Properties use `key:value` pairs:

```javascript
// todo ::: priority:high implement caching
// note ::: owner:@alice since:2025-01-01 relates to auth
```

### Canonical References

Declare anchors with `ref:#token`:

```javascript
// tldr ::: payment processor entry point ref:#payments/stripe
```

Reference elsewhere via hashtags or explicit properties:

```javascript
// todo ::: fixes:#payments/stripe add retry logic
// note ::: depends:#auth/session needs session validation
```

**Relation properties:**

- `depends:#token` - Requires another waymark
- `needs:#token` - Similar to depends
- `blocks:#token` - Prevents other work
- `fixes:#token` - Addresses an issue
- `rel:#token` - General relationship

## Hashtags

Add hashtags for categorization:

```javascript
// todo ::: implement caching layer #performance #backend
// warn ::: validates all inputs #security
```

**Conventions:**

- Use namespaces for specificity: `#perf:hotpath`, `#docs/guide`
- Common namespaces: `#perf`, `#sec`, `#docs`, `#arch`, `#test`

## Mentions

Assign ownership with mentions after `:::`:

```javascript
// todo ::: @agent implement OAuth callback
// review ::: @alice check authorization logic
```

- `@agent` - Any capable AI assistant
- Named actors (`@alice`, `@claude`) - Specific assignment

## Writing `about :::` Waymarks

Use `about :::` to summarize code sections:

```typescript
// about ::: validates webhook signatures before processing
export function verifyWebhook(payload: string, signature: string) {
  // ...
}
```

**Guidelines:**

- Place directly above the construct it describes
- Keep scope local to the section
- 6-12 words, active voice
- Update when behavior changes

See `references/about-waymarks.md` for detailed patterns.

## Writing `tldr :::` Waymarks

For file-level summaries, see the `waymark-tldrs` skill which covers:

- Placement rules (first waymark after shebang/frontmatter)
- Sentence patterns (8-14 words, active voice)
- Tagging conventions
- Canonical anchors

## Multi-line Waymarks

Continue waymarks using markerless `:::` lines:

```javascript
// todo ::: refactor parser for streaming support
//      ::: preserve backward-compatible API surface
//      ::: coordinate deployment with @devops
```

## Waymarks in Documentation

Use HTML comments in Markdown:

```markdown
<!-- tldr ::: API authentication guide using JWT tokens #docs/guide -->

# Authentication Guide

<!-- note ::: this section assumes familiarity with OAuth 2.0 -->
```

## Anti-patterns

**Avoid:**

- Placing waymarks inside docstrings/JSDoc (use adjacent comments)
- Numeric-only hashtags (conflicts with issue refs)
- Custom signals beyond `*`
- Duplicate `ref:#token` anchors in a repo

## Quick Reference

```javascript
// Basic waymarks
// todo ::: implement validation
// fix ::: memory leak in handler
// note ::: assumes UTC timestamps

// With properties
// todo ::: priority:high implement caching #perf

// With mentions
// todo ::: @agent implement OAuth flow #security

// Starred (high-priority)
// *fix ::: critical auth bypass vulnerability

// Section summary
// about ::: orchestrates email delivery #comm

// Relations
// todo ::: fixes:#auth/login add rate limiting
```

## Additional Resources

### Reference Files

- **`references/grammar.md`** - Complete grammar specification
- **`references/markers.md`** - Full marker list with usage
- **`references/this-waymarks.md`** - Section summary patterns

### Related Skills

- **`waymark-tldrs`** - File-level summary waymarks
- **`ripgrep-waymarks`** - Search patterns when CLI unavailable
- **`auditing-waymarks`** - Verify and update waymarks
