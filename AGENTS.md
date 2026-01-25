<!-- tldr ::: agents configuration and development guidelines -->

# AGENTS.md

This file provides guidance to agents working in this repository.

## Skills & Conventions

Use your skills for development methodology (TDD, debugging, architecture, code review). For waymark usage, load the `using-waymarks` skill or run `wm skill` for CLI guidance.
<!-- note ::: agent-facing CLI guidance lives in `wm skill` and `packages/agents/skills/using-waymarks/` -->

## Key References

- @README.md
- `wm skill` (agent documentation for CLI and waymark usage)

## Project Overview

Waymarks are a standardized way to annotate code by using the `:::` sigil, along with other helpful details, directly in comments. This allows both humans and AI agents to quickly find relevant code sections using simple grep commands.

This repository handles the development and maintenance of the Waymark project. It contains:

- Specification & schemas for Waymarks
- Tooling for using Waymarks, such as a CLI, and other integrations (ESLint, VS Code, etc.)
- Documentation and guides for using Waymarks effectively
- Examples and templates for using Waymarks in code

## Historical Context

- Waymarks deliberately unify decades of comment-level anchors (TODOs, MARK, go:build, lint suppressions) into one predictable `:::` sigil. See `docs/about/priors.md` for the catalogue.
- The v2.0 rewrite is opinionated: fewer signals and curated markers.

## Best Practices for This Repository

### Contributing

When working on this project:

1. Always use conventional commits
2. Work on feature branches off main
3. Use waymarks with `:::` syntax in any new code
4. Focus on simplicity and grep-ability
5. Use ripgrep to verify waymark patterns before commits
6. Follow the `:::` sigil syntax (space before when prefix present)

### MCP Server Expectations

- Use `waymark-mcp` when an agent needs to interact with waymarks programmatically. The server exposes a single `waymark` tool (`action: scan | graph | add`) and a `waymark://todos` resource.
- Commands accept `configPath` and `scope` options; always pass repository-specific settings so behavior matches the CLI.
- `waymark` with `action: "add"` formats the target file automatically—run the server tool instead of writing raw strings when adding waymarks.
- Treat MCP responses as the source of truth for agent-visible state; avoid duplicating parsing logic outside of `@waymarks/core`.

### Pre-Push Quality Checks

**CRITICAL**: Before pushing any code:

1. **Run CI locally**: `bun ci:local` - This simulates the full CI pipeline
2. **Comprehensive check**: `bun check:all` - Runs lint, typecheck, and tests
3. **Quick validation**: `bun ci:validate` - Tests, types, and build only

The pre-push hook will automatically run these checks, but running them manually first saves time.

### Documentation Standards

- All markdown files should have `<!-- tldr ::: <short description> -->` at the top
- Use contextual waymarks like `<!-- note ::: <description> -->` or `<!-- summary ::: <description> -->`
- Keep documentation focused and scannable
- Link related docs for navigation
- No prefix = pure note (e.g., `<!-- ::: this explains the context -->`)

### Docstrings for Public Exports

- Use `/** ... */` TSDoc on exported functions/types in packages and apps
- Describe what/why, document parameters/returns, and add `@throws` when relevant
- Keep docstrings concise (aim for ~10 lines); link to docs when deeper context is needed
- Update docstrings alongside behavior changes to avoid stale guidance

### Examples

```javascript
// Basic waymarks
// todo ::: implement validation
// fix ::: memory leak in auth handler
// tldr ::: handles user authentication

// With properties and hashtags
// todo ::: priority:high implement caching #performance
// warn ::: validates all inputs #security

// Pure notes (no prefix)
// ::: this is a performance hotpath
// ::: assumes UTC timestamps

// With mentions
// todo ::: @alice implement OAuth flow
// ::: @bob please review this approach

// Issue references
// todo ::: fixes:#234 implement auth flow
// done ::: closes:#456 added validation
```
