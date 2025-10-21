// tldr ::: tree format display for waymark records grouped by directory structure

import { dirname } from "node:path";
import type { WaymarkRecord } from "@waymarks/core";

/**
 * Format a single directory section for tree display
 */
function formatTreeDirectory(
  dir: string,
  dirRecords: WaymarkRecord[],
  isLast: boolean
): string[] {
  const lines: string[] = [];
  lines.push(`${isLast ? "└─" : "├─"} ${dir}/`);

  for (let j = 0; j < dirRecords.length; j++) {
    const record = dirRecords[j];
    if (!record) {
      continue;
    }

    const isLastRecord = j === dirRecords.length - 1;
    const prefix = isLast ? "  " : "│ ";
    const branch = isLastRecord ? "└─" : "├─";
    lines.push(
      `${prefix}${branch} ${record.file}:${record.startLine}: ${record.type} - ${record.contentText}`
    );
  }

  return lines;
}

/**
 * Format records with tree display (grouped by directory structure)
 */
export function formatTree(records: WaymarkRecord[]): string {
  // Group by directory
  const byDir = new Map<string, WaymarkRecord[]>();

  for (const record of records) {
    const dir = dirname(record.file);
    const existing = byDir.get(dir) || [];
    existing.push(record);
    byDir.set(dir, existing);
  }

  const lines: string[] = [];
  const dirs = Array.from(byDir.keys()).sort();

  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i];
    if (!dir) {
      continue;
    }

    const dirRecords = byDir.get(dir) || [];
    const isLast = i === dirs.length - 1;
    lines.push(...formatTreeDirectory(dir, dirRecords, isLast));
  }

  return lines.join("\n");
}
