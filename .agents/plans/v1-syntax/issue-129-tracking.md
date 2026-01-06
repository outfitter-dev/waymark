# Issue #129: Waymark v1 syntax updates (tracking issue)

## Context

We are adopting the new v1 syntax recap (no backward-compat). This issue tracks the full scope and subissues.

## Summary of changes (short)

- Signals: raised is `~`, important is `*`, canonical order `~*`.
- IDs: wikilink-style `[[hash]]` or `[[hash|alias]]`, alias-only `[[alias]]` pre-assignment.
- Relations: `see:`, `docs:`, `from:`, `replaces:` properties; repeat properties instead of arrays.
- Properties: `key:value` with quoted values; no empty values; add `sym:`.
- Tokens: bare tags `#tag` and mentions `@handle` with stricter mention rules.
- Continuations: markerless `:::` lines continue previous waymark; formatter normalizes alignment.
- Whitespace: formatter normalizes to single spaces around `:::`.
- Types: updated blessed list + aliases; parser normalizes to lowercase.

## Current status

- Codebase currently supports legacy `wm:` IDs, `^` raised signals, and legacy relation keys.
- v1 rollout is a breaking change; no backward compatibility expected.

## Subissues

- [ ] #130 (signals + type aliases)
- [ ] #131 (IDs + alias lifecycle + scaling)
- [ ] #132 (relations + properties)
- [ ] #133 (tags + mentions)
- [ ] #134 (continuations + whitespace)
- [ ] #135 (docs + help)

## Change surface (umbrella)

### Grammar + Core

- `packages/grammar/src/*` (constants, tokenizer, parser, properties, types)
- `packages/core/src/*` (format, insert, edit, remove, normalize, graph, ids)
- `schemas/*` (record + scan result schemas)

### CLI

- `packages/cli/src/index.ts`
- `packages/cli/src/commands/*` (add/edit/remove/find/unified/doctor/lint)
- `packages/cli/src/commands/help/*` + prompt/help text
- `packages/cli/src/utils/display/*` (formatters)

### Docs/examples (rg ':::' hits)

- `docs/GRAMMAR.md`
- `docs/waymark/SPEC.md`
- `docs/howto/README.md`
- `docs/cli/commands.md`
- `docs/cli/README.md`
- `docs/cli/waymark_editing.md`
- `docs/README.md`
- `docs/about/priors.md`
- `docs/waymark/tui-ab-plan.md`
- `README.md`
- `CLI_READOUT.md`
- `CHANGELOG.md`
- `AGENTS.md`
- `.waymark/rules/*`
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

## Notes

- Use `rg ':::'` and `rg 'wm:'` to locate and update all examples.
