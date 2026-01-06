# Issue #135: Docs + help updates for v1 syntax

## Context

Update all docs + CLI help to reflect the v1 syntax recap (signals, IDs, relations, properties, mentions/tags, continuations).

## Scope

- Refresh docs and examples to the new syntax (no backward-compat).
- Ensure CLI help/prompt text is consistent with new syntax.
- Verify docs with `rg ':::'` to update examples in place.

## Specific replacements to sweep

- Signals: `^` -> `~`, order `~*`.
- Types: `this` -> `about` (and update aliases).
- Relations: `ref/depends/needs/blocks/dupeof/rel` -> `see/docs/from/replaces`.
- IDs: `wm:...` -> `[[hash]]` / `[[hash|alias]]` (alias-only `[[alias]]` where draft).

## Change surface (docs + help)

### Primary docs

- `docs/GRAMMAR.md`
- `docs/waymark/SPEC.md`
- `docs/howto/README.md`
- `docs/cli/commands.md`
- `docs/cli/README.md`
- `docs/cli/waymark_editing.md`
- `docs/about/priors.md` (legacy references)
- `docs/waymark/tui-ab-plan.md`
- `docs/README.md`
- `README.md`
- `CLI_READOUT.md`
- `CHANGELOG.md`
- `AGENTS.md`
- `.waymark/rules/WAYMARKS.md`
- `.waymark/rules/CONVENTIONS.md`
- `docs/AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/development/AGENTS.md`
- `docs/development/ARCHITECTURE.md`
- `packages/core/README.md`
- `packages/grammar/README.md`
- `agents/waymarker.md`
- `commands/waymark/*.md`
- `skills/*/SKILL.md`
- `skills/*/references/*.md`

### CLI help + prompts

- `packages/cli/src/index.ts` (global help + examples)
- `packages/cli/src/commands/help/registry.ts`
- `packages/cli/src/commands/help/topics/*.txt`
- `packages/cli/src/commands/*.prompt.txt`
- `packages/cli/src/commands/*.help.txt`

### Schemas/examples

- `schemas/waymark-record.schema.json`
- `schemas/waymark-scan-result.schema.json`

## Notes

- Use `rg ':::'` and `rg 'wm:'` to find and update all example waymarks and ID references.
- Update CLI examples to avoid invalid root flags (use `wm find` for filter/graph examples).
