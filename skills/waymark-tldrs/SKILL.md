---
name: Waymark TLDRs
description: This skill should be used when the user asks to "write a tldr", "add a tldr waymark", "file summary waymark", "summarize this file", "add file description", or needs guidance on TLDR waymark placement, sentence patterns, tagging, or canonical references. Provides focused guidance for file-level summary waymarks.
version: 0.1.0
---

<!-- tldr ::: file-level summary waymark patterns placement and tagging guidance -->

# Waymark TLDRs

TLDR waymarks provide file-level summaries that help humans and agents quickly understand file purpose. They are the most important waymark in any file.

## Essentials

- **One per file**: Exactly one `tldr :::` per file
- **First waymark**: Place after shebang/frontmatter, before code
- **8-14 words**: Concise, active voice sentence
- **Capability-first**: Lead with what the file delivers

## Placement

The TLDR must be the first waymark in the file:

```typescript
// tldr ::: handles user authentication and session management

import { hash } from 'bcrypt';
// ... rest of file
```

**After language preambles:**

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# tldr ::: manages database migrations and schema versioning

import sqlite3
```

```markdown
---
title: API Guide
---

<!-- tldr ::: REST API reference with authentication examples #docs -->

# API Guide
```

## Sentence Patterns

Write one sentence, 8-14 words, active voice:

| Pattern | Example |
| --------- | --------- |
| `[verb] [domain] [via/using/with] [technology]` | `validates payment webhooks using Stripe signature verification` |
| `[component] [action] [scope]` | `React hooks exposing authentication state and methods` |
| `[capability] for [purpose]` | `rate limiting middleware for API endpoints` |

**Good examples:**

```javascript
// tldr ::: Stripe webhook handler verifying signatures and queuing retries
// tldr ::: React hooks exposing BetterAuth session state
// tldr ::: CLI entry point parsing arguments and dispatching commands
// tldr ::: database connection pool with health monitoring
```

**Avoid:**

- "This file contains..." (implicit)
- "Utilities for..." (vague)
- "Module that handles..." (filler)
- "Important stuff" (meaningless)

## Starred TLDRs

Use `*tldr` for critical files that must be read first:

```javascript
// *tldr ::: main application entry wiring Express middleware
// *tldr ::: core authentication service all routes depend on
```

**Reserve for:**

- Entry points
- Core infrastructure
- Security-critical modules
- Compliance-sensitive code

Audit periodically: `rg '\*tldr\s*:::'`

## Tags and Namespaces

Add hashtags for categorization:

```javascript
// tldr ::: payment processing service #payments #backend
// tldr ::: user settings React component #frontend #settings
```

**Documentation TLDRs must include `#docs`:**

```markdown
<!-- tldr ::: API authentication guide using JWT tokens #docs/guide -->
<!-- tldr ::: database schema migration reference #docs/reference -->
```

**Common namespaces:**

- `#docs`, `#docs/guide`, `#docs/reference`
- `#perf`, `#perf:hotpath`
- `#sec`, `#sec:boundary`
- `#arch`, `#arch:entrypoint`

## Canonical References

Declare the file's canonical anchor with `ref:#token`:

```javascript
// tldr ::: payment gateway service ref:#payments/gateway #payments
```

**Token patterns:**

- Match directory structure: `ref:#payments/stripe-webhook`
- Use lowercase with slashes: `ref:#auth/session`
- Check for duplicates before creating: `rg 'ref:#payments/gateway'`

Reference from other waymarks:

```javascript
// todo ::: from:#payments/gateway add retry logic
```

## By File Type

### Source Code

```typescript
// tldr ::: validates and transforms API request payloads
```

### Tests

```typescript
// tldr ::: integration tests for payment processing flows #test
```

### Configuration

```javascript
// tldr ::: TypeScript compiler configuration for strict mode
```

### Documentation

```markdown
<!-- tldr ::: getting started guide for new developers #docs/guide -->
```

### Scripts

```bash
#!/bin/bash
# tldr ::: deployment script for production Kubernetes cluster
```

## Writing Process

1. **Identify core capability**: What does this file deliver?
2. **Choose action verb**: validates, processes, renders, manages, etc.
3. **Add key technology**: using Stripe, with React, via REST
4. **Add tags**: #domain, #docs if documentation
5. **Consider canonical**: Does this need `ref:#token`?

## Review Checklist

Before committing a TLDR:

- [ ] Active voice, clear subject and verb
- [ ] 8-14 words
- [ ] First waymark in file
- [ ] Tags match existing conventions
- [ ] `ref:#token` if canonical anchor needed
- [ ] Documentation files include `#docs`

## Examples Gallery

**Backend services:**

```javascript
// tldr ::: user registration service with email verification
// tldr ::: order processing pipeline with inventory checks
// tldr ::: webhook receiver validating Stripe event signatures
```

**Frontend:**

```typescript
// tldr ::: dashboard page displaying analytics charts #frontend
// tldr ::: form component with validation and submission #ui
// tldr ::: authentication context provider for React tree
```

**CLI tools:**

```typescript
// tldr ::: CLI entry point dispatching subcommands #cli
// tldr ::: argument parser with validation and help text
```

**Configuration:**

```javascript
// tldr ::: ESLint configuration extending Ultracite rules
// tldr ::: Vite build configuration with code splitting
```

**Documentation:**

```markdown
<!-- tldr ::: API quickstart guide with curl examples #docs/guide -->
<!-- tldr ::: deployment runbook for production releases #docs/ops -->
```

## Additional Resources

### Reference Files

- **`references/tldr-patterns.md`** - Extended patterns by file type
- **`references/tldr-examples.md`** - Large example gallery

### Related Skills

- **`waymark-authoring`** - Core waymark grammar
- **`auditing-waymarks`** - Verify TLDR coverage
