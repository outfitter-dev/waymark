// tldr ::: map tool handler for waymark MCP server

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ConfigScope, WaymarkMap, WaymarkRecord } from "@waymarks/core";
import { buildWaymarkMap, parse } from "@waymarks/core";
import { mapInputSchema } from "../types";
import { loadConfig } from "../utils/config";
import { safeReadFile } from "../utils/errors";
import {
  applySkipPaths,
  expandInputPaths,
  normalizePathForOutput,
} from "../utils/filesystem";

export async function handleMap(input: unknown): Promise<CallToolResult> {
  const { paths, configPath, scope } = mapInputSchema.parse(input);
  const collectOptions: { configPath?: string; scope?: ConfigScope } = {};
  if (configPath) {
    collectOptions.configPath = configPath;
  }
  if (scope) {
    collectOptions.scope = scope;
  }
  const { records } = await collectRecords(paths, collectOptions);
  const map = buildWaymarkMap(records);
  const serialized = serializeMap(map);
  return toJsonResponse(serialized);
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
      const source = await safeReadFile(filePath, { logContext: "map" });
      if (!source) {
        return;
      }
      const parsed = parse(source, { file: normalizePathForOutput(filePath) });
      records.push(...parsed);
    })
  );

  return { records };
}

function serializeMap(map: WaymarkMap): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [file, summary] of map.files.entries()) {
    result[file] = {
      tldr: summary.tldr?.contentText,
      markers: Object.fromEntries(
        Array.from(summary.types.entries()).map(([marker, details]) => [
          marker,
          details.entries.length,
        ])
      ),
    };
  }
  return result;
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

export const mapToolDefinition = {
  title: "Summarize waymarks by file and marker",
  description: "Builds a TLDR/marker summary for the provided paths.",
  inputSchema: mapInputSchema.shape,
} as const;
