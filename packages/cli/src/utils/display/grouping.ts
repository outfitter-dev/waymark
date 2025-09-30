// tldr ::: grouping utilities for waymark records

import { dirname } from "node:path";
import type { WaymarkRecord } from "@waymarks/core";
import type { GroupBy } from "../../commands/unified/types";
import { formatRecordSimple } from "./formatters/text";
import type { DisplayOptions } from "./types";

/**
 * Compute grouping key for a single record
 */
export function getGroupKey(record: WaymarkRecord, groupBy: GroupBy): string {
  switch (groupBy) {
    case "file":
      return record.file;
    case "dir":
      return dirname(record.file);
    case "type":
      return record.type;
    case "signal": {
      const signals: string[] = [];
      if (record.signals.raised) {
        signals.push("raised");
      }
      if (record.signals.important) {
        signals.push("important");
      }
      return signals.length > 0 ? signals.join("+") : "none";
    }
    case "mention":
      return record.mentions.length > 0
        ? record.mentions.join(", ")
        : "(no mentions)";
    case "tag":
      return record.tags.length > 0 ? record.tags.join(", ") : "(no tags)";
    case "property": {
      const props = Object.keys(record.properties);
      return props.length > 0 ? props.join(", ") : "(no properties)";
    }
    case "relation":
      return record.relations.length > 0
        ? record.relations.map((r) => r.kind).join(", ")
        : "(no relations)";
    default:
      return "(ungrouped)";
  }
}

/**
 * Group records by specified field
 */
export function groupRecords(
  records: WaymarkRecord[],
  groupBy: GroupBy
): Map<string, WaymarkRecord[]> {
  const groups = new Map<string, WaymarkRecord[]>();

  for (const record of records) {
    const key = getGroupKey(record, groupBy);
    const existing = groups.get(key) || [];
    existing.push(record);
    groups.set(key, existing);
  }

  return groups;
}

/**
 * Format records with grouping
 */
export function formatGrouped(
  records: WaymarkRecord[],
  options: DisplayOptions
): string {
  const groupBy = options.groupBy;
  if (!groupBy || groupBy === "none") {
    // This should never happen if caller checks, but fallback to text
    return records.map(formatRecordSimple).join("\n");
  }

  const grouped = groupRecords(records, groupBy);
  const lines: string[] = [];

  const groupKeys = Array.from(grouped.keys()).sort();

  for (const groupKey of groupKeys) {
    const groupItems = grouped.get(groupKey) || [];

    lines.push(`\n=== ${groupKey} ===\n`);

    for (const record of groupItems) {
      lines.push(formatRecordSimple(record));
    }
  }

  return lines.join("\n");
}
