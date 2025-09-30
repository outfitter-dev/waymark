// tldr ::: scan tool handler for waymark MCP server

import { readFile } from "node:fs/promises";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ConfigScope, WaymarkRecord } from "@waymarks/core";
import { parse } from "@waymarks/core";
import type { RenderFormat } from "../types";
import { scanInputSchema } from "../types";
import { loadConfig } from "../utils/config";
import {
  applySkipPaths,
  expandInputPaths,
  normalizePathForOutput,
} from "../utils/filesystem";

export async function handleScan(input: unknown): Promise<CallToolResult> {
  const { paths, format, configPath, scope } = scanInputSchema.parse(input);
  const collectOptions: { configPath?: string; scope?: ConfigScope } = {};
  if (configPath) {
    collectOptions.configPath = configPath;
  }
  if (scope) {
    collectOptions.scope = scope;
  }
  const { records } = await collectRecords(paths, collectOptions);
  const rendered = renderRecords(records, format);
  return toTextResponse(rendered, mimeForFormat(format));
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
      const source = await readFile(filePath, "utf8").catch(() => null);
      if (typeof source !== "string") {
        return;
      }
      const parsed = parse(source, { file: normalizePathForOutput(filePath) });
      records.push(...parsed);
    })
  );

  return { records };
}

function renderRecords(records: WaymarkRecord[], format: RenderFormat): string {
  if (records.length === 0) {
    return "";
  }

  switch (format) {
    case "json":
      return JSON.stringify(records);
    case "jsonl":
      return records.map((record) => JSON.stringify(record)).join("\n");
    case "pretty":
      return JSON.stringify(records, null, 2);
    default:
      return records
        .map(
          (record) =>
            `${record.file}:${record.startLine} ${record.type} ::: ${record.contentText}`
        )
        .join("\n");
  }
}

function toTextResponse(text: string, mimeType: string): CallToolResult {
  return {
    content: [
      {
        type: "text",
        mimeType,
        text,
      },
    ],
  };
}

function mimeForFormat(format: RenderFormat): string {
  switch (format) {
    case "json":
    case "jsonl":
    case "pretty":
      return "application/json";
    default:
      return "text/plain";
  }
}

export const scanToolDefinition = {
  title: "Scan files for waymarks",
  description:
    "Parses one or more files (or directories) and returns waymark records in the requested format.",
  inputSchema: scanInputSchema.shape,
};
