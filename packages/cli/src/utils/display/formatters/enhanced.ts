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
 */
function getMaxLineWidth(records: WaymarkRecord[]): number {
  const maxLine = Math.max(...records.map((r) => r.endLine));
  return String(maxLine).length;
}

/**
 * Format a single waymark line with proper alignment and styling
 */
function formatWaymarkLine(
  record: WaymarkRecord,
  lineWidth: number,
  options: DisplayOptions
): string {
  const keepMarkers = options.keepCommentMarkers ?? false;
  const compact = options.compact ?? false;

  // Extract the waymark content
  const content = keepMarkers
    ? record.raw
    : stripCommentMarkers(record.raw, record.commentLeader);

  // Format the type and signals
  const typeStr = styleType(record.type, record.signals);
  const sigilStr = styleSigil(" ::: ");

  // Style the content (mentions, tags, etc.)
  const contentParts = content.split(" ::: ");
  const waymarkContent =
    contentParts.length > 1
      ? contentParts.slice(1).join(" ::: ")
      : contentParts[0];
  const styledContent = styleContent(waymarkContent || "");

  // Build the waymark string
  const waymarkStr = `${typeStr}${sigilStr}${styledContent}`;

  // Format line number with padding
  const lineNum = String(record.startLine).padStart(lineWidth, " ");
  const lineNumStr = styleLineNumber(Number.parseInt(lineNum, 10));

  if (compact) {
    return `${lineNumStr} ${waymarkStr}`;
  }

  // Two-space indent after line number
  return `${lineNumStr}  ${waymarkStr}`;
}

/**
 * Format a continuation line (starts with :::)
 */
function formatContinuationLine(content: string, lineNumStr: string): string {
  const continuationContent = content.replace(CONTINUATION_CONTENT_PATTERN, "");
  const styledContent = styleContent(continuationContent);
  const paddedSigil = styleSigil("     :::");
  return `${lineNumStr}  ${paddedSigil} ${styledContent}`;
}

/**
 * Format the first line of a waymark
 */
function formatFirstLine(
  content: string,
  record: WaymarkRecord,
  lineNumStr: string
): string {
  const typeStr = styleType(record.type, record.signals);
  const sigilStr = styleSigil(" ::: ");
  const waymarkContent = content
    .split(SIGIL_SPLIT_PATTERN)
    .slice(1)
    .join(" ::: ");
  const styledContent = styleContent(waymarkContent);
  return `${lineNumStr}  ${typeStr}${sigilStr}${styledContent}`;
}

/**
 * Format a property or other continuation line
 */
function formatPropertyLine(content: string, lineNumStr: string): string {
  const styledContent = styleContent(content);
  return `${lineNumStr}  ${styledContent}`;
}

/**
 * Format multi-line waymark with aligned ::: continuations
 */
function formatMultiLineWaymark(
  record: WaymarkRecord,
  lineWidth: number,
  options: DisplayOptions
): string[] {
  const lines: string[] = [];
  const keepMarkers = options.keepCommentMarkers ?? false;

  // Split raw text into lines if multi-line
  const rawLines = record.raw.split("\n");

  if (rawLines.length === 1) {
    // Single line waymark
    lines.push(formatWaymarkLine(record, lineWidth, options));
    return lines;
  }

  // Multi-line waymark - process each line
  let currentLine = record.startLine;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i] || "";
    const lineNum = String(currentLine).padStart(lineWidth, " ");
    const lineNumStr = styleLineNumber(Number.parseInt(lineNum, 10));

    const content = keepMarkers
      ? rawLine
      : stripCommentMarkers(rawLine, record.commentLeader || "");

    // Determine line type and format accordingly
    if (i === 0) {
      lines.push(formatFirstLine(content, record, lineNumStr));
    } else if (content.trim().startsWith(":::")) {
      lines.push(formatContinuationLine(content, lineNumStr));
    } else {
      lines.push(formatPropertyLine(content, lineNumStr));
    }

    currentLine++;
  }

  return lines;
}

/**
 * Format records in enhanced ripgrep-style output
 */
export function formatEnhanced(
  records: WaymarkRecord[],
  options: DisplayOptions
): string {
  const groups = groupByFile(records);
  const output: string[] = [];

  for (const [filePath, fileRecords] of groups) {
    // Add file header
    output.push(styleFilePath(filePath));

    // Calculate max line width for this file
    const lineWidth = getMaxLineWidth(fileRecords);

    // Format each waymark
    for (const record of fileRecords) {
      const waymarkLines = formatMultiLineWaymark(record, lineWidth, options);
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
