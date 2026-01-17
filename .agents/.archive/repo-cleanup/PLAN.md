<!-- tldr ::: organize and ship the outstanding repo cleanup work in manageable commits -->

# Repo Cleanup Plan

## Goals

- Remove tracked test-cache artifacts and prevent reintroduction.
- Consolidate test-cache usage to a single, predictable location.
- Group the current uncommitted docs/agent outputs into logical commits.
- Keep `main` clean with short, reviewable PRs.

## Current Findings

- `fixtures/test-cache.db` + `fixtures/test-cache.db-wal` are tracked and modified.
- `test-cache/waymark.db` + `test-cache/waymark.db-wal` are tracked; two cache locations exist.
- Test coverage permits both locations in `packages/core/src/cache/index.test.ts`.

## Cache Standardization

- **Decision**: Standardize test cache files under `.waymark-test/`.
- **Why**: Runtime artifacts should not live in `fixtures/`; a single hidden dir keeps the repo tidy and cleanup simple.
- **Outcome**: All tests and tooling should write to `.waymark-test/` and cleanup should remove it wholesale.

## Proposed Work Plan

1. **Standardize cache location**
   - Use `.waymark-test/` as the only workspace-local cache directory.
   - Update `packages/core/src/cache/index.test.ts` to reference `.waymark-test/waymark.db`.
   - Consider adding a helper/constant if multiple tests reference the path.

2. **Untrack cache artifacts**
   - Remove tracked `fixtures/test-cache.db*` and `test-cache/waymark.db*` from git history (keep ignored).
   - Verify `.gitignore` covers the chosen location and WAL/SHM variants.

3. **Commit grouping**
   - Docs: `docs/waymark/*` and `docs/development/*` in a docs-only commit.
   - Agent logs: `.agents/logs/*` in a logs-only commit.
   - Tooling outputs: `.claude-plugin/*`, `.claude/settings.local.json`, `skills/*` in separate commits if intended to ship.
   - CLI help: `packages/cli/src/commands/*.help.ts` in a CLI-help commit.

4. **Sanity checks**
   - Re-run targeted tests for cache path expectations if modified.
   - Ensure no generated cache files are tracked post-cleanup.

## Additional Branches

- **CLI help outputs**: add `fix/repo-cleanup-5-cli-help` for `packages/cli/src/commands/*.help.ts`.

## Open Questions

- Do we want cache-path tests to use a temp directory instead of repo paths?
- Should `.claude/settings.local.json` be committed or gitignored?
- Are `.claude-plugin/*` and `skills/*` intended for version control?
