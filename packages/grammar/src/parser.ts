// tldr ::: core parser for waymark grammar syntax

import { BLESSED_MARKERS } from "./constants";
import type { ParseOptions, WaymarkRecord } from "./types";

// Basic regex to detect waymark pattern
const WAYMARK_REGEX = /^(\s*)(\/\/|#|--|<!--)\s*([*!]*)?(\w+)\s+:::\s+(.*)$/;

/**
 * Parse a single line for waymark syntax
 */
export function parseLine(
  line: string,
  lineNumber: number,
  options: ParseOptions = {}
): WaymarkRecord | null {
  // todo ::: implement full waymark parser

  const match = line.match(WAYMARK_REGEX);

  if (!match) {
    return null;
  }

  const [raw, indent, commentLeader, signals, marker, content] = match;

  // Parse signals
  const hasCurrentSignal = Boolean(signals?.includes("*"));
  const hasImportantSignal = Boolean(signals?.includes("!"));

  // todo ::: parse properties, relations, mentions, tags from content

  return {
    file: options.file || "",
    language: options.language || "unknown",
    fileCategory: "code", // todo ::: determine from file extension
    startLine: lineNumber,
    endLine: lineNumber,
    indent: indent?.length || 0,
    commentLeader: commentLeader || null,
    signals: {
      current: hasCurrentSignal,
      important: hasImportantSignal,
    },
    marker: (marker || "").toLowerCase(),
    contentText: (content || "").trim(),
    properties: {},
    relations: [],
    canonicals: [],
    mentions: [],
    tags: [],
    raw,
  };
}

/**
 * Parse text for waymarks
 */
export function parse(
  text: string,
  options: ParseOptions = {}
): WaymarkRecord[] {
  const lines = text.split("\n");
  const records: WaymarkRecord[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) {
      continue;
    }
    const record = parseLine(line, i + 1, options);
    if (record) {
      records.push(record);
    }
  }

  return records;
}

/**
 * Validate a marker is blessed
 */
export function isValidMarker(marker: string | undefined): boolean {
  if (!marker) {
    return false;
  }
  return BLESSED_MARKERS.includes(
    marker.toLowerCase() as (typeof BLESSED_MARKERS)[number]
  );
}
