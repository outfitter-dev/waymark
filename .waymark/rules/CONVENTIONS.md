<!-- tldr ::: repo-specific waymark conventions to keep annotations consistent #docs/rules -->

# Project Waymark Conventions

## Instructions

- Follow the instructions in the @./.agents/rules/waymarks/WAYMARKS.md file and the TLDR-specific rules in @./.agents/rules/waymarks/tldrs.md.
- Keep this document current—if you introduce a new convention (tag namespace, canonical token pattern, etc.) add it here **before** merging.
- Reference @PRD.md for the canonical grammar and @PLAN.md for any in-flight decisions that might alter conventions.

## General Rules

- ALWAYS include only one `tldr :::` waymark in each file, near the top (accounting for language-specific preambles, shebangs, front matter, etc.).
- ONLY use the v1 signals: `^` (raised/in-progress) and a single `*` (important/high priority). No `!`, `!!`, `?`, or other legacy signals anywhere in the repo.
- CLEAR all `^` waymarks before merging to protected branches (`rg '\\^\\w+\\s*:::'`).
- When adding a new waymark, search for precedent first (e.g., `rg ":::\s.*#<fragment>"`) to avoid proliferating one-off patterns.

## Project Hashtags

We maintain a preferred list of hashtags below. Tags are optional; when you do add them, align with an existing namespace (verify with `rg ":::\s.*#<fragment>"`).

### Preferred Tags

- `#docs`: For documentation-only content.
  - `#docs/guide/*`: For user-facing guides.
  - `#docs/rules/*`: For agent rules, policies, and conventions.
- `#sec`: For security-related content.
  - `#sec/boundary`: For security boundaries.
  - `#sec/policy`: For security policies.
- `#perf`: For performance-related content.
  - `#perf/hotpath`: For performance hotspots.
  - `#perf/benchmark`: For performance benchmarks.
- `#arch`: For architectural content.
  - `#arch/entrypoint`: For entrypoints.
  - `#arch/state`: For state management overviews.
- `#lib`: For library-related content.
  - `#lib/utils`: For utility functions.
  - `#lib/types`: For type definitions.
- `#test`: For test-related content.
  - `#test/unit`: For unit tests.
  - `#test/integration`: For integration tests.
- `#e2e`: For end-to-end tests.
  - `#e2e/api`: For API tests.

## Canonical References

- ALWAYS consider if a canonical reference is needed for the file.
- ALWAYS ensure there is only one canonical reference per repository. No duplicate strings allowed (check with `rg ":::\s.*ref:#<token>"`).
- For documentation TLDRs, use the `ref:#docs/...` pattern (e.g., `ref:#docs/adr/0001`).
- For code files, prefer namespaced tokens that match the directory structure (`ref:#payments/stripe-webhook`, `ref:#auth/service`).
- Whenever you mint a new canonical token, log it in the Decisions section of @PLAN.md if it’s a major anchor.

## Specific Marker Use

### `tldr :::` Waymarks

- One sentence (8–14 words) in active voice capturing the file’s capability. Follow `.agents/rules/waymarks/tldrs.md`.
- Include `#docs/...` on documentation TLDRs; otherwise prefer tags from the list above.
- Add `ref:#token` when the TLDR declares the canonical anchor for the file.
- Use `*tldr` only for files/documents that must be read first; audit periodically with `rg '\\*tldr\\s*:::'`.

### `this :::` Waymarks

- Place before major sections/classes to describe local responsibility.
- Keep the sentence short and aligned with the current implementation; update whenever behavior changes.
- Use the same tag namespaces as the TLDR when relevant so searches group related content.

### `todo :::` Waymarks

- Annotate known follow-up work liberally so humans and agents can spot outstanding tasks without reading full sections.
- Phrase the description as an action with enough context that someone else could pick it up; include tags and mentions when ownership matters.
- Sweep the codebase regularly with `rg 'todo\s*:::'` (optionally `rg -n 'todo\s*:::'`) to review the current backlog before shipping or planning.
- Remove `todo :::` entries as soon as the work lands—either delete the waymark or replace it with `done :::` as a short-lived handoff signal, and make sure raised (`^`) waymarks are cleared before merging to `main`.
