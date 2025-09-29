// tldr ::: helpers for aggregating waymarks into file and marker summaries

import type { WaymarkRecord } from "@waymarks/grammar";

export type MarkerSummary = {
  marker: string;
  entries: WaymarkRecord[];
};

export type FileSummary = {
  file: string;
  tldr?: WaymarkRecord;
  markers: Map<string, MarkerSummary>;
};

export type WaymarkMap = {
  files: Map<string, FileSummary>;
};

export type MarkerTotal = {
  marker: string;
  count: number;
};

/**
 * Group waymark records by file and marker for downstream aggregation.
 */
export function buildWaymarkMap(records: WaymarkRecord[]): WaymarkMap {
  const files = new Map<string, FileSummary>();

  for (const record of records) {
    const fileSummary = ensureFileSummary(files, record.file);

    if (record.marker.toLowerCase() === "tldr" && !fileSummary.tldr) {
      fileSummary.tldr = record;
    }

    const markerSummary = ensureMarkerSummary(
      fileSummary,
      record.marker.toLowerCase()
    );
    markerSummary.entries.push(record);
  }

  return { files };
}

/**
 * Calculate sorted marker totals across the provided map.
 */
export function summarizeMarkerTotals(map: WaymarkMap): MarkerTotal[] {
  const totals = new Map<string, number>();

  for (const summary of map.files.values()) {
    for (const [marker, details] of summary.markers.entries()) {
      totals.set(marker, (totals.get(marker) ?? 0) + details.entries.length);
    }
  }

  return Array.from(totals.entries())
    .map(([marker, count]) => ({ marker, count }))
    .sort((a, b) => {
      if (b.count === a.count) {
        return a.marker.localeCompare(b.marker);
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
    markers: new Map<string, MarkerSummary>(),
  };
  files.set(fileKey, summary);
  return summary;
}

function ensureMarkerSummary(
  summary: FileSummary,
  markerKey: string
): MarkerSummary {
  const existing = summary.markers.get(markerKey);
  if (existing) {
    return existing;
  }

  const markerSummary: MarkerSummary = {
    marker: markerKey,
    entries: [],
  };
  summary.markers.set(markerKey, markerSummary);
  return markerSummary;
}
