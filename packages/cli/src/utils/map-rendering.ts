// tldr ::: map formatting and rendering utilities for waymark CLI

import {
  type FileSummary,
  type MarkerSummary,
  summarizeMarkerTotals,
  type WaymarkMap,
} from "@waymarks/core";
import { MARKERS } from "@waymarks/grammar";

export type MapRenderOptions = {
  types?: string[];
  includeSummary?: boolean;
};

export type MapSerializeOptions = MapRenderOptions;

const STDOUT = process.stdout;

/**
 * Print a formatted representation of the provided map to stdout.
 */
export function printMap(
  map: WaymarkMap,
  options: MapRenderOptions = {}
): void {
  writeStdout(formatMapOutput(map, options));
}

/**
 * Format a waymark map for human-friendly CLI output.
 */
export function formatMapOutput(
  map: WaymarkMap,
  options: MapRenderOptions = {}
): string {
  const typeFilter = toTypeFilter(options.types);
  const fileLines = buildFileBlocks(map, typeFilter);
  const outputLines = fileLines.flat();

  if (options.includeSummary) {
    const summaryLines = buildSummaryLines(map, typeFilter);
    if (summaryLines.length > 0) {
      if (outputLines.length > 0 && outputLines.at(-1) !== "") {
        outputLines.push("");
      }
      outputLines.push(...summaryLines);
    }
  }

  if (outputLines.length === 0) {
    outputLines.push(
      typeFilter && typeFilter.size > 0
        ? "No matching waymarks."
        : "No waymarks found."
    );
  }

  return outputLines.join("\n");
}

/**
 * Serialize a waymark map into JSON-friendly data for CLI output.
 */
export function serializeMap(
  map: WaymarkMap,
  options: MapSerializeOptions = {}
): Record<string, unknown> {
  const typeFilter = toTypeFilter(options.types);
  const result: Record<string, unknown> = {};

  const entries = Array.from(map.files.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  for (const [file, summary] of entries) {
    const includeTldr = shouldIncludeTldr(summary, typeFilter);
    const markerCounts = collectMarkerCounts(summary, typeFilter);

    if (!includeTldr && markerCounts.length === 0 && typeFilter) {
      continue;
    }

    result[file] = {
      ...(includeTldr ? { tldr: summary.tldr?.contentText } : {}),
      types: Object.fromEntries(
        markerCounts.map(({ type, count }) => [type, count])
      ),
    };
  }

  if (options.includeSummary) {
    const totals = summarizeMarkerTotals(map).filter(
      ({ type }) => !typeFilter || typeFilter.has(type)
    );

    result._summary = {
      types: Object.fromEntries(totals.map(({ type, count }) => [type, count])),
    };
  }

  return result;
}

/**
 * Normalize a type filter into a Set when requested.
 */
export function toTypeFilter(types?: string[]): Set<string> | undefined {
  if (!types || types.length === 0) {
    return;
  }
  return new Set(types.map((type) => type.toLowerCase()));
}

/**
 * Build the set of formatted lines for each file in the map.
 */
export function buildFileBlocks(
  map: WaymarkMap,
  typeFilter?: Set<string>
): string[][] {
  const summaries = Array.from(map.files.values()).sort((a, b) =>
    a.file.localeCompare(b.file)
  );
  return summaries
    .map((summary) => buildFileLines(summary, typeFilter))
    .filter((lines) => lines.length > 0);
}

/**
 * Format a single file summary into printable lines.
 */
export function buildFileLines(
  summary: FileSummary,
  typeFilter?: Set<string>
): string[] {
  const includeTldr = shouldIncludeTldr(summary, typeFilter);
  const markerCounts = collectMarkerCounts(summary, typeFilter);

  if (!includeTldr && markerCounts.length === 0 && typeFilter) {
    return [];
  }

  const lines = [summary.file];
  if (includeTldr && summary.tldr) {
    lines.push(`  tldr: ${summary.tldr.contentText}`);
  }
  for (const { type, count } of markerCounts) {
    lines.push(`  ${type}: ${count}`);
  }
  lines.push("");
  return lines;
}

/**
 * Collect marker counts for a file summary, honouring any filter provided.
 */
export function collectMarkerCounts(
  summary: FileSummary,
  typeFilter?: Set<string>
): Array<{ type: string; count: number }> {
  const entries: [string, MarkerSummary][] = Array.from(
    summary.types.entries()
  );
  const filtered = typeFilter
    ? entries.filter(([type]) => typeFilter.has(type))
    : entries;
  return filtered
    .map(([type, details]) => ({ type, count: details.entries.length }))
    .sort((a, b) => a.type.localeCompare(b.type));
}

/**
 * Decide whether a TLDR should be included for a given file summary.
 */
export function shouldIncludeTldr(
  summary: FileSummary,
  typeFilter?: Set<string>
): boolean {
  if (!summary.tldr) {
    return false;
  }
  if (typeFilter && !typeFilter.has(MARKERS.tldr)) {
    return false;
  }
  return summary.tldr.contentText.trim().length > 0;
}

/**
 * Build the global summary footer lines for the provided map.
 */
export function buildSummaryLines(
  map: WaymarkMap,
  typeFilter?: Set<string>
): string[] {
  const totals = summarizeMarkerTotals(map).filter(
    ({ type }) => !typeFilter || typeFilter.has(type)
  );
  if (totals.length === 0) {
    return [];
  }
  const lines = ["Summary:"];
  for (const { type, count } of totals) {
    lines.push(`  ${type}: ${count}`);
  }
  return lines;
}

function writeStdout(message: string): void {
  STDOUT.write(`${message}\n`);
}
