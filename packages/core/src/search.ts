// tldr ::: utility helpers for filtering waymark records

import type { WaymarkRecord } from "@waymarks/grammar";

export type SearchQuery = {
  markers?: string[];
  tags?: string[];
  mentions?: string[];
  text?: string | RegExp;
  includeCanonicals?: boolean;
  predicate?: (record: WaymarkRecord) => boolean;
};

export function searchRecords(
  records: WaymarkRecord[],
  query: SearchQuery = {}
): WaymarkRecord[] {
  const {
    markers,
    tags,
    mentions,
    text,
    includeCanonicals = true,
    predicate,
  } = query;

  const normalizedMarkers = markers?.map((marker) => marker.toLowerCase());

  let results = includeCanonicals
    ? [...records]
    : records.filter((record) => record.canonicals.length === 0);

  if (normalizedMarkers && normalizedMarkers.length > 0) {
    results = results.filter((record) =>
      matchesMarkers(record, normalizedMarkers)
    );
  }

  if (tags && tags.length > 0) {
    results = results.filter((record) => matchesAny(record.tags, tags));
  }

  if (mentions && mentions.length > 0) {
    results = results.filter((record) => matchesAny(record.mentions, mentions));
  }

  if (text) {
    results = results.filter((record) => matchesText(record.contentText, text));
  }

  if (predicate) {
    results = results.filter((record) => predicate(record));
  }

  return results;
}

function matchesMarkers(record: WaymarkRecord, markers: string[]): boolean {
  const marker = record.marker.toLowerCase();
  return markers.some((candidate) => candidate === marker);
}

function matchesAny(values: string[], targets: string[]): boolean {
  if (targets.length === 0) {
    return true;
  }
  return targets.some((target) => values.includes(target));
}

function matchesText(content: string, text: string | RegExp): boolean {
  if (typeof text === "string") {
    return content.toLowerCase().includes(text.toLowerCase());
  }
  return text.test(content);
}
