// tldr ::: single MCP tool handler for waymark actions

import type { OutfitterError } from "@outfitter/contracts";
import { Result } from "@outfitter/contracts";
import type { ToolContent, WaymarkToolInput } from "../types";
import { handleAdd } from "./add";
import { handleGraph } from "./graph";
import { handleHelp } from "./help";
import { handleScan } from "./scan";

/**
 * Dispatch the MCP tool input to the correct waymark action handler.
 * Input is pre-validated by the framework's discriminatedUnion schema.
 * @param input - Validated tool input payload.
 * @param notifyResourceChanged - Callback to signal resource list changed.
 * @returns Result containing MCP tool result, or an OutfitterError.
 */
export function handleWaymarkTool(
  input: WaymarkToolInput,
  notifyResourceChanged: () => void
): Promise<Result<ToolContent, OutfitterError>> {
  switch (input.action) {
    case "scan":
      return handleScan(input);
    case "graph":
      return handleGraph(input);
    case "add":
      return handleAdd(input, notifyResourceChanged);
    case "help":
      return Promise.resolve(Result.ok(handleHelp(input)));
    default:
      // Exhaustive: input.action is validated by the framework's discriminatedUnion schema
      return input satisfies never;
  }
}

export const waymarkToolDescription =
  "Single tool for waymark actions. Use action=scan, graph, add, or help. scan/graph default to the current directory when paths are omitted.";
