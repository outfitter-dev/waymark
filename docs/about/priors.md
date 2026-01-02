<!-- tldr ::: Historical precedents and inspiration for waymark anchor patterns -->
# Historical Priors for Waymark-Style Anchors

Waymarks did not appear out of thin air. The `:::` sigil and marker vocabulary consolidate decades of proven comment-level anchor patterns, then adapt them for AI-native tooling. This document captures the shoulder we stand on so that the modern spec keeps its ties to real-world practice.

---

## 1. Why capture priors?

Open-source teams routinely evolve conventions that work well before they become standards. By cataloguing earlier approaches, we make it obvious why waymarks feel familiar even when the syntax is new. These priors also give contributors a shared reference when debating syntax trade-offs.

---

## 2. Ancestor patterns

| Era / ecosystem         | Anchor syntax (typical)                        | Purpose                                   | What we carry forward                                     |
| ----------------------- | ---------------------------------------------- | ----------------------------------------- | --------------------------------------------------------- |
| **UNIX 1980s**          | `# TODO:`                                      | Human breadcrumb for future work          | Plain-text greppability (e.g. `grep TODO`)                |
| **C family**            | `// FIXME`, `// XXX`, `// HACK`                | Flag questionable code or bugs            | Single-token severity markers                             |
| **Google / Chromium**   | `// TODO(user):`                               | Ownership metadata in the tag itself      | Named actors (`@alice`) baked into the marker             |
| **Xcode / Swift**       | `// MARK:`                                     | Editor jump bar & fold markers            | IDE integration via predictable prefixes                  |
| **Go (1.17+)**          | `//go:build <expr>`                            | Build constraint parsed pre-AST           | Comment-only directives honoring strict grammar           |
| **Clang-Tidy**          | `// NOLINT(rule)`                              | Linter suppression                        | Machine-auditable anchors that impact CI                  |
| **ESLint / Flake8**     | `// eslint-disable-next-line` / `# noqa: E501` | Scoped rule ignores                       | Policy hooks that prevent rot through automation          |
| **VS Code 2010s**       | `// region … endregion`                        | Code folding and outline surfacing        | Multi-line anchors that editors can parse                 |
| **Shopify smart_todo**  | `TODO(sc-12345)`                               | Track work items by ID                    | Structured identifiers validated by custom tooling        |

---

## 3. Lessons extracted

1. **Fixed prefixes beat prose.** Conventions that start with an uncommon token survive longer than free-form notes.
2. **Tooling chases stable patterns.** Build systems, IDEs, and linters happily parse comments when the surface is predictable.
3. **Rot prevention needs automation.** Successful anchors tie into CI or static analysis so lingering markers trigger action.
4. **Minimal surface area wins.** The most resilient anchors fit anywhere a comment does—source, tests, docs, config.

These lessons justify Waymark v2.0’s single three-character sigil, slim marker set, and insistence on single-line defaults: everything is simple enough to grep yet structured enough for dedicated tooling.

---

## 4. What waymarks add

Waymarks merge the best parts of those priors and push them forward:

- Unify disparate anchors under one predictable `:::` separator
- Support structured properties, hashtags, and actors without losing greppability
- Treat AI and humans as equal consumers of code annotations
- Provide a curated marker namespace so teams speak the same shorthand
- Allow pure notes alongside actionable work without separate systems

---

## 5. Share your priors

Have you seen an anchor pattern we should learn from? Open a PR and drop a reference—keeping this catalogue alive helps the specification evolve with real-world practice.

---

> See also: [Waymark Specification v2.0](../GRAMMAR.md) for how these lessons shaped the current grammar.
