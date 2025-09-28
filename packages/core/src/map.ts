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
