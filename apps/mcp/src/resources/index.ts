// tldr ::: resource registry for waymark MCP server

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handleMapResource, mapResourceDefinition } from "./map";
import { handleTodosResource, todosResourceDefinition } from "./todos";

export function registerResources(server: McpServer): void {
  server.registerResource(
    "waymark-map",
    mapResourceDefinition.uri,
    mapResourceDefinition,
    handleMapResource
  );

  server.registerResource(
    "waymark-todos",
    todosResourceDefinition.uri,
    todosResourceDefinition,
    handleTodosResource
  );
}
