// tldr ::: single MCP tool handler for waymark actions

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { waymarkToolInputSchema, waymarkToolInputShape } from "../types";
import { handleAdd } from "./add";
import { handleGraph } from "./graph";
import { handleScan } from "./scan";

export function handleWaymarkTool(
  input: unknown,
  server: Pick<McpServer, "sendResourceListChanged">
): Promise<CallToolResult> {
  const parsed = waymarkToolInputSchema.parse(input);

  switch (parsed.action) {
    case "scan":
      return handleScan(parsed);
    case "graph":
      return handleGraph(parsed);
    case "add":
      return handleAdd(parsed, server);
    default: {
      const action = (parsed as { action: string }).action;
      return Promise.reject(new Error(`Unsupported waymark action: ${action}`));
    }
  }
}

export const waymarkToolDefinition = {
  title: "Waymark",
  description:
    "Single tool for waymark actions. Use action=scan, graph, or add.",
  inputSchema: waymarkToolInputShape,
} as const;
