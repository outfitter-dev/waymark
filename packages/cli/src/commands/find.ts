// tldr ::: find command helpers for waymark CLI

import type { WaymarkRecord } from "@waymarks/core";
import { searchRecords } from "@waymarks/core";
import { scanRecords } from "./scan";

export type FindCommandOptions = {
  filePath: string;
  markers?: string[];
  tags?: string[];
  mentions?: string[];
  json?: boolean;
};

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

export function parseFindArgs(argv: string[]): FindCommandOptions {
  const [filePath, ...rest] = argv;
  if (!filePath) {
    throw new Error("find requires a file path");
  }

  const markers: string[] = [];
  const tags: string[] = [];
  const mentions: string[] = [];
  let json = false;

  const consumers: Record<string, (value: string) => void> = {
    "--marker": (value) => markers.push(value),
    "--tag": (value) => tags.push(value),
    "--mention": (value) => mentions.push(value),
  };

  const iterator = rest[Symbol.iterator]();
  for (
    let current = iterator.next();
    !current.done;
    current = iterator.next()
  ) {
    const flag = current.value;
    if (flag === "--json") {
      json = true;
      continue;
    }

    const consume = consumers[flag];
    if (!consume) {
      continue;
    }

    const nextValue = iterator.next();
    if (!nextValue.done && nextValue.value) {
      consume(nextValue.value);
    }
  }

  const options: FindCommandOptions = { filePath, json };
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
