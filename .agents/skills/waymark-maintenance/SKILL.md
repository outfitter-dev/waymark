---
name: waymark-maintenance
description: Places and maintains waymarks across a codebase, focusing on TLDR coverage and accuracy. Delegates to the waymarker agent for systematic auditing and placement. Use when adding TLDRs to files, auditing waymark coverage, updating stale waymarks, or when "add waymarks", "TLDR coverage", "waymark audit" is mentioned.
version: 1.0.0
agent: waymark:waymarker
context: fork
allowed-tools:
  - Read
  - Edit
  - Grep
  - Glob
  - Bash(*/find-waymarks *)
  - Bash(*/coverage-report *)
---

# Waymark Maintenance

This skill guides systematic waymark placement and maintenance across a codebase. It delegates to the `waymarker` agent for execution. The agent loads the `waymarks` skill for grammar reference and search commands.

## Quick Start

Check current TLDR coverage:

!`.agents/skills/waymark-maintenance/scripts/coverage-report --stats`

## Priority: TLDR Coverage

TLDRs are the foundation of waymark coverage. Every source file should have a TLDR describing what it does. Without TLDRs, codebase navigation is impaired for both humans and agents.

### Coverage Workflow

1. **Audit**: Run `coverage-report --missing-tldr` to find gaps
2. **Prioritize**: Start with entry points, core modules, then utilities
3. **Write**: Add TLDRs following the patterns below
4. **Verify**: Re-run coverage to confirm improvement

## Writing TLDRs

### The Rules

- **One per file**: Exactly one `tldr :::` per file
- **First waymark**: Place after shebang/frontmatter, before code
- **8-14 words**: Concise, active voice, capability-first
- **No filler**: Avoid "This file contains...", "Module for...", "Utilities..."

### Placement by File Type

**TypeScript/JavaScript:**

```typescript
// tldr ::: handles user authentication and JWT token lifecycle

import { sign, verify } from 'jsonwebtoken';
```

**Python:**

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# tldr ::: manages database migrations and schema versioning

import sqlite3
```

**Markdown:**

```markdown
---
title: API Guide
---

<!-- tldr ::: REST API reference with authentication examples #docs -->

# API Guide
```

**Shell:**

```bash
#!/bin/bash

# tldr ::: deployment script for production Kubernetes cluster

set -euo pipefail
```

### Sentence Patterns

Write one sentence describing what the file delivers:

| Pattern | Template | Example |
|---------|----------|---------|
| Action | `[verb] [domain] [method]` | `validates payment webhooks using Stripe signatures` |
| Component | `[component] [action] [scope]` | `React hooks exposing authentication state` |
| Purpose | `[capability] for [purpose]` | `rate limiting middleware for API endpoints` |
| Integration | `[integration] [domain] with [tech]` | `Stripe webhook handler with signature verification` |

### Strong Verbs

Use active, specific verbs:

- validates, processes, transforms, parses
- renders, displays, presents
- manages, orchestrates, coordinates
- fetches, retrieves, queries
- generates, creates, builds
- handles, routes, dispatches

### Starred TLDRs

Use `*tldr` for critical files that must be read first:

```typescript
// *tldr ::: main application entry wiring Express middleware
// *tldr ::: core authentication service all routes depend on
```

Reserve for: entry points, core infrastructure, security-critical modules.

### Documentation TLDRs

Documentation files **must** include `#docs` tag:

```markdown
<!-- tldr ::: API authentication guide using JWT tokens #docs/guide -->
<!-- tldr ::: database schema migration reference #docs/reference -->
```

## Writing About Waymarks

`about :::` markers describe the code section immediately following them.

### Placement

Place directly above the construct (6-12 words):

```typescript
// about ::: validates JWT tokens and extracts claims
export function validateToken(token: string): Claims {
```

### Patterns by Construct

| Construct | Pattern | Example |
|-----------|---------|---------|
| Class | `encapsulates/manages [domain] [behavior]` | `encapsulates session lifecycle state` |
| Function | `validates/transforms/fetches [input] [action]` | `validates webhook signatures before processing` |
| Component | `renders [element] with [feature]` | `renders account overview with metrics` |

### Scope Rule

Focus on the section, not the file. Don't restate the TLDR:

```typescript
// tldr ::: user authentication service

// about ::: validates password against security policy  // ✓ Section-specific
function validatePassword(password: string) {}

// about ::: handles user authentication  // ✗ Too broad, same as tldr
function validatePassword(password: string) {}
```

## Maintaining Waymarks

### Stale Waymark Detection

Waymarks become stale when code changes but waymarks don't. Look for:

- **Completed todos**: `todo :::` for work that's done
- **Fixed bugs**: `fix :::` for bugs that are resolved
- **Inaccurate descriptions**: TLDRs/abouts that don't match current behavior
- **Orphaned references**: `see:#token` pointing to removed code

### Update Process

1. Read the code to understand current behavior
2. Compare against existing waymark content
3. Update waymark to match reality, or delete if no longer relevant
4. Never leave inaccurate waymarks—they're worse than none

### Pre-Merge Audit

Before merging, check for items that should be cleared:

```bash
find-waymarks -F              # Flagged items (must clear before merge)
find-waymarks -S              # Starred items (should address)
find-waymarks -t wip          # WIP markers
```

See the `waymarks` skill for full search options.

## Files to Skip

Don't add waymarks to:

- **Generated files**: `*.d.ts`, `*.generated.*`, `@generated` headers
- **Index/barrel files**: TLDR optional if only re-exports
- **Test fixtures**: Skip unless complex logic exists
- **Lock files**: `package-lock.json`, `bun.lockb`, etc.
- **Build artifacts**: `dist/`, `build/`, `.next/`
- **Empty files**: Flag for removal rather than adding waymarks

## Files That Need TLDRs

Prioritize in this order:

1. **Entry points**: `index.ts`, `main.ts`, `app.ts`
2. **Core services**: Authentication, database, API handlers
3. **Utilities**: Shared helpers, formatters, validators
4. **Configuration**: Non-trivial config files
5. **Documentation**: All markdown files (with `#docs` tag)
6. **Tests**: Test files with complex setup

## Common Mistakes

### Too Vague

```typescript
// Bad:  // tldr ::: utilities
// Good: // tldr ::: date parsing utilities with timezone normalization
```

### Too Long

```typescript
// Bad:  // tldr ::: this file contains the main authentication service that handles user login, registration, password reset, and session management using JWT tokens
// Good: // tldr ::: authentication service with login, registration, and JWT sessions
```

### Wrong Placement

```typescript
// Bad:
import { hash } from 'bcrypt';
// tldr ::: authentication service  // Too late!

// Good:
// tldr ::: authentication service with bcrypt password hashing
import { hash } from 'bcrypt';
```

### Missing Required Tag

```markdown
<!-- Bad:  tldr ::: API documentation for user endpoints -->
<!-- Good: tldr ::: API documentation for user endpoints #docs/api -->
```

## Coverage Script

```bash
coverage-report              # Files missing TLDRs
coverage-report --stats      # Coverage percentage
coverage-report --all        # All files with status
coverage-report --json       # JSON output for tooling
coverage-report --help       # All options
```

Script location: `.agents/skills/waymark-maintenance/scripts/coverage-report`

## Delegation

This skill delegates to the `waymarker` agent which operates in two modes:

- **Conservative (default)**: Reports findings, suggests waymarks, doesn't modify files
- **Autonomous**: Adds waymarks directly when instructed with "go ahead", "add them", etc.

Always start with conservative mode to review suggestions before bulk changes.
