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
      annotations: {
        readOnlyHint: false, // "add" action mutates files
        destructiveHint: false, // "add" is additive, not destructive
        idempotentHint: false, // "add" creates new waymarks each call
        openWorldHint: false, // operates on local filesystem only
      },
      handler: async (input, _ctx) => {
        const result = await handleWaymarkTool(input, notifyResourceChanged);
        return Result.ok(result) as Result<ToolContent, never>;
      },
    })
  );
}
