// tldr ::: find command helpers for waymark CLI

import type { WaymarkConfig, WaymarkRecord } from "@waymarks/core";
import { searchRecords } from "@waymarks/core";
import { createArgIterator } from "../utils/flags/iterator";
import { handleJsonFlag } from "../utils/flags/json";
import { handleMentionFlag } from "../utils/flags/mention";
import { handleTagFlag } from "../utils/flags/tag";
import { handleTldrFlag } from "../utils/flags/tldr";
import { handleTypeFlag } from "../utils/flags/type";
import { scanRecords } from "./scan";

export type FindCommandOptions = {
  filePath: string;
  types?: string[];
  tags?: string[];
  mentions?: string[];
  outputFormat?: "json" | "jsonl";
  config: WaymarkConfig;
};

/**
 * Scan the provided file and run structured searches across the resulting records.
 */
export async function findRecords(
  options: FindCommandOptions
): Promise<WaymarkRecord[]> {
  const { filePath, types, tags, mentions, config } = options;
  const records = await scanRecords([filePath], config);

  const query: Parameters<typeof searchRecords>[1] = {};
  if (types && types.length > 0) {
    query.markers = types;
  }
  if (tags && tags.length > 0) {
    query.tags = tags;
  }
  if (mentions && mentions.length > 0) {
    query.mentions = mentions;
  }

  return searchRecords(records, query);
}

/**
 * Parse CLI arguments for the find command into structured options.
 */
export function parseFindArgs(
  argv: string[]
): Omit<FindCommandOptions, "config"> {
  const [filePath, ...rest] = argv;
  if (!filePath) {
    throw new Error("find requires a file path");
  }

  const iterator = createArgIterator(rest);
  const types: string[] = [];
  const tags: string[] = [];
  const mentions: string[] = [];
  const jsonState = { outputFormat: null };

  while (iterator.hasNext()) {
    const token = iterator.next();
    handleJsonFlag(token, jsonState);
    handleTldrFlag(token, types);
    handleTypeFlag(token, iterator, types);
    handleTagFlag(token, iterator, tags);
    handleMentionFlag(token, iterator, mentions);
  }

  const options: Omit<FindCommandOptions, "config"> = { filePath };
  if (jsonState.outputFormat) {
    options.outputFormat = jsonState.outputFormat;
  }
  if (types.length > 0) {
    options.types = types;
  }
  if (tags.length > 0) {
    options.tags = tags;
  }
  if (mentions.length > 0) {
    options.mentions = mentions;
  }

  return options;
}
