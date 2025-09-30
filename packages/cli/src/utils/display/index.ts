// tldr ::: display formatting orchestration for waymark records

import type { WaymarkRecord } from "@waymarks/core";
import { formatLong } from "./formatters/long";
import { formatFlat, formatText } from "./formatters/text";
import { formatTree } from "./formatters/tree";
import { formatGrouped } from "./grouping";
import { paginateRecords } from "./pagination";
import { sortRecords } from "./sorting";
import type { DisplayOptions } from "./types";

// Re-export types for convenience
export type { DisplayOptions } from "./types";

/**
 * Format waymark records according to display options
 */
export function formatRecords(
  records: WaymarkRecord[],
  options: DisplayOptions
): string {
  let processed = records;

  // Apply sorting
  if (options.sortBy && options.sortBy !== "none") {
    processed = sortRecords(processed, options.sortBy, options.reverse);
  }

  // Apply pagination
  if (options.limit || options.page) {
    processed = paginateRecords(processed, options.limit, options.page);
  }

  // Apply grouping
  if (options.groupBy && options.groupBy !== "none") {
    return formatGrouped(processed, options);
  }

  // Apply display mode
  const displayMode = options.displayMode || "text";
  switch (displayMode) {
    case "long":
      return formatLong(processed);
    case "flat":
      return formatFlat(processed);
    case "tree":
      return formatTree(processed);
    case "graph":
      // Graph mode should be handled separately in unified.ts
      return formatFlat(processed);
    default:
      return formatText(processed, options);
  }
}
