// tldr ::: tool registry for waymark MCP server

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { graphToolDefinition, handleGraph } from "./graph";
import { handleInsert, insertToolDefinition } from "./insert";
import { handleMap, mapToolDefinition } from "./map";
import { handleScan, scanToolDefinition } from "./scan";

export function registerTools(server: McpServer): void {
  server.registerTool("waymark.scan", scanToolDefinition, handleScan);
  server.registerTool("waymark.map", mapToolDefinition, handleMap);
  server.registerTool("waymark.graph", graphToolDefinition, handleGraph);
  server.registerTool(
    "waymark.insert",
    insertToolDefinition,
    (input: unknown) => handleInsert(input, server)
  );
}
