// tldr ::: rendering helpers for CLI record output

import type { WaymarkRecord } from "@waymarks/core";

export type ScanOutputFormat = "text" | "json" | "jsonl" | "pretty";

export function renderRecords(
  records: WaymarkRecord[],
  format: ScanOutputFormat
): string {
  if (records.length === 0) {
    return "";
  }

  switch (format) {
    case "json":
      return JSON.stringify(records);
    case "jsonl":
      return records.map((record) => JSON.stringify(record)).join("\n");
    case "pretty":
      return JSON.stringify(records, null, 2);
    default:
      return records
        .map(
          (record) =>
            `${record.file}:${record.startLine} ${record.marker} ::: ${record.contentText}`
        )
        .join("\n");
  }
}
