<!-- tldr ::: comprehensive Waymark repo audit findings, mismatches, and next-step questions for handoff -->

# Waymark Repo Audit (2025-12-29)

This note captures a comprehensive review of the Waymark repo across concept, code, CLI ergonomics, and docs. It’s written for handoff — assume the next agent has **no prior context**.

## Context + intent

- Waymark’s core idea: a **grep-first, comment-based grammar** using the `:::` sigil that’s easy for humans + agents to scan and parse.
- Goal from Matt: **get ready for a release**, and **clarify that Waymarks do NOT overlap docstrings/JSDoc/TSDoc**. Waymarks should be distinct and complementary.
- Current prerelease advertised: **v1.0.0-beta.1** (README + CHANGELOG).

High-level architecture (as of now):
- `packages/grammar` → parser/tokenizer, content/relations extraction
- `packages/core` → format, insert, remove, map, graph, config
- `packages/cli` → commander CLI (`wm`, `waymark`) + output formatting
- `apps/mcp` → MCP server

## Blockers / Must-fix mismatches (docs vs behavior)

These are release-blocking because they imply users will run documented commands that **don’t work** or will get incorrect outputs.

1) **Block comment support is documented but not implemented in the parser.**
   - Docs show `/* ... */` examples (README + `docs/GRAMMAR.md`).
   - Parser only recognizes comment leaders `<!--`, `//`, `--`, `#`.
   - Source:
     - `packages/grammar/src/tokenizer.ts:5-33` (comment leaders)
     - `README.md:19-30` (block comment example)
     - `docs/GRAMMAR.md:109-117` (table lists `/* */`)
   - Impact: those waymarks won’t scan, format, or lint — they’re not real in the grammar today.
   - Decision needed: **implement `/* */` parsing or remove docs examples**.

2) **`wm find --jsonl` is ignored (jsonl output doesn’t work).**
   - Unified parser only recognizes `--json`.
   - Output logic only checks `json`, not `jsonl`.
   - Source:
     - `packages/cli/src/utils/flags/json.ts` (only `--json`)
     - `packages/cli/src/commands/unified/index.ts:28-76` (no jsonl handling)
     - `README.md:83-86` (docs claim `--jsonl` works)
   - Impact: `--jsonl` silently produces normal text output.

3) **Lint docs claim WM001/WM041/etc, but lint only checks unknown markers.**
   - `wm lint` only flags invalid markers; it does NOT check duplicate props, dangling relations, multiple TLDRs, etc.
   - Docs list those rules and codes as real.
   - Source:
     - `packages/cli/src/commands/lint.ts:33-58` (unknown markers only)
     - `packages/cli/src/index.ts:1367-1385` (WM001/WM041/etc help)
     - `packages/cli/src/commands/lint.help.ts` (same claims)
   - Impact: docs promise behavior that doesn’t exist.

4) **`wm migrate` is much narrower than docs claim.**
   - Implementation only rewrites `// TODO/FIXME/NOTE` and ignores:
     - `#` comments (python/ruby/etc)
     - `/* */` block comments
     - `HACK`, `XXX`, `@deprecated`
     - `--include-legacy` flag (ignored)
   - Source:
     - `packages/cli/src/commands/migrate.ts:52-56` (only TODO/FIXME/NOTE)
     - `packages/cli/src/index.ts:1421-1437` (docs claim many patterns)
   - Impact: migration docs are misleading; migration tool doesn’t do what it says.

## Should-fix mismatches / ergonomics gaps

These are not immediate blockers but will frustrate users or create incorrect expectations.

- **`wm format` and `wm migrate` accept directories per docs but only read files.**
  - `wm format` uses `readFile` on whatever path is passed.
  - CLI help examples imply directories and glob usage.
  - Source:
    - `packages/cli/src/commands/fmt.ts:16-32`
    - `packages/cli/src/commands/migrate.ts:15-33`
    - `packages/cli/src/index.ts` (examples show `src/`, `src/**/*.ts`)

- **`wm map --prompt` is wired in help but missing in prompt registry.**
  - `handleMapCommand` supports `--prompt`, but `content-loader.ts` doesn’t register `map`.
  - Source:
    - `packages/cli/src/index.ts:1508-1564`
    - `packages/cli/src/utils/content-loader.ts:3-20`

- **Insert comment leader detection is incomplete.**
  - Insert chooses comment leader by file extension; SQL or CSS will default to `//`.
  - Parser supports SQL (`--`), docs claim CSS uses `/* */`.
  - Source:
    - `packages/core/src/insert.ts:360-384`
    - `docs/GRAMMAR.md:109-115`
  - Impact: `wm add` can write invalid comment leaders for non-JS files.

- **Protected branch signal policy exists in config, but only `doctor` checks it.**
  - `.waymark/config.toml` specifies `signals_on_protected` but lint/format don’t enforce it.
  - `doctor` warns only; policy doesn’t propagate.
  - Source:
    - `.waymark/config.toml:3-30`
    - `packages/cli/src/commands/doctor.ts:426-455`

- **Removal history claims may be inaccurate.**
  - Help claims “Removed waymarks tracked in .waymark/history.json”.
  - Code doesn’t obviously write to history in `packages/core/src/remove.ts`.
  - Source:
    - `packages/cli/src/index.ts:1323-1329`
    - `packages/core/src/remove.ts` (no obvious history writes)
  - Impact: possible documentation mismatch.

## Docstring separation (explicit user request)

This is a key product positioning issue. Right now the only clear guidance is **buried in** `.waymark/rules/DOCSTRING-COMPATIBILITY.md`.

- Current guidance (good but hidden):
  - Waymarks **must live outside docstrings**.
  - Docstring first, waymark second.
  - Waymark mirrors docstring intent as a searchable anchor.
  - Source: `.waymark/rules/DOCSTRING-COMPATIBILITY.md:3-12`

- Problem: this guidance is **not front-and-center** in the public docs.
  - `README.md` and `docs/GRAMMAR.md` don’t call it out clearly.
  - `README.md` even shows a block comment waymark example, which visually resembles doc-comments.

**Recommendation:**
- Add a short “Waymarks are NOT docstrings” section in `README.md` + `docs/GRAMMAR.md`.
- Explicitly say: “Do not place waymarks inside JSDoc/TSDoc/Python docstrings/Go doc comments. They are adjacent, not inside.”
- Decide whether to support `/* */` and if so, explicitly ban `/** */` in lint + docs.

## Architecture notes + product thoughts (for next steps)

These are opinions that may shape the v1 release:

- **Concept is strong and coherent.** The grammar and “grep-first + agent-friendly” focus is unique and clean.
- **Docs + tooling alignment is the biggest risk** before release. Core parser + CLI are modular, but docs are ahead of implementation.
- **Waymark’s “docstring compatibility” story needs a public-facing, high-visibility statement.** Otherwise it will appear like yet another doc-comment system.
- **CLI UX is close, but still inconsistent** (especially around JSON/JSONL, lint reporting, and migrate/format path handling).

## Files & locations referenced (quick index)

- `README.md` → examples + CLI usage
- `docs/GRAMMAR.md` → grammar spec and comment leader table
- `.waymark/rules/DOCSTRING-COMPATIBILITY.md` → docstring guidance
- `packages/grammar/src/tokenizer.ts` → comment leaders supported
- `packages/cli/src/commands/unified/index.ts` → unified output logic
- `packages/cli/src/utils/flags/json.ts` → only `--json` parsed
- `packages/cli/src/commands/lint.ts` → minimal lint implementation
- `packages/cli/src/commands/migrate.ts` → limited migrate rules
- `packages/core/src/insert.ts` → comment leader detection for `wm add`
- `packages/cli/src/index.ts` → help text + docs for CLI

## Open decisions (need owner input)

1) **Do we support block comments (`/* */`) in the grammar?**
   - If yes: implement parser support + lint rules to disallow `/**` doc-comment patterns.
   - If no: remove examples from docs + README.

2) **Should lint actually enforce WM001/WM041/etc, or should docs shrink to “marker validation only”?**

3) **Should migrate/format accept directories and globs?**
   - Either implement traversal via `expandInputPaths` or update docs to “single file only”.

4) **Should protected-branch signal policy be enforced by lint/format (strip/fail/allow)?**

## Suggested next steps (if we want to unblock release)

1) Align docs and CLI behavior first (jsonl, lint rules, migrate scope, block comments).
2) Add a prominent “Waymarks ≠ docstrings” section and examples showing adjacency.
3) Decide on block comment support and update parser accordingly.
4) Re-run `bun check:all` once fixes land.

## Testing note

No tests were run during this audit.
