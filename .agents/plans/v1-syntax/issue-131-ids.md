# Issue #131: Syntax: IDs + alias lifecycle + scaling

## Context

Implement wikilink-style IDs and alias lifecycle rules for v1 syntax.

## Scope

- Canonical ID: `[[hash]]` or `[[hash|alias]]`.
- Draft/pre-assignment: `[[alias]]` (lint warning until assigned).
- Terminal `[[...]]` in a waymark is the identity; earlier `[[...]]` are references.
- ID length scaling: 4-char default, 5-char after 10k IDs, 6-char after 500k IDs (existing IDs never change).
- Alias collisions warn; strict mode can elevate to error.

## Current hash generation guidance (needs carry‑over/update)

**Source of truth today:** `packages/core/src/ids.ts`

- `generateUniqueId` uses `Bun.hash.wyhash` on a combined string: `${file}|${line}|${type}|${content}|${Date.now()}|${attempt}`.
- Output is base36, padded + sliced to `max(4, config.length)` characters.
- IDs are currently stored with the `wm:` prefix.

Docs currently describe a different algorithm/length (xxHash64, 7–9 chars) in `docs/cli/waymark_editing.md` and must be updated to match the new v1 ID rules.

## Delta notes

- This v1 change **drops backward compatibility** with `wm:` IDs.
- We may want a one-off script to strip legacy `wm:` IDs (or convert to new `[[...]]` format) for local cleanup.

### One‑off cleanup script sketch

Goal: remove legacy `wm:` IDs from waymark content and optionally clear `.waymark/index.json` so the new ID system can reassign.

Pseudo-flow:

1) `rg 'wm:[a-z0-9-]+'` to find files.
2) For each file, parse waymarks and strip `wm:` tokens from content.
3) Reformat with `formatText` to normalize spacing.
4) Optionally delete `.waymark/index.json` or run a fresh index rebuild.

Potential implementation entry points:

- new script under `scripts/` (e.g., `scripts/strip-legacy-ids.ts`)
- use core `parse` + `formatText` and a regex to remove `wm:` tokens.

## Change surface (exact touchpoints)

### Grammar

- `packages/grammar/src/properties.ts` (parse `[[...]]` tokens; distinguish references vs terminal id candidate)
- `packages/grammar/src/parser.ts` / `packages/grammar/src/builder.ts` (record id + references placement logic)
- `packages/grammar/src/types.ts` (add `id`/`references` fields or adjust record shape)
- `packages/grammar/src/constants.ts` (ID regex/token helpers)
- Tests: `packages/grammar/src/parser.test.ts`, `packages/grammar/src/constants.test.ts`
- `packages/grammar/README.md` examples

### Core

- `packages/core/src/ids.ts` (normalize/generate new ID format; length scaling thresholds; update hash guidance)
- `packages/core/src/id-index.ts` (store alias metadata if needed; normalize keys)
- `packages/core/src/insert.ts` (emit `[[hash|alias]]` or `[[hash]]` at end of record)
- `packages/core/src/edit.ts` (extract id from terminal `[[...]]`, preserve on edit; handle alias-only draft case)
- `packages/core/src/remove.ts` (lookup by `[[...]]` or alias; update extraction logic)
- `packages/core/src/cache/serialization.ts` + `packages/core/src/cache/schema.ts` (record shape if ID stored)
- Tests: `packages/core/src/edit.test.ts`, `packages/core/src/insert.test.ts`, `packages/core/src/remove.test.ts`

### CLI

- `packages/cli/src/index.ts` (ID pattern regex + help/examples)
- `packages/cli/src/commands/add.ts`, `packages/cli/src/commands/edit.ts`, `packages/cli/src/commands/remove.ts` (ID parsing/normalization)
- `packages/cli/src/commands/help/registry.ts` (ID placeholders + examples)
- Prompt/help docs: `packages/cli/src/commands/add.prompt.txt`, `packages/cli/src/commands/edit.prompt.txt`, `packages/cli/src/commands/remove.prompt.txt`
- Tests: `packages/cli/src/commands/add.test.ts`, `packages/cli/src/commands/remove.test.ts`, `packages/cli/src/commands/modify.test.ts` (if still present)

### Schemas

- `schemas/waymark-record.schema.json` (record shape, id/ref fields)
- `schemas/waymark-scan-result.schema.json` (examples if present)

### Docs/examples (rg ':::' hits)

- `docs/cli/waymark_editing.md` (ID algorithm + lifecycle; currently out of date)
- `docs/GRAMMAR.md`
- `docs/waymark/SPEC.md`
- `docs/howto/README.md`
- `docs/cli/commands.md`
- `docs/cli/README.md`
- `README.md`
- `CLI_READOUT.md`
- `.waymark/rules/WAYMARKS.md` / `.waymark/rules/CONVENTIONS.md`

## Notes

- CLI should accept either `[[hash]]` or bare `hash` on input, but output canonical `[[hash|alias]]` when alias is known.
- Decide whether to expose `id` and `aliases` explicitly on `WaymarkRecord` (affects cache + schema).
