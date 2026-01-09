// tldr ::: text formatting utilities for waymark records

import { readFileSync } from "node:fs";
import type { WaymarkRecord } from "@waymarks/core";
import { sanitizeInlineText } from "../sanitize";
import type { DisplayOptions } from "../types";

/** Default line number width (3 digits = column 4 for colon) */
const LINE_NUMBER_WIDTH = 3;

/**
 * Format a single record in simple format
 */
export function formatRecordSimple(record: WaymarkRecord): string {
  const signals =
    (record.signals.flagged ? "~" : "") + (record.signals.starred ? "*" : "");
  // Pad line numbers to 3 digits (aligned to column 4) unless > 999
  const lineStr = String(record.startLine).padStart(LINE_NUMBER_WIDTH, " ");
  const content = sanitizeInlineText(record.contentText);
  return `${record.file}:${lineStr}: // ${signals}${record.type} ::: ${content}`;
}

/**
 * Format a single record with context lines
 */
export function formatRecordWithContext(
  record: WaymarkRecord,
  options: DisplayOptions
): string {
  const before = options.contextBefore ?? options.contextAround ?? 0;
  const after = options.contextAfter ?? options.contextAround ?? 0;

  // Pad line number to 3 digits
  const lineStr = String(record.startLine).padStart(LINE_NUMBER_WIDTH, " ");
  const lines: string[] = [`${record.file}:${lineStr}`];

  try {
    const fileContent = readFileSync(record.file, "utf8");
    const fileLines = fileContent.split("\n");

    const startLine = Math.max(0, record.startLine - before - 1);
    const endLine = Math.min(fileLines.length - 1, record.endLine + after - 1);

    // Calculate max line number width for context lines
    const maxLineNum = endLine + 1;
    const lineWidth = Math.max(LINE_NUMBER_WIDTH, String(maxLineNum).length);

    for (let i = startLine; i <= endLine; i++) {
      const lineNum = i + 1;
      const content = sanitizeInlineText(fileLines[i] ?? "");
      const paddedLineNum = String(lineNum).padStart(lineWidth, " ");
      lines.push(`${paddedLineNum}: ${content}`);
    }
  } catch (error) {
    lines.push(
      `Error reading file: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return lines.join("\n");
}

/**
 * Format records with text display (default, with optional context)
 */
export function formatText(
  records: WaymarkRecord[],
  options: DisplayOptions
): string {
  const lines: string[] = [];
  const hasContext =
    options.contextAround || options.contextBefore || options.contextAfter;

  for (const record of records) {
    if (hasContext) {
      lines.push(formatRecordWithContext(record, options));
      lines.push("--"); // Separator between waymarks
    } else {
      lines.push(formatRecordSimple(record));
    }
  }

  // Remove trailing separator
  if (hasContext && lines.at(-1) === "--") {
    lines.pop();
  }

  return lines.join("\n");
}

/**
 * Format records with flat display (one per line)
 */
export function formatFlat(records: WaymarkRecord[]): string {
  return records.map((r) => formatRecordSimple(r)).join("\n");
}
