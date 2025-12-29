// tldr ::: resource registry for waymark MCP server

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handleTodosResource, todosResourceDefinition } from "./todos";

export function registerResources(server: McpServer): void {
  server.registerResource(
    "waymark-todos",
    todosResourceDefinition.uri,
    todosResourceDefinition,
    handleTodosResource
  );
}
