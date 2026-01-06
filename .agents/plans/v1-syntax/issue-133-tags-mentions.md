# Issue #133: Syntax: tags + mentions

## Context

Adopt v1 rules for tags and mentions (bare `#tag` tokens and stricter mention parsing).

## Scope

- Tags are bare `#tag` tokens; no `tags:` property.
- Mentions are `@` + identifier (`[A-Za-z][A-Za-z0-9_-]*`) with clear non-mention exceptions (emails, `@scope/pkg`, decorators).
- Parser extracts tokens; formatter should preserve content without rewriting semantics.

## Current behavior (for reference)

- Tag regex lives in `packages/grammar/src/properties.ts` and currently allows `#[A-Za-z0-9._/:%-]+`.
- Mentions are extracted more permissively; need stricter boundary rules to avoid emails/decorators.

## Edge cases / expectations

- Do not treat `user@domain.com` as a mention.
- Do not treat `@scope/package` as a mention.
- Do not treat `@Decorator()` as a mention when followed by `(`.
- Allow quoted literals that contain `@` or `#` without extracting tokens.

## Change surface (code + docs)

### Grammar

- `packages/grammar/src/properties.ts` (TAG_REGEX + MENTION_REGEX; mention boundary rules)
- `packages/grammar/src/parser.ts` (token extraction)
- Tests: `packages/grammar/src/parser.test.ts` (mentions/tags edge cases)
- `packages/grammar/README.md` examples

### Core

- `packages/core/src/normalize.ts` (tag/mention normalization if regex changes)
- `packages/core/src/cache/serialization.ts` + `packages/core/src/cache/schema.ts` (record fields unchanged but review examples)
- Tests: `packages/core/src/normalize.test.ts`, `packages/core/src/search.test.ts`

### CLI

- `packages/cli/src/index.ts` (examples for `--tag/--mention`)
- `packages/cli/src/commands/unified/query-parser.ts` (tokenization rules for tags/mentions)
- `packages/cli/src/commands/help/topics/tags.txt` + `packages/cli/src/commands/help/registry.ts`
- Tests: `packages/cli/src/index.test.ts`, `packages/cli/src/commands/unified/query-parser.test.ts`

### Docs/examples (rg ':::' hits)

- `docs/GRAMMAR.md`
- `docs/waymark/SPEC.md`
- `docs/howto/README.md`
- `docs/cli/commands.md`
- `docs/cli/README.md`
- `README.md`
- `CLI_READOUT.md`

## Notes

- Keep mention extraction resilient to punctuation but avoid false positives for emails and decorators.
