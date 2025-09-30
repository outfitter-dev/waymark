// tldr ::: map resource handler for waymark MCP server

import { readFile } from "node:fs/promises";
import {
  buildWaymarkMap,
  parse,
  type WaymarkMap,
  type WaymarkRecord,
} from "@waymarks/core";
import { MAP_RESOURCE_URI } from "../types";
import { loadConfig } from "../utils/config";
import {
  applySkipPaths,
  expandInputPaths,
  normalizePathForOutput,
} from "../utils/filesystem";

export async function handleMapResource() {
  const { records } = await collectRecords(["."], {});
  const map = buildWaymarkMap(records);
  return {
    contents: [
      {
        uri: MAP_RESOURCE_URI,
        mimeType: "application/json",
        text: JSON.stringify(serializeMap(map), null, 2),
      },
    ],
  };
}

async function collectRecords(
  inputs: string[],
  options: { configPath?: string; scope?: string }
): Promise<{ records: WaymarkRecord[] }> {
  let filePaths = await expandInputPaths(inputs);
  if (filePaths.length === 0) {
    return { records: [] };
  }

  const config = await loadConfig({
    scope: (options.scope as "default" | "project" | "global") ?? "default",
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

export const mapResourceDefinition = {
  uri: MAP_RESOURCE_URI,
  title: "Waymark Map",
  description: "Summary of TLDR and type counts across the repository",
  mimeType: "application/json",
};
