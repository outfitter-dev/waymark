// tldr ::: rendering helpers for CLI record output

import type { WaymarkRecord } from "@waymarks/core";

export type ScanOutputFormat = "text" | "json" | "jsonl";

/**
 * Clean record for JSON output by removing empty arrays and objects
 */
function cleanRecord(record: WaymarkRecord): Partial<WaymarkRecord> {
  const cleaned: Partial<WaymarkRecord> = { ...record };

  if (cleaned.signals) {
    const { current: _current, ...signals } = cleaned.signals;
    // note ::: omit `current` signal from JSON output
    cleaned.signals = signals;
  }

  // Remove empty arrays
  if (Array.isArray(cleaned.relations) && cleaned.relations.length === 0) {
    cleaned.relations = undefined as unknown as WaymarkRecord["relations"];
  }
  if (Array.isArray(cleaned.canonicals) && cleaned.canonicals.length === 0) {
    cleaned.canonicals = undefined as unknown as WaymarkRecord["canonicals"];
  }
  if (Array.isArray(cleaned.mentions) && cleaned.mentions.length === 0) {
    cleaned.mentions = undefined as unknown as WaymarkRecord["mentions"];
  }
  if (Array.isArray(cleaned.tags) && cleaned.tags.length === 0) {
    cleaned.tags = undefined as unknown as WaymarkRecord["tags"];
  }

  // Remove empty properties object
  if (cleaned.properties && Object.keys(cleaned.properties).length === 0) {
    cleaned.properties = undefined as unknown as WaymarkRecord["properties"];
  }

  // Remove signals if all are false
  if (
    cleaned.signals &&
    !cleaned.signals.flagged &&
    !cleaned.signals.starred &&
    !cleaned.signals.current
  ) {
    cleaned.signals = undefined as unknown as WaymarkRecord["signals"];
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
    case "text":
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
