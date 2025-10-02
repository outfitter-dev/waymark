// tldr ::: enhanced ripgrep-style formatter with chalk styling and alignment

import type { WaymarkRecord } from "@waymarks/core";
import type { DisplayOptions } from "../types";
import { stripCommentMarkers } from "./strip-markers";
import {
  styleContent,
  styleFilePath,
  styleLineNumber,
  styleSigil,
  styleType,
} from "./styles";

// Regex patterns for continuation detection
const CONTINUATION_CONTENT_PATTERN = /^.*?:::\s*/;
const SIGIL_SPLIT_PATTERN = / ::: /;
const PROPERTY_AS_MARKER_PATTERN = /^(\S+)\s+:::\s+(.*)$/;

/**
 * Group records by file path
 */
function groupByFile(records: WaymarkRecord[]): Map<string, WaymarkRecord[]> {
  const groups = new Map<string, WaymarkRecord[]>();

  for (const record of records) {
    const existing = groups.get(record.file) || [];
    existing.push(record);
    groups.set(record.file, existing);
  }

  return groups;
}

/**
 * Get the maximum line number width for a set of records
 * Minimum width of 2 to ensure single-digit line numbers have a leading space
 */
function getMaxLineWidth(records: WaymarkRecord[]): number {
  const maxLine = Math.max(...records.map((r) => r.endLine));
  return Math.max(2, String(maxLine).length);
}

/**
 * Get the longest type length (including signals) for a set of records
 */
function getLongestTypeLength(records: WaymarkRecord[]): number {
  let maxLength = 0;
  for (const record of records) {
    const signalStr =
      (record.signals.raised ? "^" : "") +
      (record.signals.important ? "*" : "");
    const typeLength = signalStr.length + record.type.length;
    if (typeLength > maxLength) {
      maxLength = typeLength;
    }
  }
  return maxLength;
}

/**
 * Get the type string with signals
 */
function getTypeWithSignal(record: WaymarkRecord): string {
  const signalStr =
    (record.signals.raised ? "^" : "") + (record.signals.important ? "*" : "");
  return signalStr + record.type;
}

/**
 * Format a single waymark line with proper alignment and styling
 */
function formatWaymarkLine(
  record: WaymarkRecord,
  lineWidth: number,
  longestTypeLength: number,
  options: DisplayOptions
): string {
  const keepMarkers = options.keepCommentMarkers ?? false;
  const compact = options.compact ?? false;

  // Extract the waymark content
  const content = keepMarkers
    ? record.raw
    : stripCommentMarkers(record.raw, record.commentLeader);

  // Calculate spacing for alignment
  const typeWithSignal = getTypeWithSignal(record);
  const baseIndent = 2;
  const paddingSpaces =
    baseIndent + (longestTypeLength - typeWithSignal.length);

  // Format the type and signals
  const typeStr = styleType(record.type, record.signals);
  const sigilStr = styleSigil(" ::: ");

  // Style the content (mentions, tags, etc.)
  const contentParts = content.split(SIGIL_SPLIT_PATTERN);
  const waymarkContent =
    contentParts.length > 1
      ? contentParts.slice(1).join(" ::: ")
      : contentParts[0];
  const styledContent = styleContent(waymarkContent || "");

  // Format line number with padding
  const lineNum = String(record.startLine).padStart(lineWidth, " ");
  const lineNumStr = styleLineNumber(lineNum);

  if (compact) {
    return `${lineNumStr} ${typeStr}${sigilStr}${styledContent}`;
  }

  // Build with proper spacing for alignment
  const spacing = " ".repeat(paddingSpaces);
  return `${lineNumStr}${spacing}${typeStr}${sigilStr}${styledContent}`;
}

/**
 * Format a continuation line (starts with :::)
 */
function formatContinuationLine(
  content: string,
  lineNumStr: string,
  lineWidth: number,
  longestTypeLength: number
): string {
  const continuationContent = content.replace(CONTINUATION_CONTENT_PATTERN, "");
  const styledContent = styleContent(continuationContent);

  // Calculate padding to align ::: with other waymarks
  const sigilColumn = lineWidth + 1 + 2 + longestTypeLength + 1;
  const paddingSpaces = sigilColumn - lineWidth - 1;
  const spacing = " ".repeat(paddingSpaces);

  return `${lineNumStr}${spacing}${styleSigil(":::")} ${styledContent}`;
}

/**
 * Format the first line of a waymark
 */
function formatFirstLine(
  content: string,
  record: WaymarkRecord,
  lineNumStr: string,
  longestTypeLength: number
): string {
  const typeWithSignal = getTypeWithSignal(record);
  const baseIndent = 2;
  const paddingSpaces =
    baseIndent + (longestTypeLength - typeWithSignal.length);

  const typeStr = styleType(record.type, record.signals);
  const sigilStr = styleSigil(" ::: ");
  const waymarkContent = content
    .split(SIGIL_SPLIT_PATTERN)
    .slice(1)
    .join(" ::: ");
  const styledContent = styleContent(waymarkContent);

  const spacing = " ".repeat(paddingSpaces);
  return `${lineNumStr}${spacing}${typeStr}${sigilStr}${styledContent}`;
}

/**
 * Format a property-as-marker continuation line (e.g., "ref ::: #token")
 */
function formatPropertyLine(
  content: string,
  lineNumStr: string,
  lineWidth: number,
  longestTypeLength: number
): string {
  // Check if this line has a prefix before ::: (property-as-marker pattern)
  const sigilMatch = content.match(PROPERTY_AS_MARKER_PATTERN);

  if (sigilMatch) {
    const [, prefix, afterSigil] = sigilMatch;

    // Style the prefix like a type (colored based on category, but not bold/underlined like a real type)
    // For property continuations, we just color the prefix, no bold/underline
    const styledPrefix = styleContent(prefix || "");
    const styledContent = styleContent(afterSigil || "");

    // Calculate padding to align the ::: with other waymarks
    const baseIndent = 2;
    const prefixLength = prefix?.length ?? 0;
    const paddingSpaces = baseIndent + (longestTypeLength - prefixLength);
    const spacing = " ".repeat(Math.max(0, paddingSpaces));

    return `${lineNumStr}${spacing}${styledPrefix}${styleSigil(" ::: ")}${styledContent}`;
  }

  // If no prefix, just style the entire content
  const styledContent = styleContent(content);
  const sigilColumn = lineWidth + 1 + 2 + longestTypeLength + 1;
  const paddingSpaces = sigilColumn - lineWidth - 1;
  const spacing = " ".repeat(paddingSpaces);

  return `${lineNumStr}${spacing}${styledContent}`;
}

/**
 * Format multi-line waymark with aligned ::: continuations
 */
function formatMultiLineWaymark(
  record: WaymarkRecord,
  lineWidth: number,
  longestTypeLength: number,
  options: DisplayOptions
): string[] {
  const lines: string[] = [];
  const keepMarkers = options.keepCommentMarkers ?? false;

  // Split raw text into lines if multi-line
  const rawLines = record.raw.split("\n");

  if (rawLines.length === 1) {
    // Single line waymark
    lines.push(
      formatWaymarkLine(record, lineWidth, longestTypeLength, options)
    );
    return lines;
  }

  // Multi-line waymark - process each line
  let currentLine = record.startLine;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i] || "";
    const lineNum = String(currentLine).padStart(lineWidth, " ");
    const lineNumStr = styleLineNumber(lineNum);

    const content = keepMarkers
      ? rawLine
      : stripCommentMarkers(rawLine, record.commentLeader || "");

    // Determine line type and format accordingly
    if (i === 0) {
      lines.push(
        formatFirstLine(content, record, lineNumStr, longestTypeLength)
      );
    } else if (content.trim().startsWith(":::")) {
      lines.push(
        formatContinuationLine(
          content,
          lineNumStr,
          lineWidth,
          longestTypeLength
        )
      );
    } else {
      lines.push(
        formatPropertyLine(content, lineNumStr, lineWidth, longestTypeLength)
      );
    }

    currentLine++;
  }

  return lines;
}

/**
 * Format a single record in compact mode (file:line  type ::: content)
 */
function formatCompactRecord(
  record: WaymarkRecord,
  _options: DisplayOptions
): string {
  // In compact mode, use parsed contentText and collapse to single line
  const content = record.contentText.replace(/\n/g, " ");

  // Format: file:line  type ::: content
  const typeStr = styleType(record.type, record.signals);
  const sigilStr = styleSigil(" ::: ");
  const styledContent = styleContent(content);

  // In compact mode, don't underline file path and don't dim line number
  return `${record.file}:${record.startLine}  ${typeStr}${sigilStr}${styledContent}`;
}

/**
 * Format records in enhanced ripgrep-style output
 */
export function formatEnhanced(
  records: WaymarkRecord[],
  options: DisplayOptions
): string {
  const compact = options.compact ?? false;

  // Compact mode: one line per waymark, file:line prefix
  if (compact) {
    return records
      .map((record) => formatCompactRecord(record, options))
      .join("\n");
  }

  // Regular mode: grouped by file with headers
  const groups = groupByFile(records);
  const output: string[] = [];

  for (const [filePath, fileRecords] of groups) {
    // Add file header
    output.push(styleFilePath(filePath));

    // Calculate max line width and longest type length for this file
    const lineWidth = getMaxLineWidth(fileRecords);
    const longestTypeLength = getLongestTypeLength(fileRecords);

    // Format each waymark
    for (const record of fileRecords) {
      const waymarkLines = formatMultiLineWaymark(
        record,
        lineWidth,
        longestTypeLength,
        options
      );
      output.push(...waymarkLines);
    }

    // Add blank line between files
    output.push("");
  }

  // Remove trailing blank line
  if (output.at(-1) === "") {
    output.pop();
  }

  return output.join("\n");
}
