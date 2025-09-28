<!-- tldr ::: writing high-signal tldr waymarks for files and docs -->

# TLDR Waymarks

Use TLDR waymarks to give humans and agents the fastest possible understanding of a file or document. They act as the anchor for everything else in a module. Follow these rules every time you create or edit a `tldr :::` line.

## TLDR Essentials

- **Location**: Place the TLDR as the first waymark in the file, after any shebang/front matter and before code or exports.
- **Uniqueness**: Exactly one TLDR per file. If a file currently lacks one, add it. If there are multiple, consolidate them into a single sentence.
- **Format**: `[comment leader] tldr ::: <sentence> [#tags]` — remember the surrounding spaces around `:::`.

## Sentence Guidelines

1. **One sentence**, 8–14 words. Aim for clarity, not brevity at all costs.
2. **Active voice**, leading with the capability delivered by the file.
3. **Concrete nouns and verbs**; avoid filler like “module”, “utilities”, or “handles logic”.
4. **End with key technology, constraints, or namespaces** so people can grep for them.
5. **Avoid pronouns and vague adjectives** (e.g., “it”, “important”, “stuff”).

Examples:

- `// tldr ::: Stripe webhook handler verifying signatures and queuing retries #payments`
- `// tldr ::: React hooks exposing BetterAuth session state #auth/frontend`
- `<!-- tldr ::: Bun-based CLI PRD defining v1.0 scope and requirements ref:#docs/prd -->`

## Tagging & Anchors

- Hashtags are optional, but if you add them you **must stay consistent** with existing usage. Run `rg ":::\s.*#<tag-fragment>" -g '*.{ts,tsx,md}'` (or similar) so you only match real waymarks before inventing a new namespace.
- Prefer namespaces (`#docs/prd`, `#auth/service`, `#perf:hotpath`) so that future searches remain precise. Avoid one-off tags that do not align with repo conventions.
- Documentation TLDRs **must** include a `#docs` tag (with optional namespace) so doc-only filters can find them quickly.
- When the TLDR declares the canonical anchor for the file, append `ref:#token` near the end. Use the same token shape that other files already reference.
  - `// tldr ::: payment gateway service ref:#payments/service #payments`
  - Search for existing anchors with `rg ":::\s.*ref:#payments"` to verify naming before creating a new one.

### Priority TLDRs

- Prefixing with `!` (`!tldr ::: ...`) tells the tooling to surface that summary first in generated maps, dashboards, and agent prompts.
- Reserve `!tldr` for truly critical files or documents—entry points, compliance-sensitive modules, runbooks that must be read before others.
- Use `rg ":::\s*!tldr"` occasionally to audit that only the most important files carry the priority signal.

## Common Patterns

| File Type       | Pattern                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| Service / class | `// tldr ::: <service> <verb> <domain> #area`                             |
| Entry point     | `// !tldr ::: main entry wiring <framework> + <middleware> #arch/...`     |
| Utility library | `// tldr ::: utilities for <concept> using <tech> #lib/...`               |
| Tests           | `// tldr ::: integration tests for <feature> covering <edge cases> #test` |
| Docs/PRDs       | `<!-- tldr ::: <doc> summary focusing on <scope> #docs/<type> -->`        |

## Workflow Tips

- When a file’s purpose changes, **update the TLDR first**, then adjust subordinate `this :::` markers.
- If the TLDR feels hard to write, it’s a signal the file might need refactoring or clearer responsibility.
- Use `waymark map` to audit TLDR coverage and alignment after large moves (refactors, renames, new packages).

## Review Checklist

Before committing a TLDR:

- ✅ Sentence in active voice with clear subject and verb.
- ✅ If a tag is used, it matches existing conventions (checked via `rg`).
- ✅ Adds `ref:#token` when this TLDR should be the canonical anchor.
- ✅ Matches the file’s current responsibility.
- ✅ Positioned as the first waymark in the file.
- ✅ Passes `rg "tldr :::"` sanity check (no duplicates, no stale wording).

Great TLDRs make agents faster and humans happier. Treat them as the single most valuable breadcrumb in every file.
