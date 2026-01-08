<!-- tldr ::: documentation alignment plan covering quickstart, CONTRIBUTING.md, and accuracy fixes -->

# Documentation Alignment

**Phase:** P3 (Documentation & DX)
**Priority:** Should fix before v1.0 final

This document identifies documentation gaps and inaccuracies that should be addressed before the v1.0 release.

---

## Critical Fixes

### 1. Development Quickstart (Missing)

**Problem:** Root README describes usage but not how to develop from source. New contributors must hunt through subdirectories.

**Location:** Add to `README.md` after "Quick Demo" section

**Proposed content:**

````markdown
## Development

### Prerequisites

- [Bun](https://bun.sh) v1.2.22 or later (check `packageManager` in package.json)

### Quick Start

```bash
# Clone and install
git clone https://github.com/outfitter-dev/waymark.git
cd waymark
bun install

# Build all packages
bun run build

# Run tests
bun test

# Try the CLI
bun run packages/cli/src/index.ts --help
# Or after linking:
bun link @waymarks/cli
wm --help
```

### Package Structure

- `packages/grammar` - Parser and tokenizer
- `packages/core` - Config, scanning, formatting, IDs
- `packages/cli` - CLI application (`wm`)
- `apps/mcp` - MCP server for AI tooling

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.
````

### 2. Bun Version Requirement (Undocumented)

**Problem:** Repo pins `bun@1.2.22` in `packageManager`, but docs don't mention this.

**Locations to update:**

- `README.md` - Prerequisites section
- `CONTRIBUTING.md` - Setup section (once created)

**Fix:** Add explicit version requirement:

````markdown
**Required:** Bun 1.2.22 or later. Check your version:

```bash
bun --version
```

The exact version is specified in `package.json` under `packageManager`.

````

### 3. CONTRIBUTING.md (Missing)

**Problem:** No contributor guide exists. New contributors lack guidance on workflow, testing, and PR process.

**Create:** `CONTRIBUTING.md` at repository root

**Proposed structure:**

````markdown
# Contributing to Waymark

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `bun install`
3. Build: `bun run build`
4. Test: `bun test`

## Development Workflow

### Branch Naming

- `fix/description` - Bug fixes
- `feat/description` - New features
- `docs/description` - Documentation only
- `refactor/description` - Code refactoring

### Testing

- Write tests first (TDD preferred)
- Run full suite: `bun test`
- Run specific package: `bun test packages/core/`
- Pre-commit checks: `bun check:all`

### Commit Messages

Follow conventional commits:

```text

type(scope): description

Body explaining why (not what).

Co-Authored-By: Name <email>

```

Types: `fix`, `feat`, `docs`, `refactor`, `test`, `chore`

### Pull Requests

- Keep PRs focused (~100-250 lines)
- Include tests for new functionality
- Update docs if behavior changes
- Run `bun ci:local` before pushing

## Code Style

- TypeScript strict mode
- Biome for formatting (`bun run format`)
- No `any` types (use `unknown` + guards)
- Waymarks in new code (see .waymark/rules/)

## Architecture

See README.md for package structure. Key principles:

- `grammar` has no dependencies on other packages
- `core` depends on `grammar`
- `cli` depends on `core`
- `mcp` depends on `core`
````

---

## Accuracy Fixes

### 4. "Thin Dispatcher" Claim (Outdated)

**Problem:** Architecture docs claim CLI entry is a "thin dispatcher" but it's 1576 lines.

**Locations:**

- Any file mentioning "thin dispatcher" for CLI

**Fix:** Update to reflect reality:

```markdown
The CLI entry (`packages/cli/src/index.ts`) handles global flags, routing,
and shared utilities. Individual commands are modularized in
`packages/cli/src/commands/`.
```

### 5. `wm complete` Alias (Broken or Misdocumented)

**Problem:** README claims `wm complete` is backward-compatible alias, but it falls through to scan.

**Options:**

1. Fix the code (restore alias) - See @cli-improvements.md
2. Remove from documentation

**Locations:**

- `README.md` - Shell completions section

**If keeping alias, verify:**

```bash
wm complete zsh | head -1  # Should show completion script
```

### 6. Cache Behavior (Potentially Misdocumented)

**Problem:** README states "Cache refresh happens implicitly when `waymark scan` touches a file." Reports suggest scan doesn't use cache.

**Location:** `README.md` - Cache Usage section

**Fix:** Clarify actual behavior:

```markdown
### Cache Usage

The SQLite cache infrastructure exists but is not automatically integrated
with CLI scans in v1.0. Cache integration is planned for a future release.
For now, the cache is available programmatically via the `@waymarks/core` API.
```

---

## Content Improvements

### 7. Docstring Distinction (Needs Emphasis)

**Problem:** The distinction between waymarks and docstrings isn't prominent enough.

**Location:** Add to `README.md` after "Why Waymarks Exist"

**Proposed content:**

```markdown
### Waymarks Are Not Docstrings

Waymarks **complement** docstrings; they never replace them.

| Purpose | Use |
| --- | --- |
| Public API contracts | Docstrings (JSDoc/TSDoc/docstrings) |
| Internal intent + ownership | Waymarks |

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

```text

### 8. Exit Codes Documentation

**Problem:** Exit codes not documented in CLI help or README.

**Location:** `README.md` - CLI Usage section

**Proposed content:**

```markdown
### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Waymark error (lint failures, parse errors) |
| 2 | Usage error (invalid arguments) |
| 3 | Configuration error |
| 4 | I/O error (file not found, permission denied) |
```

### 9. Agent-Friendly Examples (Consolidated)

**Problem:** `.prompt.txt` files scattered across command directories create fragmented documentation. Agents must know which command exists before finding help.

**Solution:** Consolidate into modular `examples/` directory in skill structure:

```text
packages/agents/skills/waymark/examples/
├── workflows.md           # Multi-command recipes and workflows
├── agent-tasks.md         # Common task patterns for agents
├── batch-operations.md    # Bulk operations and scripting
└── integration.md         # MCP server, CI/CD, editor integration
```

**Access:** `wm skill show workflows`, `wm skill show agent-tasks`, etc.

**Benefits:**

- Single source of truth (replaces 5 scattered `.prompt.txt` files)
- Organized by use case, not by command
- Easier for agents to discover patterns (e.g., "multi-command workflows")
- Reduces maintenance burden vs scattered `.prompt.txt` files

---

## Verification

### Claims to Verify

| Claim | Location | Verification |
|-------|----------|--------------|
| `wm complete` alias works | README | `wm complete zsh` outputs completions |
| Cache integrates with scan | README | Check scan code path |
| CLI is "thin dispatcher" | Arch docs | Count lines in index.ts |
| All examples work | All docs | Copy-paste and run |

### Automated Checks

Add to CI:

```yaml
# .github/workflows/docs.yml
- name: Verify README examples
  run: |
    # Extract and run code examples from README
    bun run scripts/verify-docs.ts
```

**Script concept:**

```typescript
// scripts/verify-docs.ts
// Parse markdown code blocks
// Execute shell examples
// Verify output matches expectations
```

---

## Checklist

### Must Fix (P3)

- [ ] Add development quickstart to README
- [ ] Document Bun version requirement
- [ ] Create CONTRIBUTING.md
- [ ] Fix or remove "thin dispatcher" claims
- [ ] Clarify cache behavior claims
- [ ] Fix or document `wm complete` alias status
- [ ] Create `examples/` directory in skill structure
  - [ ] `examples/workflows.md` - Multi-command recipes
  - [ ] `examples/agent-tasks.md` - Common agent patterns
  - [ ] `examples/batch-operations.md` - Bulk operations
  - [ ] `examples/integration.md` - MCP, CI/CD, editor integration

### Should Fix

- [ ] Add "Waymarks Are Not Docstrings" section
- [ ] Document exit codes in README
- [ ] Add help snapshot tests
- [ ] Verify all README examples work
- [ ] Verify `wm skill show` works for all example sections

### Nice to Have

- [ ] Add automated docs verification script
- [ ] Create architecture diagram
- [ ] Add troubleshooting section
- [ ] Document MCP server setup

---

## Files to Create/Modify

| File | Changes |
|------|---------|
| `README.md` | Quickstart, Bun version, cache clarification, docstring section, exit codes |
| `CONTRIBUTING.md` | Create new file |
| `docs/waymark/SPEC.md` | Verify accuracy |
| `docs/GRAMMAR.md` | Verify examples work |
| Any file with "thin dispatcher" | Update or remove claim |
| **`packages/agents/skills/waymark/SKILL.md`** | Create core skill document |
| **`packages/agents/skills/waymark/commands/*.md`** | Create command-specific docs |
| **`packages/agents/skills/waymark/references/*.md`** | Create technical reference docs |
| **`packages/agents/skills/waymark/examples/workflows.md`** | Create multi-command workflow recipes |
| **`packages/agents/skills/waymark/examples/agent-tasks.md`** | Create common agent task patterns |
| **`packages/agents/skills/waymark/examples/batch-operations.md`** | Create bulk operations guide |
| **`packages/agents/skills/waymark/examples/integration.md`** | Create integration guide (MCP, CI/CD, editors) |
| **`packages/agents/skills/waymark/index.json`** | Create manifest file |

---

## Timeline

**Recommended order:**

1. Create CONTRIBUTING.md (standalone, no dependencies)
2. Add README quickstart (high value, low risk)
3. Fix accuracy issues (cache, alias claims)
4. Add docstring section
5. Add automated verification (if time permits)
