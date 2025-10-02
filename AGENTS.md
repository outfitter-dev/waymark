<!-- tldr ::: agents configuration and development guidelines -->

# AGENTS.md

This file provides guidance to agents working in this repository.

> **Active Collaboration**: Follow @./PLAN.md for sequencing and jot transient notes in @SCRATCHPAD.md.
> **Authoritative Spec**: @./PRD.md is the single source of truth for the v1 grammar and tooling scope.

## 🚧 Project Rebuild Notice

**This project is currently being rebuilt from the bottom up.** We're starting fresh with documentation and simple grep-based usage before reintroducing any complex tooling.

For now we will be working exclusively from the `gt/v1.0/rewrite` branch.

### Old Project References

- **Local**: `~/Developer/outfitter/waymark-old`
- **GitHub**: [`outfitter-dev/waymark-old`](https://github.com/outfitter-dev/waymark-old)
- **Archive Branch**: `archive/pre-rebuild-2025-01` contains all previous implementation work

The rebuild focuses on clarity, simplicity, and progressive enhancement of the waymark pattern.

## IMPORTANT

- @README.md
- @PRD.md
- @PLAN.md
- @SCRATCHPAD.md
- @./.agents/rules/CORE.md
- @./.agents/rules/IMPORTANT.md
- @./.waymark/rules/WAYMARKS.md

## Project Overview

Waymarks are a standardized way to annotate code by using the `:::` sigil, along with other helpful details, directly in comments. This allows both humans and AI agents to quickly find relevant code sections using simple grep commands.

This repository handles the development and maintenance of the Waymark project. It contains:

- Specification & schemas for Waymarks
- Tooling for using Waymarks, such as a CLI, and other integrations (ESLint, VS Code, etc.)
- Documentation and guides for using Waymarks effectively
- Examples and templates for using Waymarks in code

## Historical Context

- Waymarks deliberately unify decades of comment-level anchors (TODOs, MARK, go:build, lint suppressions) into one predictable `:::` sigil. See `docs/about/priors.md` for the catalogue.
- The v2.0 rewrite is opinionated: fewer signals, curated markers, and no backward-compat guarantees for legacy waymarks. When you encounter v1 syntax, treat it as historical data and prefer translating it.
- We are still documenting migration paths—favor clarity and grep-first documentation over speculative tooling.

## Best Practices for This Repository

### Contributing

When working on this project:

1. Always use conventional commits
2. Work on feature branches off main
3. Use waymarks with `:::` syntax in any new code
4. Focus on simplicity and grep-ability
5. Use ripgrep to verify waymark patterns before commits
6. Follow the `:::` sigil syntax (space before when prefix present)
7. Update @SCRATCHPAD.md with a dated bullet log of anything you touch.
8. Update @./PLAN.md and note material changes in the Decisions Log when making project-level adjustments

### MCP Server Expectations

- Use `waymark-mcp` when an agent needs to interact with waymarks programmatically. The server exposes `waymark.scan`, `waymark.map`, `waymark.graph`, and `waymark.insert`, plus TLDR/TODO drafting prompts and map/todo resources.
- Commands accept `configPath` and `scope` options; always pass repository-specific settings so behavior matches the CLI.
- `waymark.insert` formats the target file automatically—run the server tool instead of writing raw strings when adding waymarks.
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
