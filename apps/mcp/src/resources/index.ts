// tldr ::: resource registry for waymark MCP server

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { handleTodosResource, todosResourceDefinition } from "./todos";

/**
 * Register MCP resources on the provided SDK server.
 * @param server - MCP SDK server instance (low-level).
 */
export function registerResources(server: Server): void {
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: todosResourceDefinition.uri,
        name: todosResourceDefinition.title,
        description: todosResourceDefinition.description,
        mimeType: todosResourceDefinition.mimeType,
      },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    if (uri === todosResourceDefinition.uri) {
      const result = await handleTodosResource();
      if (result.isErr()) {
        throw new Error(result.error.message);
      }
      return result.value;
    }
    // SDK boundary: unknown resource URIs are reported as protocol errors
    throw new Error(`Unknown resource: ${uri}`);
  });
}
