// tldr ::: tool registry for waymark MCP server

import type { McpServer } from "@outfitter/mcp";
import { defineTool } from "@outfitter/mcp";
import { waymarkToolInputSchema } from "../types";
import { handleWaymarkTool, waymarkToolDescription } from "./waymark";

/**
 * Register MCP tools on the provided server.
 * @param server - Outfitter MCP server instance.
 * @param notifyResourceChanged - Callback to signal resource list changed.
 */
export function registerTools(
  server: McpServer,
  notifyResourceChanged: () => void
): void {
  server.registerTool(
    defineTool({
      name: "waymark",
      description: waymarkToolDescription,
      inputSchema: waymarkToolInputSchema,
      handler: (input, _ctx) => handleWaymarkTool(input, notifyResourceChanged),
    })
  );
}
