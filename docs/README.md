<!-- tldr ::: documentation index clarifying grammar vs tooling responsibilities -->

# Waymark Documentation

Waymark’s documentation is intentionally split between **grammar** materials—the vendor-neutral contract—and **tooling** guides that describe our opinionated CLI, workflows, and integrations. Use this page to jump to the part that matches your needs.

## Grammar (Stable Contract)

The grammar defines the `:::` syntax, record structure, and parsing guarantees. It is designed so other tools can adopt it without inheriting Waymark CLI conventions.

- [Grammar Overview](./grammar/README.md) — architecture, guarantees, and extension policy
- [Waymark Specification (v1)](./waymark/SPEC.md) — maintained in lockstep with `PRD.md`
- [Historical priors](./about/priors.md) — how other ecosystems influenced the grammar

These resources map to the `@waymarks/core` and `@waymarks/grammar` packages. Changes here require PRD updates and version notes.

## Tooling (Opinionated CLI & Workflows)

The tooling layer includes the Waymark CLI, interactive prompts, configuration presets, and automation hooks.

- `packages/cli` — Bun-based CLI workspace (see `README.md` within the package)
- [CLI Readout](../CLI_READOUT.md) — deep dive on command UX
- [INSERT_REMOVE_COMMAND.md](../INSERT_REMOVE_COMMAND.md) — implementation notes for insert/remove flows
- [AGENTS.md](../AGENTS.md) & [PLAN.md](../PLAN.md) — coordination guidelines for agents working on tooling

These docs assume the grammar contract but add defaults (e.g., ID management, output formatting, CI expectations). Consumers embedding the grammar without the CLI can safely ignore this layer.

## Release Notes

- [Waymark Changelog](../CHANGELOG.md) — latest prerelease updates (currently targeting **1.0.0-beta.1**).

## Picking the Right Layer

| I want to… | Start here |
| --- | --- |
| Embed waymarks in a custom tool or IDE | Grammar overview + SPEC |
| Build automation around existing repositories using the CLI | Tooling docs |
| Understand historical decisions | `docs/about` |
| Contribute new features | Tooling docs for workflows, then SPEC for any grammar changes |

## Contributing to Docs

- Every doc includes a `<!-- tldr ::: ... -->` waymark at the top for quick grep-based discovery.
- Grammar docs reference PRD updates; tooling docs should link to relevant CLI packages or scripts.
- Keep the grammar/tooling distinction explicit whenever introducing new guides.
