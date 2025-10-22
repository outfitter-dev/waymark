// tldr ::: tool registry for waymark MCP server

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { addToolDefinition, handleAdd } from "./add";
import { graphToolDefinition, handleGraph } from "./graph";
import { handleMap, mapToolDefinition } from "./map";
import { handleScan, scanToolDefinition } from "./scan";

export function registerTools(server: McpServer): void {
  server.registerTool("waymark.scan", scanToolDefinition, handleScan);
  server.registerTool("waymark.map", mapToolDefinition, handleMap);
  server.registerTool("waymark.graph", graphToolDefinition, handleGraph);
  server.registerTool("waymark.add", addToolDefinition, (input: unknown) =>
    handleAdd(input, server)
  );
  // Deprecated alias for backward compatibility
  server.registerTool("waymark.insert", addToolDefinition, (input: unknown) =>
    handleAdd(input, server)
  );
}
