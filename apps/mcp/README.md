# @waymarks/mcp

⚠️ **Experimental** - Model Context Protocol server for AI agents to interact with waymarks programmatically.

## Installation

```bash
bun add @waymarks/mcp
```

## Usage

Start the MCP server:

```bash
waymark-mcp
```

The server communicates over stdio and implements the Model Context Protocol, allowing AI agents to:

- Scan and parse waymarks from files
- Generate TLDR summaries
- Extract dependency graphs
- Insert waymarks with proper formatting
- Access repository-wide waymark data

## MCP Interface

### Tools

- `waymark.scan` - Parse files/directories and return waymark records (supports text, json, jsonl, pretty formats)
- `waymark.map` - Generate file tree with TLDR summaries
- `waymark.graph` - Extract dependency graph from relations
- `waymark.add` - Add formatted waymarks into files
- `waymark.insert` - (deprecated, use `waymark.add` instead)

### Resources

- `waymark://map` - Repository-wide summary of TLDRs and marker counts
- `waymark://todos` - Filtered list of all TODO waymarks

### Prompts

- `waymark.tldr` - Draft TLDR sentence for a file
- `waymark.todo` - Draft actionable TODO content

## Configuration

The MCP server respects the same configuration as the CLI:

- Project config: `.waymark/config.(toml|jsonc|yaml|yml)`
- User config: `~/.config/waymark/config.*`
- Environment: `WAYMARK_CONFIG_PATH`

Pass `configPath` and `scope` options to tools to override defaults.

## Example

```typescript
// Using the MCP SDK
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client({
  name: 'my-agent',
  version: '1.0.0'
});

// Scan waymarks
const result = await client.callTool({
  name: 'waymark.scan',
  arguments: {
    paths: ['src/'],
    format: 'json'
  }
});

// Generate TLDR
const tldr = await client.callPrompt({
  name: 'waymark.tldr',
  arguments: {
    filePath: 'src/auth.ts',
    snippet: '...'
  }
});
```

## Documentation

See the [main README](../../README.md) for comprehensive documentation and [MCP documentation](https://modelcontextprotocol.io) for protocol details.

## Status

This package is experimental and under active development. The API may change between versions. Use with caution in production environments.

## License

MIT
