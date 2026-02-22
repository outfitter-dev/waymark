// tldr ::: rendering helpers for CLI record output

// note ::: output() from @outfitter/cli detects format from OUTFITTER_JSON/OUTFITTER_JSONL env vars,
// not from --json/--jsonl CLI flags. Waymark drives format selection via CLI flags parsed into
// outputFormat state, so output() auto-detection does not apply here. Keep renderRecords() instead.

import type { WaymarkRecord } from "@waymarks/core";

export type ScanOutputFormat = "text" | "json" | "jsonl";

/**
 * A cleaned record suitable for JSON output.
 * Empty arrays and objects are omitted; the `current` signal is removed.
 */
type CleanedRecord = Omit<
  WaymarkRecord,
  "signals" | "relations" | "canonicals" | "mentions" | "tags" | "properties"
> & {
  signals?: Omit<WaymarkRecord["signals"], "current">;
  relations?: WaymarkRecord["relations"];
  canonicals?: string[];
  mentions?: string[];
  tags?: string[];
  properties?: Record<string, string>;
};

/**
 * Clean a record for JSON output by removing empty arrays/objects and the
 * `current` signal (which is a runtime-only navigation hint, not data).
 */
function cleanRecord(record: WaymarkRecord): CleanedRecord {
  const {
    signals,
    relations,
    canonicals,
    mentions,
    tags,
    properties,
    ...rest
  } = record;

  const cleaned: CleanedRecord = { ...rest };

  // Omit `current` signal — it's a runtime navigation hint, not serialized data
  const { current: _current, ...signalsWithoutCurrent } = signals;
  if (signalsWithoutCurrent.flagged || signalsWithoutCurrent.starred) {
    cleaned.signals = signalsWithoutCurrent;
  }

  if (relations.length > 0) {
    cleaned.relations = relations;
  }
  if (canonicals.length > 0) {
    cleaned.canonicals = canonicals;
  }
  if (mentions.length > 0) {
    cleaned.mentions = mentions;
  }
  if (tags.length > 0) {
    cleaned.tags = tags;
  }
  if (Object.keys(properties).length > 0) {
    cleaned.properties = properties;
  }

  return cleaned;
}

/**
 * Render waymark records in the requested output format.
 * @param records - Waymark records to render.
 * @param format - Output format selection.
 * @returns Rendered output string.
 */
export function renderRecords(
  records: WaymarkRecord[],
  format: ScanOutputFormat
): string {
  if (records.length === 0) {
    return "";
  }

  // Clean records for JSON output (strips empty arrays, removes `current` signal)
  const cleanedRecords = records.map(cleanRecord);

  switch (format) {
    case "json":
      return JSON.stringify(cleanedRecords);
    case "jsonl":
      return cleanedRecords.map((record) => JSON.stringify(record)).join("\n");
    case "text":
      // Pretty-printed JSON — used by the --pretty / --text flag in scan mode
      return JSON.stringify(cleanedRecords, null, 2);
    default:
      return JSON.stringify(cleanedRecords, null, 2);
  }
}
