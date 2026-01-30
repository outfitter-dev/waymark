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

// Fence detection for wm:ignore blocks (markdown code fences)
const FENCE_OPEN_REGEX = /^(\s*)(`{3,})(.*)$/;
const WM_IGNORE_ATTR = /\bwm:ignore\b/i;

type FenceState = {
  inIgnoredFence: boolean;
  backtickCount: number;
};

/**
 * Update fence state based on current line.
 * @param line - Current line to check for fence markers.
 * @param state - Current fence state.
 * @returns Updated fence state.
 */
function updateFenceState(line: string, state: FenceState): FenceState {
  const fenceMatch = line.match(FENCE_OPEN_REGEX);
  if (!fenceMatch) {
    return state;
  }

  const backtickCount = fenceMatch[2]?.length ?? 0;
  const infoString = fenceMatch[3] ?? "";

  if (state.inIgnoredFence) {
    // Check if this closes the fence (same or more backticks, empty info string)
    const isClosingFence =
      backtickCount >= state.backtickCount && infoString.trim() === "";
    if (isClosingFence) {
      return { inIgnoredFence: false, backtickCount: 0 };
    }
    return state;
  }

  // Check for opening fence with wm:ignore attribute
  if (WM_IGNORE_ATTR.test(infoString)) {
    return { inIgnoredFence: true, backtickCount };
  }

  return state;
}

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
  let fenceState: FenceState = { inIgnoredFence: false, backtickCount: 0 };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = normalizeLine(lines[index] ?? "");

    // Update fence state for wm:ignore blocks
    fenceState = updateFenceState(rawLine, fenceState);

    // Skip waymark processing when inside an ignored fence (unless includeIgnored)
    if (fenceState.inIgnoredFence && !options.includeIgnored) {
      inWaymarkContext = false;
      continue;
    }

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
