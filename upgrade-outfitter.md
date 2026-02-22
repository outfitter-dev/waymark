# Outfitter Stack Upgrade

All `@outfitter/*` packages pinned at `0.1.0`. No breaking changes — purely additive upgrades. Waymark is the cleanest consumer: strict Result types throughout, no anti-patterns.

## Current vs Latest

| Package | Current | Latest | Used In |
|---------|---------|--------|---------|
| `@outfitter/contracts` | 0.1.0 | 0.2.0 | core, cli, mcp |
| `@outfitter/config` | 0.1.0 | 0.3.0 | core |
| `@outfitter/logging` | 0.1.0 | 0.3.0 | cli, mcp |
| `@outfitter/cli` | 0.1.0 | 0.3.0 | cli |
| `@outfitter/mcp` | 0.1.0 | 0.3.0 | mcp app |

## High-Value Opportunities

### 1. MCP resources and tool annotations (mcp 0.1.0 -> 0.3.0)

The MCP server currently has a single `waymark` tool. With 0.3.0:

- **Resources** — expose waymark scan results or graph data as MCP resources
- **Tool annotations** — declare `scan`/`graph` actions as read-only, `add` as destructive
- **Progress reporting** — large vault scans can report incremental progress
- **Log forwarding** — structured log visibility for MCP clients

### 2. CLI output modes and environment profiles (cli 0.1.0 -> 0.3.0)

- `--json` global flag on all commands via `createCLI()`
- `OUTFITTER_ENV` unified profiles for dev/prod/test defaults
- `resolveVerbose()` utility — replace manual --verbose/--quiet/--debug flag handling

### 3. Error factory methods and expect() (contracts 0.1.0 -> 0.2.0)

- `static create()` factories simplify error construction
- `AmbiguousError` from contracts may match waymark's disambiguation needs
- `expect()` for unwrapping Results at boundaries

### 4. Unified log level resolution (logging 0.1.0 -> 0.3.0)

- `resolveLogLevel()` with precedence (`OUTFITTER_LOG_LEVEL` > explicit > env profile > default)
- Replace manual level wiring in `packages/cli/src/utils/logger.ts`

### 5. JSONC and environment profiles (config 0.1.0 -> 0.3.0)

- JSONC support for config files (JSON with comments)
- `getEnvironment()` and `getEnvironmentDefaults()` for unified profiles

## Anti-Patterns

None found. Waymark has strict Result-based error handling, no thrown exceptions in production code, no console.log, and no hardcoded paths.

## Getting Started

Run `/outfitter-update` to detect installed versions, surface migration guidance, and apply upgrades.
