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
- Extract dependency graphs
- Insert waymarks with proper formatting
- Access repository-wide waymark data

## MCP Interface

### Tools

- `waymark` - Single tool for scan/graph/add/help actions (set `action` and pass the corresponding inputs). `scan` and `graph` default to the current directory when `paths` is omitted.

### Resources

- `waymark://todos` - Filtered list of all TODO waymarks

Drafting TLDR/TODO guidance now lives in agent skills; MCP prompts were removed.

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
  name: 'waymark',
  arguments: {
    action: 'scan',
    format: 'json'
  }
});

// Drafting guidance lives in agent skills (no MCP prompts).
```

## Documentation

See the [main README](../../README.md) for comprehensive documentation and [MCP documentation](https://modelcontextprotocol.io) for protocol details.

## Status

This package is experimental and under active development. The API may change between versions. Use with caution in production environments.

## License

MIT
