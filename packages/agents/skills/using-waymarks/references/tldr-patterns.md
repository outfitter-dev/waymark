<!-- tldr ::: extended TLDR patterns and examples by file type -->

# TLDR Patterns Reference

This reference provides extended patterns and examples for writing effective TLDR waymarks.

## Placement Rules

### Standard Placement

The TLDR must be the first waymark in the file, after any language preambles:

```typescript wm:ignore
// tldr ::: handles user authentication and session management

import { hash } from 'bcrypt';
```

### After Shebangs

```bash
#!/bin/bash

# tldr ::: deployment script for production Kubernetes cluster

set -euo pipefail
```

### After Front Matter

```markdown wm:ignore
---
title: API Guide
author: Team
---

<!-- tldr ::: REST API reference with authentication examples #docs -->

# API Guide
```

### After Encoding Declarations

```python wm:ignore
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# tldr ::: manages database migrations and schema versioning

import sqlite3
```

## Sentence Construction

### Structure

Write one sentence, 8-14 words, active voice:

```text
[verb/component] [domain] [via/using/with] [technology/constraint]
```

### Patterns by Style

| Pattern | Template | Example |
|---------|----------|---------|
| Action-focused | `[verb] [domain] [method]` | `validates payment webhooks using Stripe signatures` |
| Component-focused | `[component] [action] [scope]` | `React hooks exposing authentication state` |
| Purpose-focused | `[capability] for [purpose]` | `rate limiting middleware for API endpoints` |
| Integration-focused | `[integration] [domain] with [tech]` | `Stripe webhook handler with signature verification` |

### Strong Verbs

Prefer active, specific verbs:

- validates, processes, transforms, parses
- renders, displays, presents
- manages, orchestrates, coordinates
- fetches, retrieves, queries
- generates, creates, builds
- handles, routes, dispatches

### Avoid

- "This file contains..." (implicit)
- "Utilities for..." (vague)
- "Module that handles..." (filler)
- "Important stuff" (meaningless)
- "Helper functions" (non-descriptive)

## Starred TLDRs

Use `*tldr` for critical files that must be read first:

```typescript wm:ignore
// *tldr ::: main application entry wiring Express middleware
// *tldr ::: core authentication service all routes depend on
```

**Reserve for:**

- Entry points
- Core infrastructure
- Security-critical modules
- Compliance-sensitive code

Audit periodically: `rg '\*tldr\s*:::'`

## Tagging Conventions

### Required Tags

Documentation TLDRs **must** include `#docs`:

```markdown wm:ignore
<!-- tldr ::: API authentication guide using JWT tokens #docs/guide -->
<!-- tldr ::: database schema migration reference #docs/reference -->
```

### Common Namespaces

- `#docs`, `#docs/guide`, `#docs/reference`, `#docs/api`
- `#perf`, `#perf:hotpath`
- `#sec`, `#sec:boundary`
- `#arch`, `#arch:entrypoint`
- `#test`, `#test/unit`, `#test/integration`

### Tag Discovery

Before creating a new tag, check existing usage:

```bash
rg ':::.+#perf' | head -20
rg ':::.+#docs' | head -20
```

## Canonical References

Declare the file's canonical anchor with `ref:#token`:

```typescript wm:ignore
// tldr ::: payment gateway service ref:#payments/gateway #payments
```

**Token patterns:**

- Match directory structure: `ref:#payments/stripe-webhook`
- Use lowercase with slashes: `ref:#auth/session`
- Verify uniqueness: `rg 'ref:#payments/gateway'`

## Patterns by File Type

### Backend Services

```typescript wm:ignore
// tldr ::: user registration service with email verification
// tldr ::: order processing pipeline with inventory checks
// tldr ::: webhook receiver validating Stripe event signatures
// tldr ::: authentication service issuing JWT tokens ref:#auth/service
```

### Frontend Components

```typescript wm:ignore
// tldr ::: dashboard page displaying analytics charts #frontend
// tldr ::: form component with validation and submission #ui
// tldr ::: authentication context provider for React tree
// tldr ::: user settings panel with preference management
```

### CLI Tools

```typescript wm:ignore
// tldr ::: CLI entry point dispatching subcommands #cli
// tldr ::: argument parser with validation and help text
// tldr ::: command handler for database migrations
```

### Configuration

```typescript wm:ignore
// tldr ::: ESLint configuration extending Ultracite rules
// tldr ::: Vite build configuration with code splitting
// tldr ::: TypeScript compiler configuration for strict mode
```

### Tests

```typescript wm:ignore
// tldr ::: integration tests for payment processing flows #test
// tldr ::: unit tests for authentication service #test/unit
// tldr ::: end-to-end tests for checkout workflow #e2e
```

### Documentation

```markdown wm:ignore
<!-- tldr ::: API quickstart guide with curl examples #docs/guide -->
<!-- tldr ::: deployment runbook for production releases #docs/ops -->
<!-- tldr ::: architecture decision record for caching strategy #docs/adr -->
```

### Scripts

```bash
#!/bin/bash
# tldr ::: deployment script for production Kubernetes cluster

#!/usr/bin/env python3
# tldr ::: data migration script for user table schema change
```

### Libraries / Utilities

```typescript wm:ignore
// tldr ::: date formatting utilities with timezone support
// tldr ::: HTTP client wrapper with retry and timeout logic
// tldr ::: validation helpers for common data patterns
```

## Writing Process

1. **Identify core capability**: What does this file deliver?
2. **Choose action verb**: validates, processes, renders, manages, etc.
3. **Add key technology**: using Stripe, with React, via REST
4. **Add tags**: `#domain`, `#docs` if documentation
5. **Consider canonical**: Does this need `ref:#token`?
6. **Count words**: Aim for 8-14 words

## Review Checklist

Before committing a TLDR:

- [ ] Active voice with clear subject and verb
- [ ] 8-14 words
- [ ] First waymark in file (after preambles)
- [ ] Tags match existing conventions
- [ ] `ref:#token` if canonical anchor needed
- [ ] Documentation files include `#docs`

## Common Mistakes

### Too Vague

```typescript wm:ignore
// Bad
// tldr ::: utilities

// Good
// tldr ::: date parsing utilities with timezone normalization
```

### Too Long

```typescript wm:ignore
// Bad
// tldr ::: this file contains the main authentication service that handles user login, registration, password reset, and session management using JWT tokens

// Good
// tldr ::: authentication service with login, registration, and JWT sessions
```

### Wrong Placement

```typescript wm:ignore
// Bad
import { hash } from 'bcrypt';

// tldr ::: authentication service  // too late

// Good
// tldr ::: authentication service with bcrypt password hashing

import { hash } from 'bcrypt';
```

### Missing Required Tag

```markdown wm:ignore
<!-- Bad -->
<!-- tldr ::: API documentation for user endpoints -->

<!-- Good -->
<!-- tldr ::: API documentation for user endpoints #docs/api -->
```
