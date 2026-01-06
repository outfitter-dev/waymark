// tldr ::: sorting utilities for waymark records

import { statSync } from "node:fs";
import type { WaymarkRecord } from "@waymarks/core";
import type { SortBy } from "../../commands/unified/types";

/**
 * Sort records by specified field
 */
export function sortRecords(
  records: WaymarkRecord[],
  sortBy: SortBy,
  reverse = false
): WaymarkRecord[] {
  const sorted = [...records];

  switch (sortBy) {
    case "file":
      sorted.sort((a, b) => a.file.localeCompare(b.file));
      break;
    case "line":
      sorted.sort((a, b) => a.startLine - b.startLine);
      break;
    case "type":
      sorted.sort((a, b) => a.type.localeCompare(b.type));
      break;
    case "signal":
      sorted.sort((a, b) => {
        const aScore =
          (a.signals.starred ? 2 : 0) + (a.signals.flagged ? 1 : 0);
        const bScore =
          (b.signals.starred ? 2 : 0) + (b.signals.flagged ? 1 : 0);
        return bScore - aScore; // Higher scores first
      });
      break;
    case "modified":
    case "created":
      sorted.sort((a, b) => {
        try {
          const aStat = statSync(a.file);
          const bStat = statSync(b.file);
          const aTime =
            sortBy === "modified" ? aStat.mtimeMs : aStat.birthtimeMs;
          const bTime =
            sortBy === "modified" ? bStat.mtimeMs : bStat.birthtimeMs;
          return bTime - aTime; // Most recent first
        } catch {
          return 0;
        }
      });
      break;
    case "added":
      // For now, sort by line number as a proxy for when waymark was added
      sorted.sort((a, b) => a.startLine - b.startLine);
      break;
    default:
      // No sorting (none case)
      break;
  }

  return reverse ? sorted.reverse() : sorted;
}
