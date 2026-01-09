<!-- tldr ::: contributor workflow for the Waymark repository -->

# Contributing

Thanks for helping improve Waymark! This guide covers the local setup,
development workflow, and expectations for pull requests.

## Prerequisites

- **Bun 1.2.22** (matches the `packageManager` version in `package.json`)
- Git + Graphite (`gt`) when working in Graphite-synced repos

## Setup

1. Install dependencies: `bun install`
2. Run the CLI locally: `bun dev:cli`
3. Run the core package in watch mode: `bun dev:core`

## Development Workflow

- Use conventional commits.
- Work on short-lived branches off `main`.
- Prefer Graphite stacks (`gt log`, `gt create`, `gt submit`) when configured.
- Keep PRs small and focused; feature-flag incomplete work.

## Testing & Checks

Run the checks that CI will enforce:

- `bun test` — run tests
- `bun check:all` — lint, typecheck, tests, and spec alignment
- `bun ci:local` — full CI simulation (recommended before pushing)
- `bun ci:validate` — tests/types/build (quick pre-push validation)

## Docs & Waymarks

- Add `<!-- tldr ::: ... -->` at the top of new Markdown files.
- Use the `:::` sigil for new waymarks and keep them greppable.
- Verify patterns with `rg ':::'` before committing.

## Pull Requests

- Keep branches up to date with `main` (rebase preferred).
- Squash-merge after checks pass.
- If you address `@coderabbitai` feedback, reply on the PR with a summary.
