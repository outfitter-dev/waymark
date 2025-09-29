<!-- tldr ::: generated map of repo waymarks #docs/rules -->
# Waymark Map

Generated on 2025-09-30T02:36:52.712Z.

## TLDR Waymarks

- AGENTS.md:1 — <!-- tldr ::: agents configuration and development guidelines -->
- apps/mcp/src/index.test.ts:1 — // tldr ::: tests for MCP waymark insertion utilities
- apps/mcp/src/index.ts:2 — // tldr ::: stdio MCP server bridging waymark CLI capabilities
- docs/about/priors.md:1 — <!-- tldr ::: Historical precedents and inspiration for waymark anchor patterns -->
- docs/waymark/SPEC.md:1 — <!-- tldr ::: canonical specification for the Waymark v1 grammar -->
- docs/waymark/tui-ab-plan.md:1 — <!-- tldr ::: comparative plan for opentui vs React Ink waymark TUIs #docs/plan -->
- packages/agents/src/index.ts:1 — // tldr ::: waymark agent toolkit exports
- packages/cli/src/commands/find.ts:1 — // tldr ::: find command helpers for waymark CLI
- packages/cli/src/commands/fmt.ts:1 — // tldr ::: format command helpers for waymark CLI
- packages/cli/src/commands/graph.ts:1 — // tldr ::: graph command helpers for waymark CLI
- packages/cli/src/commands/help.ts:1 — // tldr ::: help command helper for waymark CLI
- packages/cli/src/commands/lint.ts:1 — // tldr ::: lint command helpers for waymark CLI
- packages/cli/src/commands/map.ts:1 — // tldr ::: map command helpers for waymark CLI
- packages/cli/src/commands/migrate.ts:1 — // tldr ::: migrate command helpers for waymark CLI
- packages/cli/src/commands/scan.ts:1 — // tldr ::: scan command helpers for waymark CLI
- packages/cli/src/commands/tui.ts:1 — // tldr ::: placeholder tui command handler
- packages/cli/src/index.test.ts:1 — // tldr ::: smoke and snapshot tests for waymark CLI handlers
- packages/cli/src/index.ts:2 — // tldr ::: waymark CLI entry point wiring formatter, lint, map, and utility commands
- packages/cli/src/types.ts:1 — // tldr ::: shared CLI types
- packages/cli/src/utils/flags/iterator.ts:1 — // tldr ::: shared iterator utilities for CLI flag parsing
- packages/cli/src/utils/flags/json.ts:1 — // tldr ::: helper to handle --json flag parsing
- packages/cli/src/utils/flags/marker.ts:1 — // tldr ::: helper for --marker flag parsing
- packages/cli/src/utils/flags/mention.ts:1 — // tldr ::: helper for --mention flag parsing
- packages/cli/src/utils/flags/string-list.ts:1 — // tldr ::: helpers for list-style flags with string values
- packages/cli/src/utils/flags/summary.ts:1 — // tldr ::: helper to handle --summary flag parsing
- packages/cli/src/utils/flags/tag.ts:1 — // tldr ::: helper for --tag flag parsing
- packages/cli/src/utils/fs.ts:1 — // tldr ::: filesystem helpers for expanding waymark CLI inputs
- packages/cli/src/utils/output.ts:1 — // tldr ::: rendering helpers for CLI record output
- packages/core/src/cache/index.test.ts:1 — // tldr ::: tests for waymark cache invalidation and metadata tracking
- packages/core/src/cache/index.ts:1 — // tldr ::: SQLite cache for waymark records and dependency graphs
- packages/core/src/config.test.ts:1 — // tldr ::: tests for config loading and scope resolution
- packages/core/src/config.ts:1 — // tldr ::: default waymark configuration helpers, disk loading, and normalization utilities
- packages/core/src/format.test.ts:1 — // tldr ::: tests for waymark formatting utilities
- packages/core/src/format.ts:1 — // tldr ::: formatting utilities for normalizing waymark comments
- packages/core/src/graph.test.ts:1 — // tldr ::: tests for waymark relation graph builder
- packages/core/src/graph.ts:1 — // tldr ::: relation graph helpers for waymark dependency analysis
- packages/core/src/index.test.ts:1 — // tldr ::: tests for core waymark parser
- packages/core/src/index.ts:1 — // tldr ::: core waymark utilities with caching and scanning
- packages/core/src/map.test.ts:1 — // tldr ::: tests for waymark map aggregation helpers
- packages/core/src/map.ts:1 — // tldr ::: helpers for aggregating waymarks into file and marker summaries
- packages/core/src/normalize.test.ts:1 — // tldr ::: tests for waymark record normalization functions
- packages/core/src/normalize.ts:1 — // tldr ::: normalization helpers for waymark records and related fields
- packages/core/src/search.test.ts:1 — // tldr ::: tests for waymark search helpers
- packages/core/src/search.ts:1 — // tldr ::: utility helpers for filtering waymark records
- packages/core/src/types.ts:1 — // tldr ::: configuration and scanning types for waymark core
- packages/grammar/src/constants.ts:1 — // tldr ::: waymark grammar constants and blessed markers
- packages/grammar/src/index.ts:1 — // tldr ::: waymark grammar parser exports
- packages/grammar/src/parser.test.ts:1 — // tldr ::: unit tests for waymark grammar parser behaviors
- packages/grammar/src/parser.ts:1 — // tldr ::: core parser for waymark grammar syntax
- packages/grammar/src/types.ts:1 — // tldr ::: core type definitions for waymark grammar
- PLAN.md:1 — <!-- tldr ::: execution roadmap and decision log for the Waymark v1 rebuild -->
- README.md:1 — <!-- tldr ::: Overview of the Waymark project and key resources -->
- README.md:18 — // tldr ::: managing customer authentication flow
- SCRATCHPAD.md:1 — <!-- tldr ::: running log of agent activities and discoveries #docs/rules -->
- scripts/waymark-audit.ts:2 — // tldr ::: developer helper to run common ripgrep audits for waymarks #scripts/audit
- scripts/waymark-map.ts:3 — // tldr ::: generate markdown map of all waymarks by type using Bun concurrency #scripts/waymarks
- test/setup.ts:1 — // tldr ::: global test setup for Bun test runner

## TODO Waymarks

- docs/waymark/SPEC.md:26 — // todo ::: rewrite parser for streaming
- docs/waymark/SPEC.md:180 — // todo ::: @agent add idempotency key handling fixes:#payments/stripe-webhook
- docs/waymark/tui-ab-plan.md:86 — <!-- todo ::: summarize findings and mark chosen TUI path once evaluation wraps -->
- packages/agents/src/index.ts:8 — // todo ::: implement agent toolkit
- packages/grammar/src/parser.ts:8 — // todo ::: @codex externalize comment leader detection into shared language metadata #lib/parser
- packages/grammar/src/parser.ts:511 — // todo ::: @codex allow configurable overrides for file category inference #lib/parser
- test/setup.ts:6 — // todo ::: add global test setup when needed
- test/setup.ts:10 — // todo ::: add global test cleanup when needed

## THIS Waymarks

- docs/waymark/SPEC.md:179 — // this ::: Stripe webhook verification handler #perf:hotpath
- docs/waymark/SPEC.md:189 — <!-- this ::: workflow overview for installing the CLI -->
- docs/waymark/SPEC.md:195 — # this ::: orchestrates outbound email delivery #comm/email

## Other Waymarks

- docs/waymark/SPEC.md:27 — // ::: preserve backwards-compatible signature
- docs/waymark/SPEC.md:28 — // ::: coordinate rollout with @devops
- docs/waymark/SPEC.md:181 — // review ::: @alice confirm retry strategy #sec:boundary
- docs/waymark/SPEC.md:182 — // note ::: logs PII-hardened metadata only #docs/logging
- docs/waymark/tui-ab-plan.md:111 — <!-- note ::: revisit this doc after A/B cycle to archive losing approach and formalize follow-ups -->

### Other Marker Counts

- note: 2
- review: 1

## Ignored

```jsonc
{
  "keepMarkers": [
    "tldr"
  ],
  "ignore": [
    ".waymark/rules*.md",
    "AGENTS.md",
    "PLAN.md",
    "PRD.md",
    "README.md",
    "SCRATCHPAD.md"
  ]
}
```
