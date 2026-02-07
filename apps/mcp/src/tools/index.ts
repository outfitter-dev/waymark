// tldr ::: tool registry for waymark MCP server

import { Result } from "@outfitter/contracts";
import type { McpServer } from "@outfitter/mcp";
import { defineTool } from "@outfitter/mcp";
import type { ToolContent } from "../types";
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
      handler: async (input, _ctx) => {
        const result = await handleWaymarkTool(input, notifyResourceChanged);
        return Result.ok(result) as Result<ToolContent, never>;
      },
    })
  );
}
