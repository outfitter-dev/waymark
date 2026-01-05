#!/usr/bin/env bun
// tldr ::: stdio MCP server bridging waymark CLI capabilities

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerResources } from "./resources";
import { registerTools } from "./tools";

const VERSION = process.env.npm_package_version ?? "1.0.0-beta.1";

async function main(): Promise<void> {
  const server = new McpServer({ name: "waymark-mcp", version: VERSION });

  registerTools(server);
  registerResources(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});

// Re-export for tests
// biome-ignore lint/performance/noBarrelFile: Intentional exports for testing
export { handleAddWaymark } from "./tools/add";
export type { SignalFlags } from "./types";
export { truncateSource } from "./utils/config";
