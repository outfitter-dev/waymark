// tldr ::: todos resource handler for waymark MCP server

import { readFile } from "node:fs/promises";
import { parse, type WaymarkRecord } from "@waymarks/core";
import { MARKERS } from "@waymarks/grammar";
import { TODOS_RESOURCE_URI } from "../types";
import { loadConfig } from "../utils/config";
import {
  applySkipPaths,
  expandInputPaths,
  normalizePathForOutput,
} from "../utils/filesystem";

export async function handleTodosResource() {
  const { records } = await collectRecords(["."], {});
  const todos = records
    .filter((record) => record.type.toLowerCase() === MARKERS.todo)
    .map((record) => ({
      file: record.file,
      line: record.startLine,
      content: record.contentText,
      raw: record.raw,
    }));

  return {
    contents: [
      {
        uri: TODOS_RESOURCE_URI,
        mimeType: "application/json",
        text: JSON.stringify(todos, null, 2),
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

export const todosResourceDefinition = {
  uri: TODOS_RESOURCE_URI,
  title: "Waymark TODOs",
  description: "All todo waymarks discovered in the repository",
  mimeType: "application/json",
};
