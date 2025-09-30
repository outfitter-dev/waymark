<!-- tldr ::: Overview of the Waymark project and key resources -->

# Waymark

Waymark defines and maintains the `:::` comment sigil plus supporting tooling so humans and AI agents can leave durable, greppable breadcrumbs in codebases.

## Why Waymarks Exist

- Teams already rely on comment-level anchors (`TODO`, `FIXME`, `MARK`) because they survive refactors and are easy to search. Waymarks unify those patterns under one predictable grammar.
- Modern development needs annotations that speak to humans *and* agents. Waymarks encode ownership, intent, and constraints directly in comments without requiring AST access.
- A curated marker and property set keeps annotations portable across languages, editors, and automation.

Read the full background in [Historical Priors for Waymark-Style Anchors](docs/about/priors.md).

### Waymarks in Practice

```typescript
// tldr ::: managing customer authentication flow

export async function authenticate(request: AuthRequest) {
  // *fix ::: validate OTP length before verifying
  // context ::: callers must pass a sanitized email #security

  const user = await fetchUser(request.email)
  // question ::: should we allow social login here? @product

  /* ^todo ::: @agent implement refresh token rotation once backend ships */
  return issueSession(user, request) // note ::: returns JWT signed with HS256
}

Signals follow the v1 grammar: only the caret (`^`) and a single star (`*`) prefix are valid. Raised waymarks (`^todo`) mark branch-scoped work that must clear before merging; stars elevate priority. Combining them (`^*todo`) is fine, while doubling (`**fix`) is not.
```

## Start Here

1. **Product Requirements**: [PRD.md](PRD.md) defines the v1 grammar, tooling scope, and roadmap.
2. **Specification**: [Waymark Specification](docs/waymark/SPEC.md) mirrors the grammar in the PRD for quick reference.
3. **Agent Guidelines**: [AGENTS.md](AGENTS.md) covers collaboration expectations for human and AI contributors.

### Quick Demo: `waymark map`

Get an instant overview of your entire codebase with file-level `tldr` summaries:

```bash
$ waymark map

src/
├── auth.ts         // tldr ::: handles user authentication and JWT tokens
├── database.ts     // tldr ::: postgres connection and query builders
├── routes/
│   ├── users.ts    // tldr ::: user CRUD endpoints
│   └── admin.ts    // tldr ::: admin-only route handlers
├── utils/
│   ├── cache.ts    // tldr ::: Redis caching layer with TTL support
│   └── logger.ts   // tldr ::: structured logging with context
└── index.ts        // tldr ::: Express server initialization
```

This tree view instantly tells you what every file does - perfect for onboarding developers or giving AI agents context about your codebase architecture.

### CLI Usage

The `wm` command provides a unified interface for all waymark operations:

```bash
# Basic scanning and filtering (default mode)
wm src/                              # scan and display all waymarks
wm src/ --type todo                  # filter by waymark type
wm src/ --raised                     # show only raised (^) waymarks
wm src/ --starred                    # show only important (*) waymarks
wm src/ --type todo --mention @agent # combine filters

# Map mode: file tree with TLDRs
wm src/ --map                        # show file tree with TLDR summaries
wm docs/ --map --type todo --summary # focus on types with summary footer

# Graph mode: relation edges
wm src/ --graph                      # extract dependency relations
wm src/ --graph --json               # JSON output for tooling

# Output formats
wm src/ --json                       # compact JSON array
wm src/ --jsonl                      # newline-delimited JSON
wm src/ --pretty                     # pretty-printed JSON

# Standalone commands
wm format src/example.ts --write     # format a file
wm lint src/ --json                  # validate waymark types
wm migrate legacy.ts --write         # convert legacy comments
```

The CLI relies on the core formatter, parser, and map helpers exported from `@waymarks/core`. Cache refresh happens implicitly when `waymark scan` touches a file; no separate cache command is required.

### MCP Server

Waymark also ships a Model Context Protocol server so agents can consume the same tooling over stdio:

```bash
waymark-mcp
```

The server advertises a compact surface area:

- **Tools**
  - `waymark.scan` – parse files/directories and return waymark records in `text`, `json`, `jsonl`, or `pretty` formats.
  - `waymark.map` – produce the TLDR/marker summary JSON that powers the CLI map.
  - `waymark.graph` – emit relation edges (ref/depends/needs/etc.).
  - `waymark.insert` – insert any waymark (including `tldr`, `this`, `todo`, or custom markers) into a file, normalize it with the formatter, and return the inserted record metadata.
- **Resources**
  - `waymark://map` – repository-wide summary of TLDRs and marker counts.
  - `waymark://todos` – filtered list of every `todo` waymark detected.
- **Prompts**
  - `waymark.tldr` – drafts a TLDR sentence for a file given an optional snippet window.
  - `waymark.todo` – drafts actionable TODO content based on a summary/context payload.

Tools accept the same configuration options as the CLI (`configPath`, `scope`) so agents respect local project settings. The server streams JSON over stdout/stdin; see `apps/mcp/src/index.ts` for the exact schemas.

### Code Structure

- `packages/cli/src/index.ts` is a thin dispatcher that parses global flags and routes commands.
- Each command lives in `packages/cli/src/commands/<name>.ts` with its own argument parser and executor.
- Shared utilities reside in `packages/cli/src/utils/` (filesystem expansion, record rendering) and shared CLI types in `packages/cli/src/types.ts`.
- Tests primarily target the modules directly, while `packages/cli/src/index.test.ts` keeps a lightweight smoke suite.

## Current Focus

The project is mid-rebuild: we are prioritizing documentation, search patterns, and migration guidance before reintroducing heavy tooling. Favor clarity and greppability while we land the v1 toolchain.

## Repository Map

- `PRD.md` – Source of truth for grammar, tooling, and packaging
- `docs/` – Published documentation, including historical context (`docs/about`) and the specification (`docs/waymark/SPEC.md`)
- `.waymark/` – Project-specific waymark rules and conventions (`.waymark/rules/`)
- `.agents/` – General agent rules plus symlinks into `.waymark/rules/`
- `.migrate/` – Archived v1 content retained for research and migration notes

## Contributing

We follow conventional commits, short-lived branches, and Graphite-managed stacks. Review `.agents/rules/CORE.md` plus the waymark-specific guidance in `.waymark/rules/waymarks/WAYMARKS.md` and `.waymark/rules/conventions.md` before sending patches. When adding docs, include a `<!-- tldr ::: ... -->` preamble and verify new waymarks with `rg ':::'`.

## Questions?

Open an issue or DM me on Twitter [@mg](https://x.com/mg). If you discover another historical anchor pattern, add it to the priors catalogue so the spec keeps learning from the field.
