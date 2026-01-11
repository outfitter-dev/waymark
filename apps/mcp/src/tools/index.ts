// tldr ::: tool registry for waymark MCP server

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handleWaymarkTool, waymarkToolDefinition } from "./waymark";

/**
 * Register MCP tools on the provided server.
 * @param server - MCP server instance.
 */
export function registerTools(server: McpServer): void {
  server.registerTool("waymark", waymarkToolDefinition, (input: unknown) =>
    handleWaymarkTool(input, server)
  );
}
