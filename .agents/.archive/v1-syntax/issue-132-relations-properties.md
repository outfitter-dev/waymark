# Issue #132: Syntax: relations + properties

## Context

Adopt v1 relation properties and property parsing rules (`see:`, `docs:`, `from:`, `replaces:`) and drop legacy relation keys.

## Scope

- Replace legacy relations (`ref`, `rel`, `depends`, `needs`, `blocks`, `dupeof`) with new relation properties.
- Support repeated relation properties instead of array syntax.
- Ensure properties follow `key:value` with quoted values; no empty values.
- Add `sym:` property support (symbol binding).

## Current behavior (for reference)

- Relation kinds live in grammar constants/types and power `buildRelationGraph`.
- Property parsing is currently geared around legacy relation keys and allows `ref:#token` patterns.
- CLI exposes flags like `--depends/--needs/--blocks` and `--ref` for relation properties.

## Edge cases / expectations

- `docs:` must accept URLs with `:` (first colon splits key/value; later colons are part of value).
- Repeating relation properties should produce multiple edges (no comma arrays).
- Lint should error on empty values and unknown relation keys.

## Change surface (code + docs)

### Grammar

- `packages/grammar/src/constants.ts` (property key allowlist; remove legacy relation keys; add `see/docs/from/replaces/sym`)
- `packages/grammar/src/properties.ts` (parse quoted values, reject empty values, parse new relation keys)
- `packages/grammar/src/types.ts` (relation kinds list)
- `packages/grammar/src/content.ts` (property-as-marker continuation behavior)
- `packages/grammar/src/parser.ts` / `packages/grammar/src/builder.ts` (populate relations + properties)
- Tests: `packages/grammar/src/parser.test.ts`, `packages/grammar/src/constants.test.ts`

### Core

- `packages/core/src/normalize.ts` (relation normalization + ordering)
- `packages/core/src/graph.ts` + `packages/core/src/graph.test.ts` (edges for new relation kinds)
- `packages/core/src/format.ts` (property ordering/formatting)
- `packages/core/src/cache/serialization.ts` + `packages/core/src/cache/schema.ts` (relation kinds stored)
- Tests: `packages/core/src/normalize.test.ts`, `packages/core/src/format.test.ts`

### CLI

- `packages/cli/src/index.ts` (add/remove relation flags + help examples)
- `packages/cli/src/commands/add.ts` (flags for `see/docs/from/replaces` + `sym`)
- `packages/cli/src/commands/help/registry.ts` + `packages/cli/src/commands/help/topics/syntax.txt`
- `packages/cli/src/commands/unified/query-parser.ts` (property tokens)
- `packages/cli/src/commands/doctor.ts` (relation validity checks)
- Tests: `packages/cli/src/index.test.ts`, `packages/cli/src/commands/unified/query-parser.test.ts`

### Schemas

- `schemas/waymark-record.schema.json` (relation kinds + properties description)
- `schemas/waymark-scan-result.schema.json` (if includes relation examples)

### Docs/examples (rg ':::' hits)

- `docs/waymark/SPEC.md`
- `docs/GRAMMAR.md`
- `docs/howto/README.md`
- `docs/cli/commands.md`
- `docs/cli/README.md`
- `docs/cli/waymark_editing.md`
- `README.md`
- `CLI_READOUT.md`
- `.waymark/rules/WAYMARKS.md`

## Notes

- Update graph semantics: edges should be recorded for `see/from/replaces` (directionality per spec).
- If CLI keeps legacy flags, they should be removed or mapped to new properties explicitly.
