// tldr ::: text formatting utilities for waymark records

import { readFileSync } from "node:fs";
import type { WaymarkRecord } from "@waymarks/core";
import type { DisplayOptions } from "../types";

/**
 * Format a single record in simple format
 */
export function formatRecordSimple(record: WaymarkRecord): string {
  const signals =
    (record.signals.raised ? "^" : "") + (record.signals.important ? "*" : "");
  return `${record.file}:${record.startLine}: // ${signals}${record.type} ::: ${record.contentText}`;
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

  const lines: string[] = [`${record.file}:${record.startLine}`];

  try {
    const fileContent = readFileSync(record.file, "utf8");
    const fileLines = fileContent.split("\n");

    const startLine = Math.max(0, record.startLine - before - 1);
    const endLine = Math.min(fileLines.length - 1, record.endLine + after - 1);

    for (let i = startLine; i <= endLine; i++) {
      const lineNum = i + 1;
      const content = fileLines[i];
      lines.push(`${lineNum}: ${content}`);
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
