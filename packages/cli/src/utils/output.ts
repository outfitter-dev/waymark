// tldr ::: rendering helpers for CLI record output

import type { WaymarkRecord } from "@waymarks/core";

export type ScanOutputFormat = "text" | "json" | "jsonl" | "pretty";

/**
 * Clean record for JSON output by removing empty arrays and objects
 */
function cleanRecord(record: WaymarkRecord): Partial<WaymarkRecord> {
  const cleaned: Partial<WaymarkRecord> = { ...record };

  // Remove empty arrays
  if (Array.isArray(cleaned.relations) && cleaned.relations.length === 0) {
    cleaned.relations = undefined;
  }
  if (Array.isArray(cleaned.canonicals) && cleaned.canonicals.length === 0) {
    cleaned.canonicals = undefined;
  }
  if (Array.isArray(cleaned.mentions) && cleaned.mentions.length === 0) {
    cleaned.mentions = undefined;
  }
  if (Array.isArray(cleaned.tags) && cleaned.tags.length === 0) {
    cleaned.tags = undefined;
  }

  // Remove empty properties object
  if (cleaned.properties && Object.keys(cleaned.properties).length === 0) {
    cleaned.properties = undefined;
  }

  // Remove signals if all are false
  if (
    cleaned.signals &&
    !cleaned.signals.raised &&
    !cleaned.signals.important &&
    !cleaned.signals.current
  ) {
    cleaned.signals = undefined;
  }

  return cleaned;
}

export function renderRecords(
  records: WaymarkRecord[],
  format: ScanOutputFormat
): string {
  if (records.length === 0) {
    return "";
  }

  // Clean records for JSON output
  const cleanedRecords = records.map(cleanRecord);

  switch (format) {
    case "json":
      return JSON.stringify(cleanedRecords);
    case "jsonl":
      return cleanedRecords.map((record) => JSON.stringify(record)).join("\n");
    case "pretty":
      return JSON.stringify(cleanedRecords, null, 2);
    default:
      return records
        .map(
          (record) =>
            `${record.file}:${record.startLine} ${record.type} ::: ${record.contentText}`
        )
        .join("\n");
  }
}
