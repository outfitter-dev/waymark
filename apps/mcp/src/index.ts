#!/usr/bin/env bun
// tldr ::: stdio MCP server bridging waymark CLI capabilities

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "@outfitter/mcp";
import { registerResources } from "./resources";
import { registerTools } from "./tools";
import type { ToolContent } from "./types";
import { logger } from "./utils/logger";

const VERSION = process.env.npm_package_version ?? "1.0.0-beta.1";

async function main(): Promise<void> {
  const mcpServer = createMcpServer({
    name: "waymark-mcp",
    version: VERSION,
    logger,
  });

  // Create SDK server with both tools and resources capabilities
  const sdkServer = new Server(
    { name: mcpServer.name, version: mcpServer.version },
    { capabilities: { tools: {}, resources: {} } }
  );

  // Wire tool list and invocation through the outfitter server
  sdkServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: mcpServer.getTools(),
  }));

  sdkServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await mcpServer.invokeTool(
      name,
      (args ?? {}) as Record<string, unknown>
    );

    if (result.isErr()) {
      return {
        content: [{ type: "text" as const, text: result.error.message }],
        isError: true,
      };
    }

    return result.value as ToolContent;
  });

  // Register tools on the outfitter server, passing resource change notification
  registerTools(mcpServer, () => {
    sdkServer.sendResourceListChanged().catch(() => {
      // Notification failure is non-fatal
    });
  });

  // Register resources directly on the SDK server
  registerResources(sdkServer);

  const transport = new StdioServerTransport();
  await sdkServer.connect(transport);
}

main().catch((error) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  logger.fatal(message, { error });
  process.exit(1);
});

// Re-export for tests
// biome-ignore lint/performance/noBarrelFile: Intentional exports for testing
export { handleAddWaymark } from "./tools/add";
export type { SignalFlags } from "./types";
export { truncateSource } from "./utils/config";
