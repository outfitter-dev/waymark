// tldr ::: single MCP tool handler for waymark actions

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  WAYMARK_ACTIONS,
  waymarkToolInputSchema,
  waymarkToolInputShape,
} from "../types";
import { handleAdd } from "./add";
import { handleGraph } from "./graph";
import { handleHelp } from "./help";
import { handleScan } from "./scan";

type WaymarkAction = (typeof WAYMARK_ACTIONS)[number];

function isWaymarkAction(value: string): value is WaymarkAction {
  return (WAYMARK_ACTIONS as readonly string[]).includes(value);
}

export function handleWaymarkTool(
  input: unknown,
  server: Pick<McpServer, "sendResourceListChanged">
): Promise<CallToolResult> {
  const parsedResult = waymarkToolInputSchema.safeParse(input);
  if (!parsedResult.success) {
    const action =
      typeof input === "object" && input !== null && "action" in input
        ? String((input as { action?: unknown }).action)
        : undefined;
    if (action && !isWaymarkAction(action)) {
      const valid = WAYMARK_ACTIONS.join(", ");
      return Promise.reject(
        new Error(
          `Unsupported waymark action: ${action}. Valid actions: ${valid}`
        )
      );
    }
    return Promise.reject(parsedResult.error);
  }

  const parsed = parsedResult.data;

  switch (parsed.action) {
    case "scan":
      return handleScan(parsed);
    case "graph":
      return handleGraph(parsed);
    case "add":
      return handleAdd(parsed, server);
    case "help":
      return Promise.resolve(handleHelp(parsed));
    default: {
      const action = (parsed as { action: string }).action;
      const valid = WAYMARK_ACTIONS.join(", ");
      return Promise.reject(
        new Error(
          `Unsupported waymark action: ${action}. Valid actions: ${valid}`
        )
      );
    }
  }
}

export const waymarkToolDefinition = {
  title: "Waymark",
  description:
    "Single tool for waymark actions. Use action=scan, graph, add, or help. scan/graph default to the current directory when paths are omitted.",
  inputSchema: waymarkToolInputShape,
} as const;
