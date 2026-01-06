# Issue #134: Syntax: continuations + whitespace normalization

## Context

Adjust continuation parsing and whitespace normalization to match v1 rules.

## Scope

- Markerless `:::` continues prior waymark; properties/tokens can appear on continuation lines.
- Parser tolerates flexible spacing; formatter normalizes to single space around `:::` and aligned continuations (configurable).
- Ensure continuation handling works for HTML comments and property-as-marker lines.

## Current behavior (for reference)

- Continuation parsing lives in `packages/grammar/src/content.ts` and `builder.ts` with context-aware rules.
- Formatter aligns continuations when `format.alignContinuations` is true.

## Edge cases / expectations

- Markerless `:::` outside a waymark context should be ignored.
- Property-as-marker continuations should only trigger for known property keys.
- HTML comments must keep closing `-->` and align `:::` correctly in multi-line blocks.

## Change surface (code + docs)

### Grammar

- `packages/grammar/src/content.ts` (continuation detection and property-as-marker rules)
- `packages/grammar/src/builder.ts` (continuation aggregation)
- `packages/grammar/src/tokenizer.ts` (sigil detection with spacing tolerance)
- `packages/grammar/src/constants.ts` (continuation property keys)
- Tests: `packages/grammar/src/parser.test.ts`

### Core

- `packages/core/src/format.ts` (alignment + whitespace normalization)
- `packages/core/src/insert.ts` (continuation insertion + alignment)
- `packages/core/src/edit.ts` (edit preservation of continuations)
- Tests: `packages/core/src/format.test.ts`, `packages/core/src/insert.test.ts`, `packages/core/src/edit.test.ts`

### CLI

- `packages/cli/src/index.ts` (format examples + rules)
- `packages/cli/src/commands/format.help.txt` + `packages/cli/src/commands/format.prompt.txt`
- `packages/cli/src/commands/lint.ts` (continuation checks)
- `packages/cli/src/utils/display/formatters/enhanced.ts` (rendering continuations)
- Tests: `packages/cli/src/index.test.ts` (format output examples)

### Docs/examples (rg ':::' hits)

- `docs/GRAMMAR.md`
- `docs/waymark/SPEC.md`
- `docs/howto/README.md`
- `README.md`
- `CLI_READOUT.md`

## Notes

- Keep alignment configurable (`format.alignContinuations`) but normalize spacing around `:::` regardless.
