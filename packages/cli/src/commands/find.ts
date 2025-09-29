// tldr ::: find command helpers for waymark CLI

import type { WaymarkRecord } from "@waymarks/core";
import { searchRecords } from "@waymarks/core";
import { createArgIterator } from "../utils/flags/iterator";
import { handleJsonFlag } from "../utils/flags/json";
import { handleMarkerFlag } from "../utils/flags/marker";
import { handleMentionFlag } from "../utils/flags/mention";
import { handleTagFlag } from "../utils/flags/tag";
import { scanRecords } from "./scan";

export type FindCommandOptions = {
  filePath: string;
  markers?: string[];
  tags?: string[];
  mentions?: string[];
  json?: boolean;
};

/**
 * Scan the provided file and run structured searches across the resulting records.
 */
export async function findRecords(
  options: FindCommandOptions
): Promise<WaymarkRecord[]> {
  const { filePath, markers, tags, mentions } = options;
  const records = await scanRecords([filePath]);

  const query: Parameters<typeof searchRecords>[1] = {};
  if (markers && markers.length > 0) {
    query.markers = markers;
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
export function parseFindArgs(argv: string[]): FindCommandOptions {
  const [filePath, ...rest] = argv;
  if (!filePath) {
    throw new Error("find requires a file path");
  }

  const iterator = createArgIterator(rest);
  const markers: string[] = [];
  const tags: string[] = [];
  const mentions: string[] = [];
  const jsonState = { json: false };

  while (iterator.hasNext()) {
    const token = iterator.next();
    handleJsonFlag(token, jsonState);
    handleMarkerFlag(token, iterator, markers);
    handleTagFlag(token, iterator, tags);
    handleMentionFlag(token, iterator, mentions);
  }

  const options: FindCommandOptions = { filePath, json: jsonState.json };
  if (markers.length > 0) {
    options.markers = markers;
  }
  if (tags.length > 0) {
    options.tags = tags;
  }
  if (mentions.length > 0) {
    options.mentions = mentions;
  }

  return options;
}
