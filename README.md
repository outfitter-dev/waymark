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
  // !fix ::: validate OTP length before verifying
  // context ::: callers must pass a sanitized email #security

  const user = await fetchUser(request.email)
  // question ::: should we allow social login here? @product

  // *todo ::: @agent implement refresh token rotation once backend ships
  return issueSession(user, request) // note ::: returns JWT signed with HS256
}

Signals follow the v1 grammar: only `*` and a single `!` prefix are valid (`*!todo` is fine, `!!fix` is not).
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
