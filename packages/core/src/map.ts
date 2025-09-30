// tldr ::: helpers for aggregating waymarks into file and type summaries

import type { WaymarkRecord } from "@waymarks/grammar";
import { MARKERS } from "@waymarks/grammar";

export type MarkerSummary = {
  type: string;
  entries: WaymarkRecord[];
};

export type FileSummary = {
  file: string;
  tldr?: WaymarkRecord;
  types: Map<string, MarkerSummary>;
};

export type WaymarkMap = {
  files: Map<string, FileSummary>;
};

export type MarkerTotal = {
  type: string;
  count: number;
};

/**
 * Group waymark records by file and type for downstream aggregation.
 */
export function buildWaymarkMap(records: WaymarkRecord[]): WaymarkMap {
  const files = new Map<string, FileSummary>();

  for (const record of records) {
    const fileSummary = ensureFileSummary(files, record.file);

    if (record.type.toLowerCase() === MARKERS.tldr && !fileSummary.tldr) {
      fileSummary.tldr = record;
    }

    const markerSummary = ensureMarkerSummary(
      fileSummary,
      record.type.toLowerCase()
    );
    markerSummary.entries.push(record);
  }

  return { files };
}

/**
 * Calculate sorted type totals across the provided map.
 */
export function summarizeMarkerTotals(map: WaymarkMap): MarkerTotal[] {
  const totals = new Map<string, number>();

  for (const summary of map.files.values()) {
    for (const [type, details] of summary.types.entries()) {
      totals.set(type, (totals.get(type) ?? 0) + details.entries.length);
    }
  }

  return Array.from(totals.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => {
      if (b.count === a.count) {
        return a.type.localeCompare(b.type);
      }
      return b.count - a.count;
    });
}

function ensureFileSummary(
  files: Map<string, FileSummary>,
  fileKey: string
): FileSummary {
  const existing = files.get(fileKey);
  if (existing) {
    return existing;
  }

  const summary: FileSummary = {
    file: fileKey,
    types: new Map<string, MarkerSummary>(),
  };
  files.set(fileKey, summary);
  return summary;
}

function ensureMarkerSummary(
  summary: FileSummary,
  markerKey: string
): MarkerSummary {
  const existing = summary.types.get(markerKey);
  if (existing) {
    return existing;
  }

  const markerSummary: MarkerSummary = {
    type: markerKey,
    entries: [],
  };
  summary.types.set(markerKey, markerSummary);
  return markerSummary;
}
