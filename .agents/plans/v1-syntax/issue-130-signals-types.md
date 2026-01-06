# Issue #130: Syntax: signals + type aliases

## Context

Update grammar/parser/formatter/lint + tests for the v1 signal changes and type aliases (no backward-compat).

## Scope

- Replace raised signal `^` with `~` (important stays `*`), accept either order, format to canonical `~*`.
- Update blessed type list and aliases (context/why, temp/tmp, question/ask, about replaces this).
- Parser normalizes type casing to lowercase.

## Current behavior (for reference)

- Signals currently use `^` + `*` and formatters emit `^*` order.
- Blessed marker list includes `this` and uses aliases (context/why, temp/tmp, question/ask).
- Signal parsing happens in `packages/grammar/src/tokenizer.ts` and signal rendering in core/CLI formatters.

## Edge cases / expectations

- Accept both `~*todo` and `*~todo` input but normalize to `~*todo` in formatted output.
- `~` should be treated as the only raised signal (no `^` support).
- Ensure display + search filters map to the new `~` glyph while keeping flag names `--raised/--starred`.

## Change surface (code + docs)

### Grammar

- `packages/grammar/src/constants.ts` (signal chars, blessed markers, alias map, property key exclusions)
- `packages/grammar/src/tokenizer.ts` (signal parsing; order normalization)
- `packages/grammar/src/parser.ts`, `packages/grammar/src/builder.ts` (record construction with updated signal/type rules)
- `packages/grammar/src/types.ts` (signals + type fields)
- Tests: `packages/grammar/src/parser.test.ts`, `packages/grammar/src/constants.test.ts`
- `packages/grammar/README.md` examples

### Core

- `packages/core/src/format.ts` (signal prefix + order)
- `packages/core/src/insert.ts` (signal prefix when inserting)
- `packages/core/src/edit.ts` (signal overrides + formatting)
- `packages/core/src/remove.ts` (signal filters)
- `packages/core/src/normalize.ts` (type normalization + alias handling if centralized there)
- Tests: `packages/core/src/format.test.ts`, `packages/core/src/insert.test.ts`, `packages/core/src/edit.test.ts`, `packages/core/src/remove.test.ts`, `packages/core/src/normalize.test.ts`, `packages/core/src/search.test.ts`

### CLI

- `packages/cli/src/index.ts` (help text + examples)
- `packages/cli/src/commands/add.ts`, `packages/cli/src/commands/edit.ts`, `packages/cli/src/commands/remove.ts` (signal flags + output)
- Unified command parsing/filters: `packages/cli/src/commands/unified/*`
- Help content: `packages/cli/src/commands/help/registry.ts`, `packages/cli/src/commands/help/topics/signals.txt`, `packages/cli/src/commands/help/topics/syntax.txt`
- Prompt/help docs: `packages/cli/src/commands/*.prompt.txt`, `packages/cli/src/commands/*.help.txt`
- Display formatting: `packages/cli/src/utils/display/formatters/*.ts` (rendering signal glyphs)
- Tests: `packages/cli/src/index.test.ts`, `packages/cli/src/commands/*test.ts`, `packages/cli/src/commands/unified/*test.ts`

### Schemas

- `schemas/waymark-record.schema.json` (signal docs/examples if embedded)
- `schemas/waymark-scan-result.schema.json` (if it embeds record examples)

### Docs/examples (rg ':::' hits)

- `docs/GRAMMAR.md`
- `docs/waymark/SPEC.md`
- `docs/howto/README.md`
- `docs/cli/commands.md`
- `docs/cli/README.md`
- `docs/cli/waymark_editing.md`
- `README.md`
- `CLI_READOUT.md`
- `.waymark/rules/WAYMARKS.md` / `.waymark/rules/CONVENTIONS.md` / `docs/AGENTS.md` / `docs/ARCHITECTURE.md`

## Notes

- Keep `--raised/--starred` CLI flags but update rendered signal characters to `~` and `*`.
- Formatter should normalize to `~*` order even if parsed input was `*~`.
