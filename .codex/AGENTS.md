# Codex Agent Instructions

This file provides Codex-specific guidance for working in this repository.

## Project Conventions

Refer to these documentation files for project-specific conventions:

- `.agents/rules/ARCHITECTURE.md` — TypeScript config, Biome/Ultracite setup
- `.agents/rules/MONOREPO.md` — Bun workspaces, Turbo pipelines, package structure
- `.agents/rules/MCP.md` — Available MCP servers (context7, github, sequential-thinking)
- `.agents/rules/API.md` — API design conventions
- `.agents/rules/DATA.md` — Data handling patterns
- `.agents/rules/ERRORS.md` — Error handling patterns
- `.agents/rules/LINEAR.md` — Linear integration for issue tracking

## Waymark-Specific Rules

- `.waymark/rules/WAYMARKS.md` — Waymark grammar, markers, and usage
- `.waymark/rules/CONVENTIONS.md` — Project-specific waymark conventions
- `.waymark/rules/TLDRs.md` — Writing TLDR waymarks
- `.waymark/rules/THIS.md` — Writing `this :::` waymarks

## Quality Checks

Before pushing code:

1. `bun ci:local` — Full CI simulation
2. `bun check:all` — Lint, typecheck, and tests
3. `bun ci:validate` — Tests, types, and build only
