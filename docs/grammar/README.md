<!-- tldr ::: neutral overview of the Waymark grammar contract and its relationship to tooling -->

# Waymark Grammar

The Waymark grammar is the stable contract shared across every Waymark-compatible tool. It defines:

- the `:::` sigil and comment syntax
- record structure (type, properties, tags, mentions, signals)
- ID semantics and normalization rules
- canonical parsing behavior exposed by `@waymarks/grammar` and re-exported through `@waymarks/core`

## Goals

1. **Tooling-agnostic** – Consumers should be able to parse and emit waymarks without adopting our CLI.
2. **Spec-first** – All grammar updates originate from `PRD.md` and propagate to [`docs/waymark/SPEC.md`](../waymark/SPEC.md).
3. **Embedded-friendly** – The contract is safe to embed in editors, linters, or custom automation without depending on Bun or the CLI.

## Relationship to Tooling

| Layer | Purpose | Packages |
| --- | --- | --- |
| Grammar (this README) | Defines syntax, schema, parsing, and normalization. | `@waymarks/grammar`, `@waymarks/core` (grammar exports only) |
| Tooling | Adds CLI commands, prompts, config presets, ID workflows, and CI integration. | `@waymarks/cli`, repo scripts |

The CLI consumes the grammar but may introduce opinionated defaults (ID allocation, formatting, interactive flows). Treat the grammar layer as load-bearing API surface; tooling can evolve independently as long as it honours this contract.

## Where to Start

- [`docs/waymark/SPEC.md`](../waymark/SPEC.md) — canonical specification kept in lockstep with `PRD.md`.
- `packages/core/src` — grammar-aware utilities (parsing, ID management, indexing).
- `packages/grammar` — raw parser and AST types exported for third-party use.

## Versioning & Compatibility

- Grammar changes require updates to `PRD.md`, `docs/waymark/SPEC.md`, and release notes.
- Follow semantic versioning for published packages; breaking grammar changes imply a major release.
- Tooling can ship iteratively provided it remains backwards compatible with the grammar version it targets.

## Contributing

1. Discuss grammar changes via PRD updates and the Decisions Log (`PLAN.md`).
2. Update the spec and grammar tests before touching CLI behavior.
3. Keep grammar docs free from CLI-specific assumptions—link to tooling docs instead.
