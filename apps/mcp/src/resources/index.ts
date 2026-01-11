// tldr ::: resource registry for waymark MCP server

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handleTodosResource, todosResourceDefinition } from "./todos";

/**
 * Register MCP resources on the provided server.
 * @param server - MCP server instance.
 */
export function registerResources(server: McpServer): void {
  server.registerResource(
    "waymark-todos",
    todosResourceDefinition.uri,
    todosResourceDefinition,
    handleTodosResource
  );
}
