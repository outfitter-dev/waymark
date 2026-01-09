<!-- tldr ::: Overview of the Waymark project and key resources -->

# Waymark

Waymark defines and maintains the `:::` comment sigil plus supporting tooling so humans and AI agents can leave durable, greppable breadcrumbs in codebases.

> Current prerelease: **1.0.0-beta.1** (2025-10-03)

## Why Waymarks Exist

- Teams already rely on comment-level anchors (`TODO`, `FIXME`, `MARK`) because they survive refactors and are easy to search. Waymarks unify those patterns under one predictable grammar.
- Modern development needs annotations that speak to humans *and* agents. Waymarks encode ownership, intent, and constraints directly in comments without requiring AST access.
- A curated marker and property set keeps annotations portable across languages, editors, and automation.

Read the full background in [Historical Priors for Waymark-Style Anchors](docs/about/priors.md).

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

### Waymarks in Practice

```typescript
// tldr ::: managing customer authentication flow

export async function authenticate(request: AuthRequest) {
  // *fix ::: validate OTP length before verifying
  // context ::: callers must pass a sanitized email #security

  const user = await fetchUser(request.email)
  // question ::: should we allow social login here? @product

  // ~todo ::: @agent implement refresh token rotation once backend ships
  return issueSession(user, request) // note ::: returns JWT signed with HS256
}
```

Signals follow the v1 grammar: only the tilde (`~`) and a single star (`*`) prefix are valid. Raised waymarks (`~todo`) mark work-in-progress that must clear before merging; starred waymarks (`*fix`) mark high-priority items. Combining them (`~*todo`) is fine, while doubling (`**fix`) is not.

Line comments are preferred for waymarks. Use block comments only in languages without line-comment support (for example, CSS).

## Start Here

1. **Specification**: [Waymark Specification](docs/waymark/SPEC.md) defines the grammar, tooling scope, and roadmap.
2. **Grammar Reference**: [Waymark Grammar](docs/GRAMMAR.md) mirrors the specification for quick lookup.
3. **Agent Guidelines**: [AGENTS.md](AGENTS.md) covers collaboration expectations for human and AI contributors.

### Quick Demo: Find TLDRs

Get an instant overview of your codebase with file-level `tldr` summaries:

```bash
$ wm find src/ --type tldr

src/auth.ts:1
  tldr ::: handles user authentication and JWT tokens

src/database.ts:1
  tldr ::: postgres connection and query builders

src/routes/users.ts:1
  tldr ::: user CRUD endpoints

src/utils/cache.ts:1
  tldr ::: Redis caching layer with TTL support
```

TLDR waymarks instantly tell you what every file does - perfect for onboarding developers or giving AI agents context about your codebase architecture.

### CLI Usage

The `wm` command provides a unified interface for all waymark operations:

```bash
# Basic scanning and filtering
wm find src/                              # scan and display all waymarks
wm find src/ --type todo                  # filter by waymark type
wm find src/ --flagged                    # show only flagged (~) waymarks (in-progress)
wm find src/ --starred                    # show only starred (*) waymarks (high-priority)
wm find src/ --type todo --mention @agent # combine filters

# Graph mode: relation edges
wm find src/ --graph                      # extract dependency relations
wm find src/ --graph --json               # JSON output for tooling

# Output formats
wm find src/ --json                       # compact JSON array
wm find src/ --jsonl                      # newline-delimited JSON
wm find src/ --text                       # human-readable formatted text

# Standalone commands
wm fmt src/ --write               # format waymarks in a directory
wm lint src/ --json                  # validate waymark types
wm rm src/auth.ts:42 --write     # remove a waymark
wm edit src/auth.ts:42 --flagged --write # adjust an existing waymark
wm config --print                  # print merged configuration

# Agent documentation
wm skill                            # core skill documentation
wm skill show add                   # command-specific docs
wm skill --json                     # structured JSON output
```

To include legacy codetags (TODO/FIXME/NOTE/etc.) in scans, enable:

```toml
[scan]
include_codetags = true
```

When ID history tracking is enabled (`ids.track_history = true`), removals are recorded in `.waymark/history.json` with `removedAt`, `removedBy`, and optional `reason` metadata (via `wm rm --reason`).

The CLI relies on the core formatter and parser helpers exported from `@waymarks/core`.

### Cache Usage

The CLI can populate and reuse the SQLite cache for faster repeated scans by
passing the global `--cache` flag (disabled by default). The cache is also
available programmatically via `@waymarks/core` (see `WaymarkCache`), and
`wm doctor` reports cache directory health.

### Exit Codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Waymark error (lint failures, parse errors) |
| 2 | Usage error (invalid arguments) |
| 3 | Configuration error |
| 4 | I/O error (file not found, permission denied) |

#### Shell Completions

Generate completions dynamically with the built-in `completions` command. The
examples below write the script to a cache directory and source it from your
shell profile:

```bash
# Zsh
mkdir -p ~/.local/share/waymark/completions
wm completions zsh > ~/.local/share/waymark/completions/wm.zsh
echo 'source ~/.local/share/waymark/completions/wm.zsh' >> ~/.zshrc

# Bash
mkdir -p ~/.local/share/waymark/completions
wm completions bash > ~/.local/share/waymark/completions/wm.bash
echo 'source ~/.local/share/waymark/completions/wm.bash' >> ~/.bashrc

# Fish
mkdir -p ~/.config/fish/completions
wm completions fish > ~/.config/fish/completions/wm.fish

# PowerShell
mkdir -p ~/.config/waymark/completions
wm completions powershell > ~/.config/waymark/completions/wm.ps1
Add-Content $PROFILE "`n. ~/.config/waymark/completions/wm.ps1"
```

Run `wm completions` without arguments to list supported shells or emit debugging
information. Note: `wm complete` is also supported as a backward-compatible alias.

### Configuration Precedence

Waymark loads configuration with the following precedence (highest wins):

1. `--config <path>` explicit config file
2. `WAYMARK_CONFIG_PATH` environment variable
3. Project config: `.waymark/config.(toml|jsonc|yaml|yml)` (walks up from cwd)
4. User config: `~/.config/waymark/config.(toml|jsonc|yaml|yml)` (or `$XDG_CONFIG_HOME`)

Use `--scope project|user|default` to limit search, and `wm config --print` to
inspect the merged configuration.

### MCP Server

Waymark also ships a Model Context Protocol server so agents can consume the same tooling over stdio:

```bash
waymark-mcp
```

The server advertises a compact surface area:

- **Tools**
  - `waymark` – single tool for waymark actions. Set `action` to `scan`, `graph`, `add`, or `help` and provide the corresponding inputs. `scan`/`graph` default to the current directory when `paths` is omitted.
- **Resources**
  - `waymark://todos` – filtered list of every `todo` waymark detected.

Drafting TLDR/TODO guidance now lives in agent skills (use `wm skill` to browse). MCP prompts were removed. Tools accept the same configuration options as the CLI (`configPath`, `scope`) so agents respect local project settings. The server streams JSON over stdout/stdin; see `apps/mcp/src/index.ts` for the exact schemas.

### Code Structure

- `packages/cli/src/index.ts` wires Commander, help formatting, and command routing.
- Each command lives in `packages/cli/src/commands/<name>.ts` with its own argument parser and executor.
- Shared utilities reside in `packages/cli/src/utils/` (filesystem expansion, record rendering) and shared CLI types in `packages/cli/src/types.ts`.
- Tests primarily target the modules directly, while `packages/cli/src/index.test.ts` keeps a lightweight smoke suite.

## Development Quickstart

1. Install Bun **1.2.22** (matches `packageManager` in `package.json`).
2. Install dependencies: `bun install`
3. Run tests: `bun test` (or `bun check:all` for lint/typecheck/tests/spec)
4. Start CLI dev loop: `bun dev:cli`

## Current Focus

The project is mid-rebuild: we are prioritizing documentation, search patterns, and migration guidance before reintroducing heavy tooling. Favor clarity and greppability while we land the v1 toolchain.

## Repository Map

- `docs/waymark/SPEC.md` – Source of truth for grammar, tooling, and packaging
- `docs/` – Published documentation, including historical context (`docs/about`) and the grammar reference (`docs/GRAMMAR.md`)
- `.waymark/` – Project-specific waymark rules and conventions (`.waymark/rules/`)
- `.agents/` – General agent rules plus symlinks into `.waymark/rules/`
- `.migrate/` – Archived v1 content retained for research and migration notes

## Contributing

We follow conventional commits, short-lived branches, and Graphite-managed stacks. Review `.agents/rules/CORE.md` plus the waymark-specific guidance in `.waymark/rules/WAYMARKS.md` and `.waymark/rules/CONVENTIONS.md` before sending patches. When adding docs, include a `<!-- tldr ::: ... -->` preamble and verify new waymarks with `rg ':::'`.

## Troubleshooting

- **Bun/npm registry errors:** verify your registry in `~/.npmrc` and network access. If needed, set `NPM_CONFIG_REGISTRY` or `BUN_CONFIG_REGISTRY`.
- **`wm` not found after install:** run `bun install` and `bun install:bin` (or `bun dev:cli` for local dev).
- **Config parse failures:** run `wm config --print` to validate merged config, or `wm doctor` for diagnostics.

## Questions?

Open an issue or DM me on Twitter [@mg](https://x.com/mg). If you discover another historical anchor pattern, add it to the priors catalogue so the spec keeps learning from the field.
