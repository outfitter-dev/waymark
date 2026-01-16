// tldr ::: core parser orchestration for waymark grammar syntax

import {
  buildRecord,
  processWaymarkLine,
  type WaymarkContext,
} from "./builder";
import { BLESSED_MARKERS, SIGIL } from "./constants";
import { processContentSegment } from "./content";
import { normalizeLine, parseHeader } from "./tokenizer";
import type { ParseOptions, WaymarkRecord } from "./types";

const LINE_SPLIT_REGEX = /\r?\n/;

/**
 * Parse a single line into a waymark record when possible.
 * @param line - Raw line of text to parse.
 * @param lineNumber - 1-based line number in the source.
 * @param options - Optional parse options.
 * @returns Parsed waymark record or null when no header is found.
 */
export function parseLine(
  line: string,
  lineNumber: number,
  options: ParseOptions = {}
): WaymarkRecord | null {
  const normalizedLine = normalizeLine(line);
  const header = parseHeader(normalizedLine);

  if (!header) {
    return null;
  }

  const segment = processContentSegment(header.content, header.commentLeader);
  const contentText = segment.text;
  const raw = normalizedLine;

  return buildRecord({
    options,
    header,
    raw,
    contentText,
    startLine: lineNumber,
    endLine: lineNumber,
  });
}

/**
 * Parse a full text buffer into waymark records.
 * @param text - Source text to parse.
 * @param options - Optional parse options.
 * @returns Parsed waymark records.
 */
export function parse(
  text: string,
  options: ParseOptions = {}
): WaymarkRecord[] {
  const lines = text.split(LINE_SPLIT_REGEX);
  const records: WaymarkRecord[] = [];
  let inWaymarkContext = false;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = normalizeLine(lines[index] ?? "");
    if (!rawLine.includes(SIGIL)) {
      inWaymarkContext = false;
      continue;
    }

    const header = parseHeader(rawLine);
    if (!header) {
      inWaymarkContext = false;
      continue;
    }

    inWaymarkContext = true;
    const context: WaymarkContext = {
      lines,
      index,
      options,
      inWaymarkContext,
    };

    const { record, newIndex } = processWaymarkLine(context, header, rawLine);
    index = newIndex;
    records.push(record);
  }

  return records;
}

/**
 * Check whether a marker type is in the blessed marker list.
 * @param type - Marker type to validate.
 * @returns True if the type is blessed.
 */
export function isValidType(type: string | undefined): boolean {
  if (!type) {
    return false;
  }
  return BLESSED_MARKERS.includes(type.toLowerCase());
}
