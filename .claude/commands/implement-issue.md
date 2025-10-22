# Implement Linear Issue

Instructions tailored for the Waymark repository.

## Context

- Linear Team ID: `bf82309c-7e23-4a19-890d-a36b4ecad5c3`
- Linear Team Name: `Waymark`

## Overview

Orchestrate a complete implementation workflow for the requested Linear issue using specialized subagents. Follow Waymark practices for investigation, implementation, testing, and QA.

## Important

- Use `gt` / Graphite commands exclusively for branch and commit management.
- Pause and check in with the user if you hit unexpected behavior or blocking issues.

## Preparation

1. **Gather issue context**
   - Call `mcp__linear-server__get_issue` with the `$ARGUMENTS` issue key (e.g., `WAY-123`).
   - Capture `gitBranchName`, acceptance criteria, dependencies, and linked issues (`dependsOn`, `blockedBy`).
   - Update the issue status to “In Progress” once work begins.

2. **Check stack alignment**
   - Review the current stack: `gt log short`
   - If the issue depends on other Linear tickets, verify their branches exist and sit downstack from where this work will land.
   - Missing or incomplete dependencies → report the blockage to the user before proceeding.

3. **Verify branch selection**
   - Inspect current branch: `git branch --show-current`
   - Ensure the branch name matches the Linear `gitBranchName`. If not, inform the user and propose `gt create <gitBranchName>` from the correct parent (typically `gt/v1.0/rewrite` or the highest dependency branch).
   - Confirm stack positioning with `gt log` and adjust using `gt move --onto <parent>` if needed.

4. **Review local guidance**
   - Skim `@PLAN.md`, `@SCRATCHPAD.md`, and relevant docs (`@PRD.md`, `@README.md`, `.agents/rules/…`) for constraints or recent decisions that affect the work.
   - Add a dated entry to `@SCRATCHPAD.md` summarizing investigation or notable changes.

## Workflow Sequence

### Phase 1: Setup & Investigation

1. **Load Linear details**
   - Extract acceptance criteria and convert them into a TodoWrite task list.
   - Note any testing expectations, feature flags, or rollout considerations.

2. **Investigate as needed**
   - Launch `@agent-systematic-debugger` for bug hunts or behavioral regressions.
   - Launch `@agent-senior-engineer` for exploratory feature work or architecture questions.
   - Provide precise context: issue summary, suspected files (`packages/...`), existing waymarks, and expected vs. actual behavior.
   - Review findings before writing code.

### Phase 2: Implementation

3. **Implement the solution**
   - Engage `@agent-senior-engineer` with:
     - A clear problem statement.
     - Target files/lines.
     - Acceptance criteria and edge cases.
   - Ensure new comments follow the Waymark `:::` syntax.
   - Update `@SCRATCHPAD.md` with progress notes (date-stamped).

4. **Add or update tests**
   - Use `@agent-test-driven-developer` to cover new behavior.
   - Preferred frameworks: Vitest (`bun test`) and Playwright for E2E, per repo standards.
   - Tests should live alongside existing specs in `packages/*/src/**/*.test.ts` or appropriate directories.

### Phase 3: Quality Assurance

5. **Run required checks**

   ```bash
   bun check:all
   bun ci:validate
   bun ci:local
   ```

   - Run targeted commands (`bun test`, `bun run lint`, etc.) if quicker iteration is needed, but finish with the full trio above before submission.

6. **Fix failures promptly**
   - Re-run the failing command after fixes.
   - For persistent issues, bring in `@agent-systematic-debugger` (failures) or `@agent-code-reviewer` (lint/style gaps).

7. **Manual verification (CLI & docs)**
   - For CLI changes (`packages/cli`), run representative commands locally (e.g., `bun run wm add …`) within a sandbox directory.
   - For docs, ensure rendered Markdown has correct waymarks (`<!-- tldr ::: -->`, etc.).

### Phase 4: Documentation & Completion

8. **Update documentation**
   - Touch `docs/` content, README snippets, or in-repo instructions when user-facing behavior changes.
   - Keep documentation scannable and use waymark annotations (e.g., `<!-- summary ::: -->`).

9. **Prepare the commit/stack**
   - Determine whether the branch already has a PR (check `gt log short` for PR numbers).
   - **No existing PR** → use `gt modify -am "<message>"`.
   - **Existing PR** → use `gt modify -acm "<message>"` to add a new commit.
   - Commit message guidance:

     ```text
     <concise summary of changes>

     Fixes: WAY-XXX

     🤖 Generated with Claude Code (https://claude.com/claude-code)

     Co-Authored-By: Claude <noreply@anthropic.com>
     ```

10. **Verify acceptance criteria**
    - Cross-check each criterion from the Linear issue.
    - Mark completed items as `[x]` within the issue description (or comment on deviations).

11. **Update Linear**
    - Comment with:
      - Summary of changes.
      - Key files touched.
      - Tests and quality checks executed (with command list).
      - Any follow-up work or risks.
    - Move status to “In Review” when ready.

## Post-Implementation Checklist

- [ ] Acceptance criteria satisfied (or deviations documented).
- [ ] `bun check:all`, `bun ci:validate`, and `bun ci:local` all pass locally.
- [ ] New or updated tests added and passing.
- [ ] Source formatted (formatters run automatically through checks).
- [ ] Docs and waymarks updated where applicable.
- [ ] Linear issue commented and moved to “In Review”.
- [ ] Stack verified with `gt log` (branch in correct position).

## Key Principles

1. Delegate to specialized subagents—do not attempt every step solo.
2. Follow the order: Investigate → Implement → Test → Quality → Document.
3. Review subagent output for correctness before proceeding.
4. Keep Linear up to date throughout, not just at the end.
5. Maintain high quality: zero lint/type/test regressions, reproducible commands.
6. Document context in `@SCRATCHPAD.md` and use waymarks in new comments.

## Example Subagent Prompts

### Investigation (`@agent-systematic-debugger`)

```text
You are investigating WAY-<id>: <title>

Problem: <describe the bug/inconsistency>

Tasks:
1. Inspect <files/areas> for the source of <behavior>.
2. Explain the root cause with file paths and line numbers.
3. Recommend changes required to resolve it.

Do NOT modify code—only analyze and report back.
```

### Implementation (`@agent-senior-engineer`)

```text
You are implementing WAY-<id>: <title>

Root cause: <summary from investigation>

Tasks:
1. Update <files/sections> to achieve <desired behavior>.
2. Handle edge cases: <list>.
3. Follow existing patterns (Bun/TypeScript, strict typing).
4. Report back with diff summary, tests adjusted, and rationale.
```

### Testing (`@agent-test-driven-developer`)

```text
You are adding tests for WAY-<id>: <title>

Implementation summary: <what changed>

Tasks:
1. Add tests in <path> covering: <scenarios>.
2. Use Vitest/Playwright patterns already in the repo.
3. Run tests with `bun test` (or relevant script) and confirm passing results.
4. Report back with files touched and command output.
```

## Notes

- Scale the number of subagents to the complexity of the issue.
- For minor fixes, a single engineer + tester agent may suffice.
- Keep the user posted on progress, blockers, and verification status via Linear comments.
- Align with monorepo conventions and reuse shared utilities from `packages/*` wherever possible.
