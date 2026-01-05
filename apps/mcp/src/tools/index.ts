// tldr ::: tool registry for waymark MCP server

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handleWaymarkTool, waymarkToolDefinition } from "./waymark";

export function registerTools(server: McpServer): void {
  server.registerTool("waymark", waymarkToolDefinition, (input: unknown) =>
    handleWaymarkTool(input, server)
  );
}
