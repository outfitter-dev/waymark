// tldr ::: map command helpers for waymark CLI

import { buildWaymarkMap, type WaymarkMap } from "@waymarks/core";

import { createArgIterator, isFlag } from "../utils/flags/iterator";
import { handleJsonFlag } from "../utils/flags/json";
import { handleMarkerFlag } from "../utils/flags/marker";
import { handleSummaryFlag } from "../utils/flags/summary";
import { scanRecords } from "./scan";

export type ParsedMapArgs = {
  filePaths: string[];
  json: boolean;
  markers: string[];
  summary: boolean;
};

/**
 * Parse the provided file paths and build the aggregate map from scanned records.
 */
export async function mapFiles(filePaths: string[]): Promise<WaymarkMap> {
  const records = await scanRecords(filePaths);
  return buildWaymarkMap(records);
}

/**
 * Parse CLI arguments for the map command, collecting files and filters.
 */
export function parseMapArgs(argv: string[]): ParsedMapArgs {
  const iterator = createArgIterator(argv);
  const filePaths: string[] = [];
  const markers: string[] = [];
  const jsonState = { json: false };
  const summaryState = { summary: false };

  while (iterator.hasNext()) {
    const token = iterator.next();
    if (handleJsonFlag(token, jsonState)) {
      continue;
    }
    if (handleSummaryFlag(token, summaryState)) {
      continue;
    }
    if (handleMarkerFlag(token, iterator, markers)) {
      continue;
    }
    if (isFlag(token)) {
      continue;
    }
    if (typeof token === "string") {
      filePaths.push(token);
    }
  }

  return {
    filePaths: filePaths.length > 0 ? filePaths : [process.cwd()],
    json: jsonState.json,
    markers: markers.length > 0 ? Array.from(new Set(markers)) : [],
    summary: summaryState.summary,
  };
}
