// tldr ::: graph tool handler for waymark MCP server

import type { OutfitterError } from "@outfitter/contracts";
import { InternalError, Result, ValidationError } from "@outfitter/contracts";
import type { ConfigScope, WaymarkRecord } from "@waymarks/core";
import { buildRelationGraph, parse } from "@waymarks/core";
import type { ToolContent } from "../types";
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
 * @returns Result containing MCP tool result with graph output, or an OutfitterError.
 */
export async function handleGraph(
  input: unknown
): Promise<Result<ToolContent, OutfitterError>> {
  const parseResult = graphInputSchema.safeParse(input);
  if (!parseResult.success) {
    return Result.err(ValidationError.fromMessage(parseResult.error.message));
  }
  const { paths, configPath, scope } = parseResult.data;
  const collectOptions: { configPath?: string; scope?: ConfigScope } = {};
  if (configPath) {
    collectOptions.configPath = configPath;
  }
  if (scope) {
    collectOptions.scope = scope;
  }
  const collectResult = await collectRecords(paths, collectOptions);
  if (collectResult.isErr()) {
    return Result.err(collectResult.error);
  }
  const { records } = collectResult.value;
  const edges = buildRelationGraph(records).edges;
  return Result.ok(toJsonResponse(edges));
}

async function collectRecords(
  inputs: string[],
  options: { configPath?: string; scope?: ConfigScope }
): Promise<Result<{ records: WaymarkRecord[] }, OutfitterError>> {
  const expandResult = await expandInputPaths(inputs);
  if (expandResult.isErr()) {
    return Result.err(expandResult.error);
  }
  let filePaths = expandResult.value;
  if (filePaths.length === 0) {
    return Result.ok({ records: [] });
  }

  const configResult = await loadConfig({
    scope: options.scope ?? "default",
    ...(options.configPath ? { configPath: options.configPath } : {}),
  });
  if (configResult.isErr()) {
    return Result.err(
      InternalError.create(
        `Failed to load config: ${configResult.error instanceof Error ? configResult.error.message : String(configResult.error)}`
      )
    );
  }
  const config = configResult.value;

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

  return Result.ok({ records });
}

function toJsonResponse(value: unknown): ToolContent {
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
