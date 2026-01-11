// tldr ::: graph tool handler for waymark MCP server

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ConfigScope, WaymarkRecord } from "@waymarks/core";
import { buildRelationGraph, parse } from "@waymarks/core";
import { graphInputSchema } from "../types";
import { loadConfig } from "../utils/config";
import { safeReadFile } from "../utils/errors";
import {
  applySkipPaths,
  expandInputPaths,
  normalizePathForOutput,
} from "../utils/filesystem";

/**
 * Handle the graph action for the MCP tool.
 * @param input - Raw tool input payload.
 * @returns MCP tool result with graph output.
 */
export async function handleGraph(input: unknown): Promise<CallToolResult> {
  const { paths, configPath, scope } = graphInputSchema.parse(input);
  const collectOptions: { configPath?: string; scope?: ConfigScope } = {};
  if (configPath) {
    collectOptions.configPath = configPath;
  }
  if (scope) {
    collectOptions.scope = scope;
  }
  const { records } = await collectRecords(paths, collectOptions);
  const edges = buildRelationGraph(records).edges;
  return toJsonResponse(edges);
}

async function collectRecords(
  inputs: string[],
  options: { configPath?: string; scope?: ConfigScope }
): Promise<{ records: WaymarkRecord[] }> {
  let filePaths = await expandInputPaths(inputs);
  if (filePaths.length === 0) {
    return { records: [] };
  }

  const config = await loadConfig({
    scope: options.scope ?? "default",
    ...(options.configPath ? { configPath: options.configPath } : {}),
  });

  filePaths = applySkipPaths(filePaths, config.skipPaths ?? []);

  const records: WaymarkRecord[] = [];
  await Promise.all(
    filePaths.map(async (filePath) => {
      const source = await safeReadFile(filePath, { logContext: "graph" });
      if (!source) {
        return;
      }
      const parsed = parse(source, { file: normalizePathForOutput(filePath) });
      records.push(...parsed);
    })
  );

  return { records };
}

function toJsonResponse(value: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        mimeType: "application/json",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

export const graphToolDefinition = {
  title: "Generate relation graph",
  description:
    "Produces the relation edges (ref/depends/needs/etc.) extracted from the provided files.",
  inputSchema: graphInputSchema.shape,
} as const;
