// tldr ::: todos resource handler for waymark MCP server

import { readFile } from "node:fs/promises";
import type { OutfitterError } from "@outfitter/contracts";
import { InternalError, Result } from "@outfitter/contracts";
import { parse, type WaymarkRecord } from "@waymarks/core";
import { MARKERS } from "@waymarks/grammar";
import { TODOS_RESOURCE_URI } from "../types";
import { loadConfig } from "../utils/config";
import {
  applySkipPaths,
  expandInputPaths,
  normalizePathForOutput,
} from "../utils/filesystem";

export const MAX_TODOS_CONCURRENCY = 8;
export const MAX_TODOS_RESULTS = 2000;

type TodosResourceContents = {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
};

/**
 * Handle the todos resource request.
 * @returns Result containing MCP resource response with todo records, or an OutfitterError.
 */
export async function handleTodosResource(): Promise<
  Result<TodosResourceContents, OutfitterError>
> {
  const collectResult = await collectRecords(["."], {});
  if (collectResult.isErr()) {
    return Result.err(collectResult.error);
  }
  const { records, truncated } = collectResult.value;
  const todos = records.map((record) => ({
    file: record.file,
    line: record.startLine,
    content: record.contentText,
    raw: record.raw,
  }));

  return Result.ok({
    contents: [
      {
        uri: TODOS_RESOURCE_URI,
        mimeType: "application/json",
        text: JSON.stringify({ todos, truncated }, null, 2),
      },
    ],
  });
}

async function collectRecords(
  inputs: string[],
  options: { configPath?: string; scope?: string }
): Promise<
  Result<{ records: WaymarkRecord[]; truncated: boolean }, OutfitterError>
> {
  const expandResult = await expandInputPaths(inputs);
  if (expandResult.isErr()) {
    return Result.err(expandResult.error);
  }
  let filePaths = expandResult.value;
  if (filePaths.length === 0) {
    return Result.ok({ records: [], truncated: false });
  }

  const configResult = await loadConfig({
    scope: (options.scope as "default" | "project" | "user") ?? "default",
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
  let truncated = false;

  await processWithLimit(filePaths, MAX_TODOS_CONCURRENCY, async (filePath) => {
    if (records.length >= MAX_TODOS_RESULTS) {
      truncated = true;
      return;
    }
    const source = await readFile(filePath, "utf8").catch(() => null);
    if (typeof source !== "string") {
      return;
    }
    const parsed = parse(source, { file: normalizePathForOutput(filePath) });
    const todos = parsed.filter(
      (record) => record.type.toLowerCase() === MARKERS.todo
    );
    if (todos.length === 0) {
      return;
    }
    const remaining = MAX_TODOS_RESULTS - records.length;
    if (remaining <= 0) {
      truncated = true;
      return;
    }
    if (todos.length > remaining) {
      records.push(...todos.slice(0, remaining));
      truncated = true;
      return;
    }
    records.push(...todos);
  });

  return Result.ok({ records, truncated });
}

export const todosResourceDefinition = {
  uri: TODOS_RESOURCE_URI,
  title: "Waymark TODOs",
  description: "All todo waymarks discovered in the repository",
  mimeType: "application/json",
};

async function processWithLimit(
  filePaths: string[],
  limit: number,
  handler: (filePath: string) => Promise<void>
): Promise<void> {
  if (filePaths.length === 0) {
    return;
  }
  const queue = [...filePaths];
  const workerCount = Math.min(limit, queue.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const filePath = queue.shift();
      if (!filePath) {
        return;
      }
      await handler(filePath);
    }
  });
  await Promise.all(workers);
}
